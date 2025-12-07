import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ============================================================================
// MÉTRICAS CUSTOMIZADAS
// ============================================================================

// Contadores
const ordersCreated = new Counter('orders_created');
const ordersFailed = new Counter('orders_failed');
const eventsPublished = new Counter('events_published');

// Taxas
const errorRate = new Rate('error_rate');
const successRate = new Rate('success_rate');

// Tendências (latência)
const orderLatency = new Trend('order_creation_latency', true);
const healthCheckLatency = new Trend('health_check_latency', true);

// Gauges
const activeVUs = new Gauge('active_vus');

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const CONFIG = {
    ORDER_SERVICE_URL: __ENV.ORDER_SERVICE_URL || 'http://localhost:3001',
    AUDIT_SERVICE_URL: __ENV.AUDIT_SERVICE_URL || 'http://localhost:3005',

    // Produtos para simulação
    PRODUCTS: [
        { productId: 'prod-001', price: 29.90 },
        { productId: 'prod-002', price: 49.90 },
        { productId: 'prod-003', price: 99.90 },
        { productId: 'prod-004', price: 149.90 },
        { productId: 'prod-005', price: 199.90 },
    ],
};

// ============================================================================
// CENÁRIOS DE TESTE
// ============================================================================

export const options = {
    scenarios: {
        // Cenário 1: Ramp-up gradual
        ramp_up: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: __ENV.RAMP_UP_DURATION || '30s', target: parseInt(__ENV.MAX_VUS) || 50 },
                { duration: __ENV.STEADY_DURATION || '1m', target: parseInt(__ENV.MAX_VUS) || 50 },
                { duration: __ENV.RAMP_DOWN_DURATION || '30s', target: 0 },
            ],
            gracefulRampDown: '10s',
            exec: 'createOrderScenario',
            startTime: '0s',
        },

        // Cenário 2: Carga constante
        constant_load: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.CONSTANT_VUS) || 20,
            duration: __ENV.CONSTANT_DURATION || '2m',
            exec: 'createOrderScenario',
            startTime: __ENV.CONSTANT_START || '2m30s',
        },

        // Cenário 3: Pico de tráfego (burst)
        traffic_spike: {
            executor: 'ramping-arrival-rate',
            startRate: 10,
            timeUnit: '1s',
            preAllocatedVUs: parseInt(__ENV.BURST_VUS) || 100,
            maxVUs: parseInt(__ENV.BURST_MAX_VUS) || 200,
            stages: [
                { duration: '10s', target: 10 },
                { duration: '10s', target: parseInt(__ENV.BURST_RATE) || 100 }, // Spike!
                { duration: '20s', target: parseInt(__ENV.BURST_RATE) || 100 },
                { duration: '10s', target: 10 },
            ],
            exec: 'createOrderScenario',
            startTime: __ENV.BURST_START || '5m',
        },

        // Cenário 4: Health check contínuo
        health_monitoring: {
            executor: 'constant-arrival-rate',
            rate: 1,
            timeUnit: '5s',
            duration: __ENV.TOTAL_DURATION || '6m',
            preAllocatedVUs: 2,
            exec: 'healthCheckScenario',
            startTime: '0s',
        },
    },

    thresholds: {
        http_req_duration: ['p(95)<2000', 'p(99)<5000'],
        http_req_failed: ['rate<0.1'],
        error_rate: ['rate<0.1'],
        order_creation_latency: ['p(95)<3000'],
    },

    // Configurações de saída
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

function generateOrder() {
    const numItems = randomIntBetween(1, 5);
    const items = [];

    for (let i = 0; i < numItems; i++) {
        const product = CONFIG.PRODUCTS[randomIntBetween(0, CONFIG.PRODUCTS.length - 1)];
        items.push({
            productId: product.productId,
            quantity: randomIntBetween(1, 10),
            price: product.price,
        });
    }

    return {
        customerId: `cust-${randomIntBetween(1, 1000).toString().padStart(4, '0')}`,
        items: items,
    };
}

function logResult(scenario, success, duration, statusCode, orderId = null) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        scenario: scenario,
        success: success,
        duration_ms: duration,
        status_code: statusCode,
        order_id: orderId,
        vu: __VU,
        iter: __ITER,
    };

    console.log(JSON.stringify(logEntry));
}

// ============================================================================
// CENÁRIOS
// ============================================================================

export function createOrderScenario() {
    activeVUs.add(__VU);

    const order = generateOrder();
    const payload = JSON.stringify(order);

    const params = {
        headers: {
            'Content-Type': 'application/json',
        },
        tags: { scenario: 'create_order' },
    };

    const startTime = Date.now();
    const response = http.post(`${CONFIG.ORDER_SERVICE_URL}/orders`, payload, params);
    const duration = Date.now() - startTime;

    orderLatency.add(duration);

    const success = check(response, {
        'status is 201': (r) => r.status === 201,
        'has order id': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body.id !== undefined;
            } catch (e) {
                return false;
            }
        },
        'has correct status': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body.status === 'pending';
            } catch (e) {
                return false;
            }
        },
    });

    if (success) {
        ordersCreated.add(1);
        successRate.add(1);
        errorRate.add(0);
        eventsPublished.add(1);

        try {
            const body = JSON.parse(response.body);
            logResult('create_order', true, duration, response.status, body.id);
        } catch (e) {
            logResult('create_order', true, duration, response.status);
        }
    } else {
        ordersFailed.add(1);
        successRate.add(0);
        errorRate.add(1);
        logResult('create_order', false, duration, response.status);
    }

    // Simula tempo de "think time" do usuário
    sleep(randomIntBetween(1, 3));
}

export function healthCheckScenario() {
    const services = [
        { name: 'order', url: CONFIG.ORDER_SERVICE_URL },
        { name: 'audit', url: CONFIG.AUDIT_SERVICE_URL },
    ];

    for (const service of services) {
        const startTime = Date.now();
        const response = http.get(`${service.url}/health`, {
            tags: { scenario: 'health_check', service: service.name },
        });
        const duration = Date.now() - startTime;

        healthCheckLatency.add(duration);

        check(response, {
            [`${service.name} is healthy`]: (r) => r.status === 200,
        });
    }
}

// ============================================================================
// SETUP E TEARDOWN
// ============================================================================

export function setup() {
    console.log('='.repeat(60));
    console.log('TESTE DE CARGA - EDA ORDER PROCESSING SYSTEM');
    console.log('='.repeat(60));
    console.log(JSON.stringify({
        event: 'test_start',
        timestamp: new Date().toISOString(),
        config: {
            order_service_url: CONFIG.ORDER_SERVICE_URL,
            audit_service_url: CONFIG.AUDIT_SERVICE_URL,
            max_vus: __ENV.MAX_VUS || 50,
            constant_vus: __ENV.CONSTANT_VUS || 20,
            burst_rate: __ENV.BURST_RATE || 100,
        },
    }));

    // Verificar se os serviços estão online
    const orderHealth = http.get(`${CONFIG.ORDER_SERVICE_URL}/health`);
    if (orderHealth.status !== 200) {
        throw new Error('Order Service não está disponível!');
    }

    return { startTime: new Date().toISOString() };
}

export function teardown(data) {
    console.log('='.repeat(60));
    console.log('TESTE FINALIZADO');
    console.log('='.repeat(60));
    console.log(JSON.stringify({
        event: 'test_end',
        timestamp: new Date().toISOString(),
        start_time: data.startTime,
    }));
}

// ============================================================================
// HANDLER PADRÃO (para execução sem cenários específicos)
// ============================================================================

export default function () {
    createOrderScenario();
}
