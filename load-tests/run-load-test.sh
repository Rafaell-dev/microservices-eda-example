#!/bin/bash

# ============================================================================
# SCRIPT PRINCIPAL PARA TESTES DE CARGA - EDA ORDER PROCESSING
# Executa testes de carga com k6 e monitoramento do Redis
# ============================================================================

set -e

# Configurações padrão
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Valores padrão para configuração
MAX_VUS=50
CONSTANT_VUS=20
BURST_RATE=100
BURST_VUS=100
BURST_MAX_VUS=200

RAMP_UP_DURATION="30s"
STEADY_DURATION="1m"
RAMP_DOWN_DURATION="30s"
CONSTANT_DURATION="2m"
CONSTANT_START="2m30s"
BURST_START="5m"
TOTAL_DURATION="6m"

ORDER_SERVICE_URL="http://localhost:3001"
AUDIT_SERVICE_URL="http://localhost:3005"

# Perfis de teste pré-configurados
apply_profile() {
    case $1 in
        "smoke")
            echo -e "${CYAN}Perfil: SMOKE TEST (rápido, baixa carga)${NC}"
            MAX_VUS=5
            CONSTANT_VUS=3
            BURST_RATE=10
            RAMP_UP_DURATION="10s"
            STEADY_DURATION="20s"
            RAMP_DOWN_DURATION="10s"
            CONSTANT_DURATION="30s"
            CONSTANT_START="1m"
            BURST_START="2m"
            TOTAL_DURATION="3m"
            ;;
        "load")
            echo -e "${CYAN}Perfil: LOAD TEST (carga moderada)${NC}"
            MAX_VUS=50
            CONSTANT_VUS=20
            BURST_RATE=100
            ;;
        "stress")
            echo -e "${CYAN}Perfil: STRESS TEST (alta carga)${NC}"
            MAX_VUS=100
            CONSTANT_VUS=50
            BURST_RATE=200
            BURST_VUS=200
            BURST_MAX_VUS=300
            ;;
        "spike")
            echo -e "${CYAN}Perfil: SPIKE TEST (picos extremos)${NC}"
            MAX_VUS=50
            CONSTANT_VUS=20
            BURST_RATE=500
            BURST_VUS=300
            BURST_MAX_VUS=500
            ;;
        "endurance")
            echo -e "${CYAN}Perfil: ENDURANCE TEST (longa duração)${NC}"
            MAX_VUS=30
            CONSTANT_VUS=20
            BURST_RATE=50
            RAMP_UP_DURATION="1m"
            STEADY_DURATION="10m"
            RAMP_DOWN_DURATION="1m"
            CONSTANT_DURATION="10m"
            CONSTANT_START="12m"
            BURST_START="22m"
            TOTAL_DURATION="30m"
            ;;
        *)
            echo -e "${YELLOW}Perfil não reconhecido. Usando configurações padrão.${NC}"
            ;;
    esac
}

# Função de ajuda
show_help() {
    cat << EOF
${BLUE}============================================
TESTE DE CARGA - EDA ORDER PROCESSING
============================================${NC}

${GREEN}Uso:${NC}
  ./run-load-test.sh [opções]

${GREEN}Perfis de teste:${NC}
  --profile smoke      Teste rápido de validação (3 min)
  --profile load       Carga moderada (6 min) [padrão]
  --profile stress     Alta carga (6 min)
  --profile spike      Picos extremos (6 min)
  --profile endurance  Longa duração (30 min)

${GREEN}Opções de configuração:${NC}
  --max-vus N          Máximo de usuários virtuais (default: 50)
  --constant-vus N     VUs para carga constante (default: 20)
  --burst-rate N       Taxa de requisições/s no burst (default: 100)
  --duration TIME      Duração total (ex: 5m, 10m)
  
${GREEN}Opções de execução:${NC}
  --no-monitor         Não iniciar monitoramento do Redis
  --json-output        Gerar output JSON do k6
  --web-dashboard      Abrir dashboard web do k6
  
${GREEN}Exemplos:${NC}
  ./run-load-test.sh --profile smoke
  ./run-load-test.sh --profile stress --max-vus 200
  ./run-load-test.sh --max-vus 100 --duration 10m

EOF
}

# Parse de argumentos
NO_MONITOR=false
JSON_OUTPUT=false
WEB_DASHBOARD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --profile)
            apply_profile "$2"
            shift 2
            ;;
        --max-vus)
            MAX_VUS=$2
            shift 2
            ;;
        --constant-vus)
            CONSTANT_VUS=$2
            shift 2
            ;;
        --burst-rate)
            BURST_RATE=$2
            shift 2
            ;;
        --duration)
            TOTAL_DURATION=$2
            shift 2
            ;;
        --no-monitor)
            NO_MONITOR=true
            shift
            ;;
        --json-output)
            JSON_OUTPUT=true
            shift
            ;;
        --web-dashboard)
            WEB_DASHBOARD=true
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Opção desconhecida: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Criar diretório de resultados
mkdir -p "$OUTPUT_DIR"

# Verificar se k6 está instalado
check_k6() {
    if ! command -v k6 &> /dev/null; then
        echo -e "${RED}k6 não está instalado!${NC}"
        echo ""
        echo "Instale o k6:"
        echo "  Windows (winget): winget install k6 --source winget"
        echo "  Windows (choco):  choco install k6"
        echo "  macOS:            brew install k6"
        echo "  Linux:            https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
    echo -e "${GREEN}✓ k6 encontrado${NC}"
}

# Verificar serviços
check_services() {
    echo -e "${BLUE}Verificando serviços...${NC}"
    
    if curl -s "$ORDER_SERVICE_URL/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Order Service está online${NC}"
    else
        echo -e "${RED}✗ Order Service não está disponível em $ORDER_SERVICE_URL${NC}"
        echo -e "${YELLOW}Execute 'npm run dev' antes de rodar os testes.${NC}"
        exit 1
    fi
    
    if curl -s "$AUDIT_SERVICE_URL/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Audit Service está online${NC}"
    else
        echo -e "${YELLOW}⚠ Audit Service não está disponível (não é bloqueante)${NC}"
    fi
}

# Exibir configuração
show_config() {
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}   CONFIGURAÇÃO DO TESTE${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo -e "Max VUs:           ${GREEN}$MAX_VUS${NC}"
    echo -e "Constant VUs:      ${GREEN}$CONSTANT_VUS${NC}"
    echo -e "Burst Rate:        ${GREEN}$BURST_RATE req/s${NC}"
    echo -e "Duração Total:     ${GREEN}$TOTAL_DURATION${NC}"
    echo -e "Output Dir:        ${GREEN}$OUTPUT_DIR${NC}"
    echo ""
}

# Executar teste
run_test() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}   INICIANDO TESTE DE CARGA${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
    
    local K6_ARGS=""
    
    # Adicionar output JSON se solicitado
    if [ "$JSON_OUTPUT" = true ]; then
        K6_ARGS="$K6_ARGS --out json=$OUTPUT_DIR/k6_results_$TIMESTAMP.json"
    fi
    
    # Adicionar dashboard web se solicitado
    if [ "$WEB_DASHBOARD" = true ]; then
        K6_ARGS="$K6_ARGS --out dashboard"
    fi
    
    # Exportar variáveis de ambiente
    export MAX_VUS
    export CONSTANT_VUS
    export BURST_RATE
    export BURST_VUS
    export BURST_MAX_VUS
    export RAMP_UP_DURATION
    export STEADY_DURATION
    export RAMP_DOWN_DURATION
    export CONSTANT_DURATION
    export CONSTANT_START
    export BURST_START
    export TOTAL_DURATION
    export ORDER_SERVICE_URL
    export AUDIT_SERVICE_URL
    
    # Executar k6
    k6 run $K6_ARGS \
        --summary-export="$OUTPUT_DIR/summary_$TIMESTAMP.json" \
        "$SCRIPT_DIR/load-test.js" 2>&1 | tee "$OUTPUT_DIR/k6_output_$TIMESTAMP.log"
}

# Iniciar monitoramento do Redis em background
start_monitor() {
    if [ "$NO_MONITOR" = false ]; then
        echo -e "${BLUE}Iniciando monitoramento do Redis...${NC}"
        OUTPUT_DIR="$OUTPUT_DIR" INTERVAL=5 bash "$SCRIPT_DIR/redis-monitor.sh" &
        MONITOR_PID=$!
        echo -e "${GREEN}Monitor PID: $MONITOR_PID${NC}"
    fi
}

# Parar monitoramento
stop_monitor() {
    if [ ! -z "$MONITOR_PID" ]; then
        echo -e "${BLUE}Parando monitoramento do Redis...${NC}"
        kill $MONITOR_PID 2>/dev/null || true
    fi
}

# Gerar relatório final
generate_report() {
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}   RELATÓRIO FINAL${NC}"
    echo -e "${BLUE}============================================${NC}"
    
    # Obter estatísticas do Redis
    echo ""
    echo -e "${CYAN}Estado do Redis Stream:${NC}"
    docker exec eda-redis redis-cli XLEN events-stream 2>/dev/null || echo "N/A"
    
    echo ""
    echo -e "${CYAN}Grupos de Consumidores:${NC}"
    docker exec eda-redis redis-cli XINFO GROUPS events-stream 2>/dev/null || echo "N/A"
    
    echo ""
    echo -e "${GREEN}Arquivos gerados em: $OUTPUT_DIR${NC}"
    ls -la "$OUTPUT_DIR"/*$TIMESTAMP* 2>/dev/null || echo "Nenhum arquivo encontrado"
}

# Cleanup
cleanup() {
    stop_monitor
    generate_report
}

trap cleanup EXIT

# Main
main() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║        EDA ORDER PROCESSING - TESTE DE CARGA               ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    check_k6
    check_services
    show_config
    
    echo -e "${YELLOW}Iniciando em 3 segundos... (Ctrl+C para cancelar)${NC}"
    sleep 3
    
    start_monitor
    sleep 2  # Dar tempo para o monitor iniciar
    
    run_test
}

main
