import {
  BaseEvent,
  PaymentProcessedPayload,
  PaymentFailedPayload,
} from "../../../shared/types";
import { updateOrderStatus, getOrderById } from "../orders/orderRepository";

/**
 * Handler para processar eventos de pagamento e atualizar status do pedido
 */
export async function handlePaymentEvents(event: BaseEvent): Promise<void> {
  switch (event.eventType) {
    case "PaymentProcessed":
      await handlePaymentProcessed(event);
      break;
    case "PaymentFailed":
      await handlePaymentFailed(event);
      break;
    default:
      console.log(`[HandlerPedido] Ignorando evento: ${event.eventType}`);
  }
}

async function handlePaymentProcessed(event: BaseEvent): Promise<void> {
  const payload = event.payload as PaymentProcessedPayload;
  const { orderId } = payload;

  const order = getOrderById(orderId);
  if (!order) {
    console.log(`[HandlerPedido] Pedido não encontrado: ${orderId}`);
    return;
  }

  const updated = updateOrderStatus(orderId, "paid");
  if (updated) {
    console.log(`[HandlerPedido] ✅ Status atualizado para 'paid': ${orderId}`);
  } else {
    console.log(`[HandlerPedido] Falha ao atualizar status: ${orderId}`);
  }
}

async function handlePaymentFailed(event: BaseEvent): Promise<void> {
  const payload = event.payload as PaymentFailedPayload;
  const { orderId, reason } = payload;

  const order = getOrderById(orderId);
  if (!order) {
    console.log(`[HandlerPedido] Pedido não encontrado: ${orderId}`);
    return;
  }

  const updated = updateOrderStatus(orderId, "payment_failed");
  if (updated) {
    console.log(
      `[HandlerPedido] ❌ Status atualizado para 'payment_failed': ${orderId} - ${reason}`
    );
  } else {
    console.log(`[HandlerPedido] Falha ao atualizar status: ${orderId}`);
  }
}
