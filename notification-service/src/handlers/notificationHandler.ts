import {
  BaseEvent,
  PaymentProcessedPayload,
  PaymentFailedPayload,
  InventoryUpdatedPayload,
} from "../../../shared/types";

interface Notification {
  id: string;
  type: string;
  recipient: string;
  subject: string;
  message: string;
  channel: "email" | "sms" | "push";
  sentAt: string;
  orderId: string;
}

// Armazenar notificações enviadas para fins de demonstração
const notifications: Notification[] = [];

export function getNotifications(): Notification[] {
  return notifications;
}

export async function handleNotificationEvent(event: BaseEvent): Promise<void> {
  console.log(`[HandlerNotificação] Processando evento: ${event.eventType}`);

  switch (event.eventType) {
    case "PaymentProcessed":
      await handlePaymentProcessed(event);
      break;
    case "PaymentFailed":
      await handlePaymentFailed(event);
      break;
    case "InventoryUpdated":
      await handleInventoryUpdated(event);
      break;
    default:
      console.log(
        `[HandlerNotificação] Tipo de evento desconhecido: ${event.eventType}`
      );
  }
}

async function handlePaymentProcessed(event: BaseEvent): Promise<void> {
  const payload = event.payload as PaymentProcessedPayload;

  const notification: Notification = {
    id: event.eventId,
    type: "payment_success",
    recipient: "customer@example.com",
    subject: "Pagamento Confirmado",
    message: `Your payment of R$ ${payload.amount.toFixed(2)} for order ${
      payload.orderId
    } has been processed successfully via ${payload.method}.`,
    channel: "email",
    sentAt: new Date().toISOString(),
    orderId: payload.orderId,
  };

  await sendNotification(notification);
  console.log(
    `[HandlerNotificação] ✅ Notificação de sucesso de pagamento enviada para pedido: ${payload.orderId}`
  );
}

async function handlePaymentFailed(event: BaseEvent): Promise<void> {
  const payload = event.payload as PaymentFailedPayload;

  const notification: Notification = {
    id: event.eventId,
    type: "payment_failed",
    recipient: "customer@example.com",
    subject: "Pagamento Falhou",
    message: `Your payment of R$ ${payload.amount.toFixed(2)} for order ${
      payload.orderId
    } has failed. Reason: ${payload.reason}. Please try again.`,
    channel: "email",
    sentAt: new Date().toISOString(),
    orderId: payload.orderId,
  };

  await sendNotification(notification);
  console.log(
    `[HandlerNotificação] ❌ Notificação de falha de pagamento enviada para pedido: ${payload.orderId}`
  );
}

async function handleInventoryUpdated(event: BaseEvent): Promise<void> {
  const payload = event.payload as InventoryUpdatedPayload;

  // Verificar itens com estoque baixo
  const lowStockItems = payload.items.filter((item) => item.newStock < 10);

  if (lowStockItems.length > 0) {
    const notification: Notification = {
      id: event.eventId,
      type: "low_stock_alert",
      recipient: "warehouse@example.com",
      subject: "Alerta de Estoque Baixo",
      message: `The following products are running low: ${lowStockItems
        .map((i) => `${i.productId} (${i.newStock} remaining)`)
        .join(", ")}`,
      channel: "email",
      sentAt: new Date().toISOString(),
      orderId: payload.orderId,
    };

    await sendNotification(notification);
    console.log(
      `[HandlerNotificação] ⚠️ Alerta de estoque baixo enviado para pedido: ${payload.orderId}`
    );
  }

  // Notificação de envio do pedido
  const shipmentNotification: Notification = {
    id: `${event.eventId}-shipment`,
    type: "order_processing",
    recipient: "customer@example.com",
    subject: "Pedido em Preparação",
    message: `Your order ${payload.orderId} is being prepared for shipment.`,
    channel: "push",
    sentAt: new Date().toISOString(),
    orderId: payload.orderId,
  };

  await sendNotification(shipmentNotification);
  console.log(
    `[HandlerNotificação] 📦 Notificação de processamento de pedido enviada para pedido: ${payload.orderId}`
  );
}

async function sendNotification(notification: Notification): Promise<void> {
  // Simular envio de notificação
  await new Promise((resolve) => setTimeout(resolve, 100));

  notifications.push(notification);

  console.log(
    `[HandlerNotificação] Enviando ${notification.channel.toUpperCase()}: "${
      notification.subject
    }" para ${notification.recipient}`
  );
}
