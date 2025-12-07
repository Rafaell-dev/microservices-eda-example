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
│     :3001       │                             │
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
└─────────────────┘
```

## 🚀 Como Executar

### Pré-requisitos

- Node.js 18+
- Docker e Docker Compose
- npm ou yarn

### 1. Iniciar o Redis

```bash
docker-compose up -d
```

### 2. Instalar Dependências

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

### 3. Iniciar os Serviços

Abra um terminal para cada serviço:

```bash
# Terminal 1 - Order Service
cd order-service && npm run dev

# Terminal 2 - Payment Service
cd payment-service && npm run dev

# Terminal 3 - Inventory Service
cd inventory-service && npm run dev

# Terminal 4 - Notification Service
cd notification-service && npm run dev

# Terminal 5 - Audit Service
cd audit-service && npm run dev
```

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

## 🧪 Exemplos de Teste

### Criar um Pedido

```bash
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cust-001",
    "items": [
      { "productId": "prod-1", "quantity": 2, "price": 49.90 },
      { "productId": "prod-2", "quantity": 1, "price": 99.90 }
    ],
    "total": 199.70
  }'
```

### Verificar Estoque

```bash
curl http://localhost:3003/inventory
```

### Ver Notificações

```bash
curl http://localhost:3004/notifications
```

### Ver Logs de Auditoria

```bash
curl http://localhost:3005/audit
```

### Ver Estatísticas

```bash
curl http://localhost:3005/audit/stats
```

## 📦 Estrutura do Projeto

```
EDA/
├── docker-compose.yml          # Container Redis
├── README.md                   # Este arquivo
├── shared/                     # Módulos compartilhados
│   ├── types.ts               # Interfaces TypeScript
│   ├── redisClient.ts         # Conexão Redis
│   ├── eventPublisher.ts      # Publicar eventos
│   ├── eventConsumer.ts       # Consumir eventos
│   └── index.ts               # Barrel export
├── order-service/              # Serviço de pedidos
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/orders.ts
│   │   └── utils/orderUtils.ts
│   ├── package.json
│   └── tsconfig.json
├── payment-service/            # Serviço de pagamento
│   ├── src/
│   │   ├── index.ts
│   │   └── handlers/paymentHandler.ts
│   ├── package.json
│   └── tsconfig.json
├── inventory-service/          # Serviço de inventário
│   ├── src/
│   │   ├── index.ts
│   │   └── handlers/inventoryHandler.ts
│   ├── package.json
│   └── tsconfig.json
├── notification-service/       # Serviço de notificações
│   ├── src/
│   │   ├── index.ts
│   │   └── handlers/notificationHandler.ts
│   ├── package.json
│   └── tsconfig.json
└── audit-service/              # Serviço de auditoria
    ├── src/
    │   ├── index.ts
    │   └── handlers/auditHandler.ts
    ├── data/audit.json         # Dados persistidos
    ├── package.json
    └── tsconfig.json
```

## 🔄 Fluxo de Eventos

1. **Cliente** envia POST `/orders` para **order-service**
2. **order-service** publica evento `OrderCreated` no Redis Stream
3. **payment-service** consome `OrderCreated` e:
   - Processa pagamento (simulado)
   - Publica `PaymentProcessed` ou `PaymentFailed`
4. **inventory-service** consome `OrderCreated` e:
   - Atualiza estoque
   - Publica `InventoryUpdated`
5. **notification-service** consome eventos de pagamento e inventário:
   - Envia notificações (simulado via log)
6. **audit-service** consome TODOS os eventos:
   - Persiste em arquivo JSON para auditoria

## 📝 Formato dos Eventos

Todos os eventos seguem o padrão:

```json
{
  "eventId": "uuid-v4-gerado",
  "eventType": "OrderCreated",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "payload": {
    // dados específicos do evento
  }
}
```

## ✅ Idempotência

Os consumidores implementam verificação de idempotência:

- Cada evento processado tem seu `eventId` armazenado em um Set
- Eventos duplicados são ignorados automaticamente
- Garante processamento exactly-once

## 🛑 Parando o Projeto

```bash
# Parar containers
docker-compose down

# Para remover volumes (dados Redis)
docker-compose down -v
```

## 📄 Licença

MIT
