#!/usr/bin/env bash
# ================================================================
# Docmost 生产环境部署脚本
#
# 用法:
#   ./scripts/deploy.sh              # 构建并部署
#   ./scripts/deploy.sh --skip-build # 跳过构建（已手动构建时使用）
#   ./scripts/deploy.sh --dry-run    # 仅打印操作，不实际执行
#
# 前置条件:
#   本地: Node.js 22+, pnpm 10.x, rsync, ssh 免密登录已配置
#   服务器: Node.js 22+, pnpm 10.x, pm2 或 systemd 已配置
#
# ================================================================
set -euo pipefail

# ================================================================
# 配置区 —— 根据你的环境修改以下变量
# ================================================================

# 服务器连接信息
SERVER_USER="ZZB"
SERVER_HOST="192.168.0.103"
SERVER_PORT="22"

# 服务器上的部署根目录（建议 /opt/docmost）
SERVER_PATH="/opt/docmost"

# 服务重启命令（三选一，注释掉不用的）
# 方式一: pm2（推荐）
RESTART_CMD="pm2 restart docmost"
# 方式二: systemd
# RESTART_CMD="sudo systemctl restart docmost"
# 方式三: 自定义命令
# RESTART_CMD="cd /opt/docmost/current && pnpm start"

# 协作服务器重启命令（如果启用了协作功能，取消注释）
# COLLAB_RESTART_CMD="pm2 restart docmost-collab"

# 保留最近几个版本（用于回滚）
KEEP_RELEASES=5

# 是否在构建前运行测试（true/false）
RUN_TESTS=false

# ================================================================
# 脚本逻辑 —— 一般不需要修改以下内容
# ================================================================

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_NAME="$(basename "$0")"

# 发布包名
RELEASE_NAME="$(date +%Y%m%d_%H%M%S)"
RELEASE_DIR="${SERVER_PATH}/releases/${RELEASE_NAME}"
SHARED_DIR="${SERVER_PATH}/shared"
CURRENT_LINK="${SERVER_PATH}/current"

# 标记位
SKIP_BUILD=false
DRY_RUN=false

# ================================================================
# 辅助函数
# ================================================================

log_info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_step()  { echo ""; echo -e "${GREEN}==>${NC} ${BLUE}$*${NC}"; }

# 在服务器上执行命令
remote_run() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[dry-run] ssh -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_HOST} \"$*\""
        return 0
    fi
    ssh -p "${SERVER_PORT}" "${SERVER_USER}@${SERVER_HOST}" "$@"
}

# 打印即将执行的操作
print_action() {
    echo "  操作: $1"
    echo "  目标: $2"
    echo "  主机: ${SERVER_USER}@${SERVER_HOST}:${SERVER_PORT}"
}

# 清理函数（出错时调用）
cleanup() {
    log_warn "部署中断，清理临时文件..."
    rm -f "${PROJECT_ROOT}/deploy-temp.tar.gz"
}
trap cleanup EXIT

# ================================================================
# 参数解析
# ================================================================

while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-build) SKIP_BUILD=true; shift ;;
        --dry-run)    DRY_RUN=true; shift ;;
        --help|-h)
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --skip-build  跳过本地构建步骤"
            echo "  --dry-run     仅打印操作，不实际执行"
            echo "  --help, -h    显示此帮助信息"
            exit 0
            ;;
        *)
            log_error "未知参数: $1"
            echo "使用 --help 查看用法"
            exit 1
            ;;
    esac
done

# ================================================================
# 环境检查
# ================================================================

log_step "1. 环境检查"

# 检查必要工具
check_command() {
    if ! command -v "$1" &>/dev/null; then
        log_error "未找到命令 '$1'，请先安装"
        exit 1
    fi
    log_info "✓ $1"
}

check_command node
check_command pnpm
check_command rsync
check_command ssh

# 检查 Node.js 版本
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VERSION" -lt 22 ]]; then
    log_error "需要 Node.js 22+，当前版本: $(node -v)"
    exit 1
fi

# 检查是否可连接服务器
if [[ "$DRY_RUN" == "false" ]]; then
    if ! ssh -p "${SERVER_PORT}" -o ConnectTimeout=5 "${SERVER_USER}@${SERVER_HOST}" "echo ok" &>/dev/null; then
        log_error "无法连接服务器 ${SERVER_USER}@${SERVER_HOST}:${SERVER_PORT}"
        log_error "请检查 SSH 配置和免密登录是否正常"
        exit 1
    fi
    log_info "✓ 服务器连接正常"
fi

log_ok "环境检查通过"

# ================================================================
# 构建
# ================================================================

if [[ "$SKIP_BUILD" == "false" ]]; then
    log_step "2. 构建项目"

    cd "${PROJECT_ROOT}"

    if [[ "$RUN_TESTS" == "true" ]]; then
        log_info "运行测试..."
        pnpm test || {
            log_error "测试未通过，终止部署"
            exit 1
        }
    fi

    log_info "清理旧产物..."
    rm -rf apps/server/dist apps/client/dist packages/editor-ext/dist

    log_info "安装依赖..."
    pnpm install --frozen-lockfile

    log_info "编译所有包..."
    pnpm build || {
        log_error "构建失败"
        exit 1
    }

    # 验证关键产物存在
    if [[ ! -f "apps/server/dist/main.js" ]]; then
        log_error "服务端构建产物缺失: apps/server/dist/main.js"
        exit 1
    fi
    if [[ ! -d "apps/client/dist" ]]; then
        log_error "客户端构建产物缺失: apps/client/dist/"
        exit 1
    fi

    log_ok "构建完成"
else
    log_step "2. 构建项目 [跳过]"
fi

# ================================================================
# 打包
# ================================================================

log_step "3. 打包部署文件"

cd "${PROJECT_ROOT}"

log_info "创建发布包 ${RELEASE_NAME}.tar.gz ..."

# 只打包运行时需要的文件（与 Dockerfile installer 阶段一致）
tar czf deploy-temp.tar.gz \
    apps/server/dist \
    apps/client/dist \
    apps/server/package.json \
    packages/editor-ext/dist \
    packages/editor-ext/package.json \
    package.json \
    pnpm-workspace.yaml \
    pnpm-lock.yaml \
    .npmrc \
    patches/

PACKAGE_SIZE=$(du -h deploy-temp.tar.gz | cut -f1)
log_ok "打包完成 (${PACKAGE_SIZE})"

# ================================================================
# 上传
# ================================================================

log_step "4. 上传到服务器"

print_action "上传" "${RELEASE_DIR}"

if [[ "$DRY_RUN" == "false" ]]; then
    # 确保服务器目录结构存在
    remote_run "mkdir -p ${RELEASE_DIR} ${SHARED_DIR}/data/storage"

    # 上传发布包
    rsync -avz --progress \
        -e "ssh -p ${SERVER_PORT}" \
        deploy-temp.tar.gz \
        "${SERVER_USER}@${SERVER_HOST}:${RELEASE_DIR}/"

    log_info "在服务器上解压..."
    remote_run "cd ${RELEASE_DIR} && tar xzf deploy-temp.tar.gz && rm deploy-temp.tar.gz"

    # 清理本地临时包
    rm -f deploy-temp.tar.gz
fi

log_ok "上传完成"

# ================================================================
# 服务器端：安装依赖 & 链接共享文件
# ================================================================

log_step "5. 安装生产依赖 & 链接共享文件"

if [[ "$DRY_RUN" == "false" ]]; then
    log_info "安装生产依赖 (pnpm install --prod)..."
    remote_run "cd ${RELEASE_DIR} && pnpm install --frozen-lockfile --prod" || {
        log_error "依赖安装失败"
        exit 1
    }

    log_info "链接共享文件 (.env, data/)..."
    # .env 文件 —— 如果不存在则警告
    remote_run "
        if [[ ! -f ${SHARED_DIR}/.env ]]; then
            echo '!!! 警告: ${SHARED_DIR}/.env 不存在，请手动创建 !!!'
        else
            ln -sf ${SHARED_DIR}/.env ${RELEASE_DIR}/.env
        fi
    "

    # data 目录（文件上传存储）
    remote_run "
        if [[ -d ${SHARED_DIR}/data/storage ]]; then
            mkdir -p ${RELEASE_DIR}/data
            ln -sfn ${SHARED_DIR}/data/storage ${RELEASE_DIR}/data/storage
        fi
    "
fi

log_ok "依赖安装完成"

# ================================================================
# 切换版本 & 重启服务
# ================================================================

log_step "6. 切换版本 & 重启服务"

if [[ "$DRY_RUN" == "false" ]]; then
    # 更新 current 软链接
    log_info "更新版本链接: ${CURRENT_LINK} -> ${RELEASE_DIR}"
    remote_run "ln -sfn ${RELEASE_DIR} ${CURRENT_LINK}"

    # 重启主服务
    log_info "重启服务..."
    remote_run "${RESTART_CMD}" || {
        log_error "服务重启失败！请登录服务器检查"
        exit 1
    }

    # 重启协作服务（如果配置了）
    if [[ -n "${COLLAB_RESTART_CMD:-}" ]]; then
        log_info "重启协作服务..."
        remote_run "${COLLAB_RESTART_CMD}" || {
            log_warn "协作服务重启失败，请登录服务器检查"
        }
    fi

    # 等待服务启动
    sleep 3
fi

log_ok "版本切换完成"

# ================================================================
# 健康检查
# ================================================================

log_step "7. 健康检查"

if [[ "$DRY_RUN" == "false" ]]; then
    # 检查进程是否运行
    if remote_run "pgrep -f 'node.*dist/main' > /dev/null 2>&1 && echo 'running' || echo 'not running'"; then
        PROCS=$(remote_run "pgrep -f 'node.*dist/main' | wc -l")
        if [[ "$PROCS" -gt 0 ]]; then
            log_ok "服务进程正在运行 (${PROCS} 个进程)"
        else
            log_error "服务进程未找到！请登录服务器检查日志"
            exit 1
        fi
    fi

    # HTTP 健康检查（需要 curl）
    log_info "检查 HTTP 响应..."
    if remote_run "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000 2>/dev/null || echo 'fail'"; then
        HTTP_CODE=$(remote_run "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000 2>/dev/null || echo '000'")
        if [[ "$HTTP_CODE" == "200" ]] || [[ "$HTTP_CODE" == "302" ]]; then
            log_ok "HTTP 响应正常 (${HTTP_CODE})"
        else
            log_warn "HTTP 响应异常 (${HTTP_CODE})，请手动检查"
        fi
    fi
fi

# ================================================================
# 清理旧版本
# ================================================================

log_step "8. 清理旧版本"

if [[ "$DRY_RUN" == "false" ]]; then
    # 保留最近 KEEP_RELEASES 个版本，删除更旧的
    remote_run "
        cd ${SERVER_PATH}/releases
        ls -1t | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf
    " || true

    # 显示保留的版本
    RELEASE_COUNT=$(remote_run "ls -1 ${SERVER_PATH}/releases/ | wc -l")
    log_info "当前保留 ${RELEASE_COUNT} 个版本:"
    remote_run "ls -1t ${SERVER_PATH}/releases/ | head -${KEEP_RELEASES}" || true
fi

log_ok "清理完成"

# ================================================================
# 完成
# ================================================================

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  部署成功！${NC}"
echo -e "${GREEN}  版本: ${RELEASE_NAME}${NC}"
echo -e "${GREEN}  服务器: ${SERVER_USER}@${SERVER_HOST}${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "如需回滚，执行:"
echo "  ./scripts/rollback.sh"
