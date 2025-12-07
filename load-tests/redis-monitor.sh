#!/bin/bash

# ============================================================================
# SCRIPT DE MONITORAMENTO DO REDIS STREAMS
# Monitora o estado do stream de eventos durante os testes de carga
# ============================================================================

set -e

# Configurações
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
STREAM_KEY="${STREAM_KEY:-events-stream}"
OUTPUT_DIR="${OUTPUT_DIR:-./load-tests/results}"
INTERVAL="${INTERVAL:-5}"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Criar diretório de resultados
mkdir -p "$OUTPUT_DIR"

# Arquivo de log
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$OUTPUT_DIR/redis_monitor_$TIMESTAMP.json"
SUMMARY_FILE="$OUTPUT_DIR/redis_summary_$TIMESTAMP.txt"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   REDIS STREAMS MONITOR${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "Stream: ${GREEN}$STREAM_KEY${NC}"
echo -e "Intervalo: ${GREEN}${INTERVAL}s${NC}"
echo -e "Log: ${GREEN}$LOG_FILE${NC}"
echo ""

# Inicializar arquivo JSON
echo "[" > "$LOG_FILE"
FIRST_ENTRY=true

# Função para obter info do stream
get_stream_info() {
    docker exec eda-redis redis-cli XINFO STREAM "$STREAM_KEY" 2>/dev/null || echo "STREAM_NOT_FOUND"
}

# Função para obter info dos grupos
get_groups_info() {
    docker exec eda-redis redis-cli XINFO GROUPS "$STREAM_KEY" 2>/dev/null || echo "NO_GROUPS"
}

# Função para obter lag de um grupo
get_group_lag() {
    local group_name=$1
    docker exec eda-redis redis-cli XPENDING "$STREAM_KEY" "$group_name" 2>/dev/null | head -1 || echo "0"
}

# Função para contar eventos por tipo (últimos N eventos)
count_events_by_type() {
    local count=${1:-100}
    docker exec eda-redis redis-cli XREVRANGE "$STREAM_KEY" + - COUNT "$count" 2>/dev/null | grep -c "eventType" || echo "0"
}

# Função principal de monitoramento
monitor() {
    local iteration=$1
    local timestamp=$(date -Iseconds)
    
    # Obter informações do stream
    local stream_length=$(docker exec eda-redis redis-cli XLEN "$STREAM_KEY" 2>/dev/null || echo "0")
    
    # Obter primeiro e último ID
    local first_entry=$(docker exec eda-redis redis-cli XRANGE "$STREAM_KEY" - + COUNT 1 2>/dev/null | head -1 || echo "N/A")
    local last_entry=$(docker exec eda-redis redis-cli XREVRANGE "$STREAM_KEY" + - COUNT 1 2>/dev/null | head -1 || echo "N/A")
    
    # Obter informações dos grupos de consumidores
    local groups_raw=$(docker exec eda-redis redis-cli XINFO GROUPS "$STREAM_KEY" 2>/dev/null || echo "")
    
    # Processar grupos
    local order_pending=$(docker exec eda-redis redis-cli XPENDING "$STREAM_KEY" "order-service-group" 2>/dev/null | head -1 || echo "0")
    local payment_pending=$(docker exec eda-redis redis-cli XPENDING "$STREAM_KEY" "payment-service-group" 2>/dev/null | head -1 || echo "0")
    local inventory_pending=$(docker exec eda-redis redis-cli XPENDING "$STREAM_KEY" "inventory-service-group" 2>/dev/null | head -1 || echo "0")
    local notification_pending=$(docker exec eda-redis redis-cli XPENDING "$STREAM_KEY" "notification-service-group" 2>/dev/null | head -1 || echo "0")
    local audit_pending=$(docker exec eda-redis redis-cli XPENDING "$STREAM_KEY" "audit-service-group" 2>/dev/null | head -1 || echo "0")
    
    # Criar entrada JSON
    local json_entry=$(cat <<EOF
{
    "timestamp": "$timestamp",
    "iteration": $iteration,
    "stream": {
        "key": "$STREAM_KEY",
        "length": $stream_length
    },
    "consumer_groups": {
        "order-service": {"pending": ${order_pending:-0}},
        "payment-service": {"pending": ${payment_pending:-0}},
        "inventory-service": {"pending": ${inventory_pending:-0}},
        "notification-service": {"pending": ${notification_pending:-0}},
        "audit-service": {"pending": ${audit_pending:-0}}
    }
}
EOF
)
    
    # Adicionar ao arquivo JSON
    if [ "$FIRST_ENTRY" = true ]; then
        echo "$json_entry" >> "$LOG_FILE"
        FIRST_ENTRY=false
    else
        echo ",$json_entry" >> "$LOG_FILE"
    fi
    
    # Exibir no console
    echo -e "${YELLOW}[$(date +%H:%M:%S)]${NC} Stream length: ${GREEN}$stream_length${NC} | Pending - Order: ${order_pending:-0}, Payment: ${payment_pending:-0}, Inventory: ${inventory_pending:-0}, Notification: ${notification_pending:-0}, Audit: ${audit_pending:-0}"
}

# Função de cleanup
cleanup() {
    echo ""
    echo "]" >> "$LOG_FILE"
    echo -e "${BLUE}============================================${NC}"
    echo -e "${GREEN}Monitoramento finalizado${NC}"
    echo -e "Log salvo em: ${GREEN}$LOG_FILE${NC}"
    
    # Gerar sumário final
    generate_summary
    
    exit 0
}

# Gerar sumário
generate_summary() {
    echo -e "${BLUE}Gerando sumário...${NC}"
    
    local stream_length=$(docker exec eda-redis redis-cli XLEN "$STREAM_KEY" 2>/dev/null || echo "0")
    
    cat > "$SUMMARY_FILE" <<EOF
============================================
REDIS STREAMS - SUMÁRIO FINAL
============================================
Timestamp: $(date -Iseconds)
Stream: $STREAM_KEY
Total de eventos no stream: $stream_length

GRUPOS DE CONSUMIDORES:
$(docker exec eda-redis redis-cli XINFO GROUPS "$STREAM_KEY" 2>/dev/null || echo "Nenhum grupo encontrado")

ÚLTIMOS 5 EVENTOS:
$(docker exec eda-redis redis-cli XREVRANGE "$STREAM_KEY" + - COUNT 5 2>/dev/null || echo "Nenhum evento")
============================================
EOF
    
    echo -e "Sumário salvo em: ${GREEN}$SUMMARY_FILE${NC}"
    cat "$SUMMARY_FILE"
}

# Capturar Ctrl+C
trap cleanup SIGINT SIGTERM

# Loop principal
echo -e "${GREEN}Iniciando monitoramento (Ctrl+C para parar)...${NC}"
echo ""

iteration=0
while true; do
    ((iteration++))
    monitor $iteration
    sleep "$INTERVAL"
done
