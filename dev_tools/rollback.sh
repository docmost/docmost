#!/usr/bin/env bash
# ================================================================
# Docmost 回滚脚本
#
# 用法:
#   ./scripts/rollback.sh               # 回滚到上一个版本
#   ./scripts/rollback.sh 20260701_1200 # 回滚到指定版本
#   ./scripts/rollback.sh --list        # 列出所有可用版本
#
# ================================================================
set -euo pipefail

# ================================================================
# 配置区 —— 与 deploy.sh 保持一致
# ================================================================

SERVER_USER="root"
SERVER_HOST="your-server.example.com"
SERVER_PORT="22"
SERVER_PATH="/opt/docmost"

RESTART_CMD="pm2 restart docmost"
# COLLAB_RESTART_CMD="pm2 restart docmost-collab"

CURRENT_LINK="${SERVER_PATH}/current"
RELEASES_DIR="${SERVER_PATH}/releases"

# ================================================================
# 颜色 & 辅助函数
# ================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

remote_run() {
    ssh -p "${SERVER_PORT}" "${SERVER_USER}@${SERVER_HOST}" "$@" 2>&1
}

# ================================================================
# 列出可用版本
# ================================================================

list_releases() {
    echo "可用版本:"
    echo ""
    remote_run "
        current=\$(readlink ${CURRENT_LINK} 2>/dev/null || echo '无')
        for dir in \$(ls -1t ${RELEASES_DIR}/ 2>/dev/null); do
            marker=' '
            if [[ \"${RELEASES_DIR}/\${dir}\" == \"\${current}\" ]]; then
                marker='*'
            fi
            size=\$(du -sh ${RELEASES_DIR}/\${dir} 2>/dev/null | cut -f1)
            echo \"  [\${marker}] \${dir}  (\${size})\"
        done
    "
}

# ================================================================
# 参数解析
# ================================================================

LIST_ONLY=false
TARGET_VERSION=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --list|-l)
            LIST_ONLY=true
            shift
            ;;
        --help|-h)
            echo "用法: $0 [选项] [版本号]"
            echo ""
            echo "选项:"
            echo "  --list, -l     列出所有可用版本"
            echo "  --help, -h     显示此帮助信息"
            echo ""
            echo "参数:"
            echo "  版本号          指定要回滚到的版本（默认: 上一个版本）"
            exit 0
            ;;
        *)
            TARGET_VERSION="$1"
            shift
            ;;
    esac
done

# ================================================================
# 预检查
# ================================================================

if ! command -v ssh &>/dev/null; then
    log_error "未找到 ssh 命令"
    exit 1
fi

if ! ssh -p "${SERVER_PORT}" -o ConnectTimeout=5 "${SERVER_USER}@${SERVER_HOST}" "echo ok" &>/dev/null; then
    log_error "无法连接服务器 ${SERVER_USER}@${SERVER_HOST}:${SERVER_PORT}"
    exit 1
fi

# 列出所有版本
if [[ "$LIST_ONLY" == "true" ]]; then
    list_releases
    exit 0
fi

# 获取当前版本和所有版本列表
CURRENT=$(remote_run "readlink ${CURRENT_LINK} 2>/dev/null || echo ''")
VERSIONS=$(remote_run "ls -1t ${RELEASES_DIR}/ 2>/dev/null || echo ''")

if [[ -z "$VERSIONS" ]]; then
    log_error "服务器上没有找到任何部署版本"
    exit 1
fi

# 确定目标版本
if [[ -z "$TARGET_VERSION" ]]; then
    # 默认：上一个非当前版本
    VERSION_LIST=($VERSIONS)
    if [[ ${#VERSION_LIST[@]} -lt 2 ]]; then
        log_error "只有一个版本，无法回滚"
        list_releases
        exit 1
    fi
    # 找到当前版本在列表中的位置，取下一个
    CURRENT_BASENAME=$(basename "$CURRENT" 2>/dev/null || echo "")
    TARGET_VERSION=""
    for v in "${VERSION_LIST[@]}"; do
        if [[ "$v" != "$CURRENT_BASENAME" ]]; then
            TARGET_VERSION="$v"
            break
        fi
    done
    if [[ -z "$TARGET_VERSION" ]]; then
        TARGET_VERSION="${VERSION_LIST[1]}"
    fi
    log_info "当前版本: ${CURRENT_BASENAME:-未知}"
    log_info "将回滚到: ${TARGET_VERSION}"
else
    # 验证指定版本是否存在
    if ! remote_run "test -d ${RELEASES_DIR}/${TARGET_VERSION} && echo ok"; then
        log_error "版本 ${TARGET_VERSION} 不存在"
        list_releases
        exit 1
    fi
fi

# ================================================================
# 确认操作
# ================================================================

echo ""
echo -e "${YELLOW}============================================================${NC}"
echo -e "${YELLOW}  警告: 即将回滚到版本 ${TARGET_VERSION}${NC}"
echo -e "${YELLOW}  当前版本: ${CURRENT_BASENAME:-未知}${NC}"
echo -e "${YELLOW}============================================================${NC}"
echo ""

if [[ -z "${CI:-}" ]]; then
    read -r -p "确认回滚? [y/N] " CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        log_info "已取消"
        exit 0
    fi
fi

# ================================================================
# 执行回滚
# ================================================================

log_info "切换版本链接: ${CURRENT_LINK} -> ${RELEASES_DIR}/${TARGET_VERSION}"
remote_run "ln -sfn ${RELEASES_DIR}/${TARGET_VERSION} ${CURRENT_LINK}"

log_info "重启服务..."
remote_run "${RESTART_CMD}" || {
    log_error "服务重启失败！请登录服务器检查"
    exit 1
}

if [[ -n "${COLLAB_RESTART_CMD:-}" ]]; then
    log_info "重启协作服务..."
    remote_run "${COLLAB_RESTART_CMD}" || true
fi

# 等待服务启动
sleep 3

# 快速健康检查
log_info "检查服务状态..."
if remote_run "pgrep -f 'node.*dist/main' > /dev/null 2>&1 && echo running || echo dead"; then
    PROC_STATUS=$(remote_run "pgrep -f 'node.*dist/main' > /dev/null 2>&1 && echo running || echo dead")
    if [[ "$PROC_STATUS" == "running" ]]; then
        log_ok "回滚成功！服务已在版本 ${TARGET_VERSION} 上运行"
    else
        log_error "服务进程未启动！请登录服务器检查"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  回滚完成${NC}"
echo -e "${GREEN}  当前版本: ${TARGET_VERSION}${NC}"
echo -e "${GREEN}============================================================${NC}"
