# EDA Order Processing System

Sistema de processamento de pedidos usando **Arquitetura Orientada a Eventos (EDA)** com **Node.js**, **Fastify**, **TypeScript** e **Redis Streams**.

## 📋 Arquitetura

```
┌─────────────────┐     ┌──────────────────────────────────────────────────────┐
│   HTTP Client   │     │                    Redis Streams                      │
│   (curl/API)    │     │                     :6379                            │
└────────┬────────┘     └───────────────────────┬──────────────────────────────┘
         │                                      │
         ▼                                      │
┌─────────────────┐                             │
│  order-service  │──── OrderCreated ──────────►│
│     :3001       │◄─── PaymentProcessed ───────┤  (atualiza status)
│     [SQLite]    │◄─── PaymentFailed ──────────┤
└─────────────────┘                             │
                                                │
         ┌──────────────────────────────────────┤
         │                                      │
         ▼                                      │
┌─────────────────┐                             │
│ payment-service │◄─── OrderCreated ───────────┤
│     :3002       │                             │
│                 │──── PaymentProcessed ──────►│
│                 │──── PaymentFailed ─────────►│
└─────────────────┘                             │
                                                │
         ┌──────────────────────────────────────┤
         │                                      │
         ▼                                      │
┌─────────────────┐                             │
│inventory-service│◄─── OrderCreated ───────────┤
│     :3003       │                             │
│                 │──── InventoryUpdated ──────►│
└─────────────────┘                             │
                                                │
         ┌──────────────────────────────────────┤
         │                                      │
         ▼                                      │
┌─────────────────┐                             │
│notification-svc │◄─── PaymentProcessed ───────┤
│     :3004       │◄─── PaymentFailed ──────────┤
│                 │◄─── InventoryUpdated ───────┤
└─────────────────┘                             │
                                                │
         ┌──────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  audit-service  │◄─── ALL EVENTS
│     :3005       │
│     [SQLite]    │
└─────────────────┘
```

## 🚀 Como Executar

### Pré-requisitos

- Node.js 18+
- Docker e Docker Compose
- npm

### Início Rápido

```bash
# 1. Iniciar Redis
docker-compose up -d

# 2. Instalar dependências
npm run install:all

# 3. Iniciar todos os serviços
npm run dev
```

### Instalação Manual

```bash
# Shared modules
cd shared && npm install && cd ..

# Cada serviço
cd order-service && npm install && cd ..
cd payment-service && npm install && cd ..
cd inventory-service && npm install && cd ..
cd notification-service && npm install && cd ..
cd audit-service && npm install && cd ..
```

## ⚙️ Configuração

Cada serviço possui um arquivo `.env.example`. Copie para `.env` e ajuste:

```bash
cp order-service/.env.example order-service/.env
```

### Variáveis de Ambiente

| Variável           | Descrição         | Padrão        |
| ------------------ | ----------------- | ------------- |
| `PORT`             | Porta do serviço  | 3001-3005     |
| `REDIS_HOST`       | Host do Redis     | localhost     |
| `REDIS_PORT`       | Porta do Redis    | 6379          |
| `REDIS_PASSWORD`   | Senha do Redis    | -             |
| `REDIS_STREAM_KEY` | Nome do stream    | events-stream |
| `DATABASE_PATH`    | Caminho do SQLite | ./data/\*.db  |

## 📡 Endpoints da API

### Order Service (:3001)

| Método | Endpoint      | Descrição               |
| ------ | ------------- | ----------------------- |
| POST   | `/orders`     | Criar novo pedido       |
| GET    | `/orders/:id` | Buscar pedido por ID    |
| GET    | `/orders`     | Listar todos os pedidos |
| GET    | `/health`     | Health check            |

### Payment Service (:3002)

| Método | Endpoint  | Descrição    |
| ------ | --------- | ------------ |
| GET    | `/health` | Health check |

### Inventory Service (:3003)

| Método | Endpoint     | Descrição         |
| ------ | ------------ | ----------------- |
| GET    | `/inventory` | Ver estoque atual |
| GET    | `/health`    | Health check      |

### Notification Service (:3004)

| Método | Endpoint         | Descrição                 |
| ------ | ---------------- | ------------------------- |
| GET    | `/notifications` | Ver notificações enviadas |
| GET    | `/health`        | Health check              |

### Audit Service (:3005)

| Método | Endpoint                        | Descrição             |
| ------ | ------------------------------- | --------------------- |
| GET    | `/audit`                        | Ver logs de auditoria |
| GET    | `/audit?limit=10`               | Ver últimos 10 logs   |
| GET    | `/audit?eventType=OrderCreated` | Filtrar por tipo      |
| GET    | `/audit/stats`                  | Ver estatísticas      |
| GET    | `/health`                       | Health check          |

## 🧪 Exemplos de Uso

### Criar um Pedido

```bash
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cust-001",
    "items": [
      { "productId": "prod-1", "quantity": 2, "price": 49.90 },
      { "productId": "prod-2", "quantity": 1, "price": 99.90 }
    ]
  }'
```

> **Nota:** O `total` é calculado automaticamente pela aplicação.

### Verificar Status do Pedido

```bash
curl http://localhost:3001/orders/{orderId}
```

**Status possíveis:**

- `pending` - Aguardando pagamento
- `paid` - Pagamento confirmado
- `payment_failed` - Pagamento recusado

### Ver Estatísticas de Auditoria

```bash
curl http://localhost:3005/audit/stats
```

## 🧪 Testes de Carga

O projeto inclui uma suite completa de testes de carga com k6:

```bash
cd load-tests

# Teste rápido (30s)
npm run test:simple

# Smoke test (3 min)
npm run test:smoke

# Teste de stress
npm run test:stress
```

Para mais detalhes, veja [load-tests/README.md](load-tests/README.md).

## 📦 Estrutura do Projeto

```
EDA/
├── docker-compose.yml
├── package.json
├── README.md
├── EDA_Order_Processing.postman_collection.json
│
├── shared/                     # Módulos compartilhados
│   ├── types.ts               # Interfaces TypeScript
│   ├── redisClient.ts         # Conexão Redis
│   ├── eventPublisher.ts      # Publicar eventos
│   ├── eventConsumer.ts       # Consumir eventos
│   ├── database.ts            # Conexão SQLite
│   └── index.ts
│
├── order-service/              # Serviço de pedidos
│   ├── src/
│   │   ├── index.ts
│   │   ├── orders/
│   │   │   ├── orderRoutes.ts      # Rotas + Swagger
│   │   │   ├── orderController.ts  # Controller
│   │   │   ├── orderService.ts     # Lógica de negócio
│   │   │   └── orderRepository.ts  # Acesso ao banco
│   │   ├── handlers/
│   │   │   └── orderEventHandler.ts
│   │   └── utils/
│   ├── data/orders.db          # Banco SQLite
│   └── .env.example
│
├── payment-service/
├── inventory-service/
├── notification-service/
│
├── audit-service/
│   ├── src/
│   │   ├── handlers/
│   │   │   ├── auditHandler.ts
│   │   │   └── auditRepository.ts
│   ├── data/audit.db           # Banco SQLite
│   └── .env.example
│
└── load-tests/                 # Testes de carga
    ├── load-test.js
    ├── k6.exe
    └── README.md
```

## 🔄 Fluxo de Eventos

1. **Cliente** envia POST `/orders` para **order-service**
2. **order-service** salva pedido no SQLite e publica `OrderCreated`
3. **payment-service** consome `OrderCreated`:
   - Processa pagamento (simulado)
   - Publica `PaymentProcessed` ou `PaymentFailed`
4. **order-service** consome eventos de pagamento:
   - Atualiza status para `paid` ou `payment_failed`
5. **inventory-service** consome `OrderCreated`:
   - Atualiza estoque
   - Publica `InventoryUpdated`
6. **notification-service** consome eventos de pagamento e inventário:
   - Envia notificações (simulado via log)
7. **audit-service** consome TODOS os eventos:
   - Persiste em SQLite para auditoria

## 💾 Persistência

| Serviço       | Tipo    | Arquivo          |
| ------------- | ------- | ---------------- |
| order-service | SQLite  | `data/orders.db` |
| audit-service | SQLite  | `data/audit.db`  |
| Outros        | Memória | -                |

## 📝 Formato dos Eventos

```json
{
  "eventId": "uuid-v4",
  "eventType": "OrderCreated",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "payload": {}
}
```

**Tipos de eventos:**

- `OrderCreated`
- `PaymentProcessed`
- `PaymentFailed`
- `InventoryUpdated`

## ✅ Idempotência

Os consumidores implementam verificação de idempotência:

- Cada evento processado tem seu `eventId` armazenado
- Eventos duplicados são ignorados automaticamente
- Garante processamento exactly-once

## 🛑 Parando o Projeto

```bash
# Parar containers
docker-compose down

# Remover volumes (dados Redis)
docker-compose down -v
```

## 📄 Licença

MIT
