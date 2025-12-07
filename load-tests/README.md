# Teste de Carga - EDA Order Processing System

Suite completa de testes de carga para validar resiliência, consistência eventual e capacidade de processamento do sistema de microsserviços.

## Pré-requisitos

1. **k6** - Ferramenta de teste de carga

   ```bash
   # Windows (winget)
   winget install k6 --source winget

   # Windows (Chocolatey)
   choco install k6

   # macOS
   brew install k6

   # Linux
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6
   ```

2. **Docker** - Para o Redis

   ```bash
   docker-compose up -d
   ```

3. **Serviços rodando**
   ```bash
   npm run dev
   ```

## Uso Rápido

### Comando único para rodar o teste:

```bash
cd load-tests
./run-load-test.sh --profile smoke
```

## Perfis de Teste

| Perfil      | Descrição               | Duração | Max VUs | Burst Rate |
| ----------- | ----------------------- | ------- | ------- | ---------- |
| `smoke`     | Validação rápida        | 3 min   | 5       | 10/s       |
| `load`      | Carga moderada (padrão) | 6 min   | 50      | 100/s      |
| `stress`    | Alta carga              | 6 min   | 100     | 200/s      |
| `spike`     | Picos extremos          | 6 min   | 50      | 500/s      |
| `endurance` | Longa duração           | 30 min  | 30      | 50/s       |

## Exemplos

```bash
# Teste rápido de validação
./run-load-test.sh --profile smoke

# Teste de carga padrão
./run-load-test.sh --profile load

# Teste de stress com configuração customizada
./run-load-test.sh --profile stress --max-vus 200

# Teste com output JSON para análise
./run-load-test.sh --profile load --json-output

# Teste sem monitoramento do Redis
./run-load-test.sh --profile smoke --no-monitor
```

## Cenários de Teste

O script configura 4 cenários executados em sequência:

### 1. Ramp-up (0s - 2m)

- Aumento gradual de 0 → MAX_VUs
- Mantém carga estável
- Redução gradual

### 2. Carga Constante (2m30s - 4m30s)

- VUs fixos por período determinado
- Simula uso normal do sistema

### 3. Pico de Tráfego (5m - 5m50s)

- Simula burst repentino
- Testa capacidade de absorver picos

### 4. Health Monitoring (0s - fim)

- Verifica saúde dos serviços continuamente

## Métricas Coletadas

### Métricas de Requisição

- **Latência** (avg, p50, p90, p95, p99)
- **Throughput** (req/s)
- **Taxa de erro** (%)
- **Status codes**

### Métricas Customizadas

- `orders_created` - Total de pedidos criados
- `orders_failed` - Total de falhas
- `events_published` - Eventos publicados
- `error_rate` - Taxa de erro
- `order_creation_latency` - Latência específica de criação

### Métricas do Redis (via monitor)

- Stream length
- Pending messages por grupo
- Lag dos consumidores
- Backlog de eventos

## Thresholds

O teste falha automaticamente se:

- p(95) de latência > 2000ms
- p(99) de latência > 5000ms
- Taxa de erro > 10%

## Arquivos Gerados

Após cada execução:

```
load-tests/results/
├── k6_output_YYYYMMDD_HHMMSS.log      # Log completo do k6
├── summary_YYYYMMDD_HHMMSS.json       # Sumário em JSON
├── redis_monitor_YYYYMMDD_HHMMSS.json # Log do Redis
└── redis_summary_YYYYMMDD_HHMMSS.txt  # Sumário do Redis
```

## Executando k6 Diretamente

Para executar apenas o script k6 sem o runner:

```bash
# Teste básico
k6 run load-test.js

# Com variáveis customizadas
k6 run \
  -e MAX_VUS=100 \
  -e BURST_RATE=200 \
  -e ORDER_SERVICE_URL=http://localhost:3001 \
  load-test.js

# Com output JSON
k6 run --out json=results.json load-test.js

# Com dashboard web
k6 run --out dashboard load-test.js
```

## Monitoramento do Redis

Para executar apenas o monitor:

```bash
./redis-monitor.sh
```

Comandos Redis úteis:

```bash
# Ver tamanho do stream
docker exec eda-redis redis-cli XLEN events-stream

# Ver grupos de consumidores
docker exec eda-redis redis-cli XINFO GROUPS events-stream

# Ver pending messages
docker exec eda-redis redis-cli XPENDING events-stream payment-service-group

# Ver últimos 10 eventos
docker exec eda-redis redis-cli XREVRANGE events-stream + - COUNT 10
```

## Interpretando Resultados

### Indicadores de Sucesso

- ✅ Latência p95 < 2s
- ✅ Taxa de erro < 5%
- ✅ Todos os pedidos eventualmente processados
- ✅ Lag dos consumidores estabiliza

### Indicadores de Problema

- ❌ Latência crescente durante o teste
- ❌ Backlog de eventos aumentando
- ❌ Health checks falhando
- ❌ Erros de conexão
