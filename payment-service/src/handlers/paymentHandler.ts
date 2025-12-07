import { v4 as uuidv4 } from "uuid";
import { publishEvent } from "../../../shared/eventPublisher";
import {
  BaseEvent,
  OrderCreatedPayload,
  PaymentProcessedPayload,
  PaymentFailedPayload,
} from "../../../shared/types";

// Métodos de pagamento simulados
const PAYMENT_METHODS = ["credit_card", "debit_card", "pix", "boleto"];

// Taxa de falha simulada (20% de chance de falha)
const FAILURE_RATE = 0.2;

export async function handlePaymentEvent(event: BaseEvent): Promise<void> {
  if (event.eventType !== "OrderCreated") {
    console.log(
      `[HandlerPagamento] Ignorando tipo de evento: ${event.eventType}`
    );
    return;
  }

  const payload = event.payload as OrderCreatedPayload;
  console.log(
    `[HandlerPagamento] Processando pagamento para pedido: ${payload.orderId}`
  );

  // Simular atraso no processamento de pagamento
  await simulateProcessingDelay();

  // Simular sucesso/falha aleatório do pagamento
  const isSuccess = Math.random() > FAILURE_RATE;

  if (isSuccess) {
    const paymentPayload: PaymentProcessedPayload = {
      orderId: payload.orderId,
      paymentId: uuidv4(),
      amount: payload.total,
      method:
        PAYMENT_METHODS[Math.floor(Math.random() * PAYMENT_METHODS.length)],
    };

    await publishEvent("PaymentProcessed", paymentPayload);
    console.log(
      `[HandlerPagamento] Pagamento processado com sucesso para pedido: ${payload.orderId}`
    );
  } else {
    const failureReasons = [
      "Saldo insuficiente",
      "Cartão recusado",
      "Tempo limite da transação",
      "Dados de pagamento inválidos",
    ];

    const failedPayload: PaymentFailedPayload = {
      orderId: payload.orderId,
      reason: failureReasons[Math.floor(Math.random() * failureReasons.length)],
      amount: payload.total,
    };

    await publishEvent("PaymentFailed", failedPayload);
    console.log(
      `[HandlerPagamento] Pagamento falhou para pedido: ${payload.orderId} - ${failedPayload.reason}`
    );
  }
}

async function simulateProcessingDelay(): Promise<void> {
  const delay = Math.floor(Math.random() * 2000) + 500; // 500-2500ms
  return new Promise((resolve) => setTimeout(resolve, delay));
}
