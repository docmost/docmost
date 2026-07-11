#!/usr/bin/env bash
# ================================================================
# Docmost 生产环境部署脚本
#
# 用法:
#   ./部署到生产环境.sh              # 部署已编译的产物
#   ./部署到生产环境.sh --dry-run    # 试运行
#
# 使用前请确保已经手动执行过构建:
#   pnpm install && pnpm build
#
# 服务器上手动运行数据库迁移:
#   ssh ZZB@192.168.0.103
#   cd /opt/docmost/apps/server
#   node dist/database/migrate.js up       # 升级到最新
#   node dist/database/migrate.js down     # 回退一个版本
#   node dist/database/migrate.js latest   # 查看状态
# ================================================================
set -euo pipefail

# ================================================================
# 配置
# ================================================================
SERVER_USER="ZZB"
SERVER_HOST="192.168.0.103"
SERVER_PORT="22"
SERVER_PATH="/opt/docmost"
BACKUP_PATH="/opt/backups"
RESTART_CMD="pm2 restart docmost"

# 需要同步的 dist 目录（相对项目根目录）
DIST_DIRS=(
    "apps/server/dist"
    "apps/client/dist"
    "packages/editor-ext/dist"
)

# 需要同步的配置文件
CONFIG_FILES=(
    "apps/server/package.json"
    "packages/editor-ext/package.json"
    "package.json"
    "pnpm-workspace.yaml"
    "pnpm-lock.yaml"
    ".npmrc"
)

PATCH_DIR="patches"
# ================================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log_info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_step()  { echo ""; echo -e "${GREEN}==>${NC} ${BLUE}$*${NC}"; }

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

DRY_RUN=false
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run) DRY_RUN=true; shift ;;
        -h|--help) echo "用法: $0 [--dry-run]"; exit 0 ;;
        *) log_error "未知参数: $1"; exit 1 ;;
    esac
done

# ================================================================
# SSH 连接复用 —— 整个脚本只输入一次密码
# ================================================================
SSH_CONTROL="/tmp/docmost-deploy-$$"
SSH_OPTS="-p ${SERVER_PORT} -o ControlMaster=auto -o ControlPath=${SSH_CONTROL} -o ControlPersist=300"

# 清理 SSH 控制连接
cleanup_ssh() {
    ssh ${SSH_OPTS} -O exit "${SERVER_USER}@${SERVER_HOST}" 2>/dev/null || true
    rm -f "${SSH_CONTROL}"
}
trap cleanup_ssh EXIT

remote_run() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[dry-run] ssh ${SERVER_USER}@${SERVER_HOST} \"$*\""
        return 0
    fi
    ssh ${SSH_OPTS} "${SERVER_USER}@${SERVER_HOST}" "$@"
}

# ================================================================
# 1. 环境检查
# ================================================================
log_step "1. 环境检查"

for cmd in rsync ssh; do
    command -v "$cmd" &>/dev/null || { log_error "未找到 $cmd"; exit 1; }
    log_info "✓ $cmd"
done

if [[ "$DRY_RUN" == "false" ]]; then
    log_info "连接服务器（首次需要输入密码，本次部署期间只需一次）..."
    ssh ${SSH_OPTS} "${SERVER_USER}@${SERVER_HOST}" "echo ok" &>/dev/null || {
        log_error "无法连接 ${SERVER_USER}@${SERVER_HOST}:${SERVER_PORT}"
        exit 1
    }
    log_info "✓ 服务器连接正常（SSH 连接已缓存）"
fi

log_ok "环境检查通过"

# ================================================================
# 2. 检查本地产物
# ================================================================
log_step "2. 检查本地产物"

cd "${PROJECT_ROOT}"

MISSING=()
for dir in "${DIST_DIRS[@]}"; do
    if [[ -d "$dir" ]]; then
        log_info "✓ ${dir}"
    else
        log_error "✗ ${dir} 不存在"
        MISSING+=("$dir")
    fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
    echo ""
    log_error "以下构建产物缺失，请先手动构建:"
    for m in "${MISSING[@]}"; do
        echo "  - ${m}"
    done
    echo ""
    log_info "构建命令: cd ${PROJECT_ROOT} && pnpm install && pnpm build"
    exit 1
fi

log_ok "产物检查通过"

# ================================================================
# 3. 备份（询问）
# ================================================================
log_step "3. 备份"

BACKUP_FILE="${BACKUP_PATH}/docmost-$(date +%Y%m%d_%H%M%S).tar.gz"

echo ""
echo -n "是否备份服务器上的当前版本？[Y/n] "
if [[ "$DRY_RUN" == "true" ]]; then
    echo "(dry-run 模式)"
    DO_BACKUP=true
else
    read -r ANSWER
    [[ -z "$ANSWER" || "$ANSWER" =~ ^[Yy]$ ]] && DO_BACKUP=true || DO_BACKUP=false
fi

if [[ "$DO_BACKUP" == "true" ]]; then
    log_info "正在备份 ${SERVER_PATH} → ${BACKUP_FILE} ..."
    if [[ "$DRY_RUN" == "false" ]]; then
        remote_run "tar czf ${BACKUP_FILE} -C / opt/docmost 2>/dev/null" && {
            BACKUP_SIZE=$(remote_run "du -h ${BACKUP_FILE} | cut -f1")
            log_ok "备份完成 (${BACKUP_SIZE})"
        } || {
            log_warn "备份失败（可能是首次部署，目录为空），继续..."
        }
    fi
else
    log_info "跳过备份"
fi

# ================================================================
# 4. 停止服务
# ================================================================
log_step "4. 停止服务"

if [[ "$DRY_RUN" == "false" ]]; then
    remote_run "pm2 stop docmost 2>/dev/null || true"
    sleep 1
fi
log_ok "服务已停止"

# ================================================================
# 5. 传输文件
# ================================================================
log_step "5. 传输文件到服务器"

# 收集所有需要创建的父目录
PARENT_DIRS=()
for dir in "${DIST_DIRS[@]}"; do
    PARENT_DIRS+=("$(dirname "$dir")")
done
for file in "${CONFIG_FILES[@]}"; do
    PARENT_DIRS+=("$(dirname "$file")")
done
UNIQUE_DIRS=($(printf '%s\n' "${PARENT_DIRS[@]}" | sort -u))

if [[ "$DRY_RUN" == "false" ]]; then
    log_info "创建服务器目录结构..."
    for d in "${UNIQUE_DIRS[@]}"; do
        [[ "$d" == "." ]] && continue
        remote_run "mkdir -p ${SERVER_PATH}/${d}"
    done
    remote_run "mkdir -p ${SERVER_PATH}/${PATCH_DIR}"

    # 同步 dist 目录（--delete 清理残留的旧编译文件）
    for dir in "${DIST_DIRS[@]}"; do
        log_info "同步 ${dir}/ ..."
        rsync -avz --delete --progress \
            -e "ssh ${SSH_OPTS}" \
            "${dir}/" \
            "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/${dir}/"
    done

    # 同步配置文件
    for file in "${CONFIG_FILES[@]}"; do
        log_info "同步 ${file} ..."
        rsync -avz --progress \
            -e "ssh ${SSH_OPTS}" \
            "${file}" \
            "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/${file}"
    done

    # 同步 patches
    if [[ -d "${PATCH_DIR}" ]]; then
        log_info "同步 ${PATCH_DIR}/ ..."
        rsync -avz --progress \
            -e "ssh ${SSH_OPTS}" \
            "${PATCH_DIR}/" \
            "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/${PATCH_DIR}/"
    fi
fi

log_ok "文件传输完成"

# ================================================================
# 6. 安装依赖
# ================================================================
log_step "6. 安装生产依赖"

if [[ "$DRY_RUN" == "false" ]]; then
    remote_run "cd ${SERVER_PATH} && pnpm install --frozen-lockfile --prod" || {
        log_error "依赖安装失败"
        exit 1
    }
fi

log_ok "依赖安装完成"

# ================================================================
# 7. 启动服务
# ================================================================
log_step "7. 启动服务"

if [[ "$DRY_RUN" == "false" ]]; then
    remote_run "${RESTART_CMD}" || {
        log_error "服务启动失败！"
        exit 1
    }
    sleep 3
fi
log_ok "服务已启动"

# ================================================================
# 8. 健康检查
# ================================================================
log_step "8. 健康检查"

if [[ "$DRY_RUN" == "false" ]]; then
    PROC_COUNT=$(remote_run "pgrep -f 'node.*dist/main' | wc -l" 2>/dev/null || echo "0")
    if [[ "$PROC_COUNT" -gt 0 ]]; then
        log_ok "进程运行中 (${PROC_COUNT} 个)"
    else
        log_error "进程未运行！请登录检查"
        exit 1
    fi

    HTTP_CODE=$(remote_run "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000 2>/dev/null" || echo "000")
    if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "302" ]]; then
        log_ok "HTTP 响应正常 (${HTTP_CODE})"
    else
        log_warn "HTTP 响应 ${HTTP_CODE}，请手动确认"
    fi
fi

# ================================================================
# 完成
# ================================================================
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  部署完成${NC}"
echo -e "${GREEN}  服务器: ${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}${NC}"
if [[ "$DO_BACKUP" == "true" ]]; then
    echo -e "${GREEN}  备份: ${BACKUP_FILE}${NC}"
    echo ""
    echo "--- 回滚方法 ---"
    echo "  pm2 stop docmost"
    echo "  rm -rf ${SERVER_PATH}/*"
    echo "  tar xzf ${BACKUP_FILE} -C /"
    echo "  pm2 start docmost"
fi
echo ""
echo "--- 数据库迁移（在服务器上手动执行）---"
echo "  cd ${SERVER_PATH}/apps/server"
echo "  node dist/database/migrate.js up       # 升级到最新"
echo "  node dist/database/migrate.js down     # 回退一个版本"
echo "  node dist/database/migrate.js latest   # 查看状态"
echo -e "${GREEN}============================================================${NC}"
