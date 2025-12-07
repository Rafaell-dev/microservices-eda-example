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

// Store sent notifications for demo purposes
const notifications: Notification[] = [];

export function getNotifications(): Notification[] {
  return notifications;
}

export async function handleNotificationEvent(event: BaseEvent): Promise<void> {
  console.log(`[NotificationHandler] Processing event: ${event.eventType}`);

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
        `[NotificationHandler] Unknown event type: ${event.eventType}`
      );
  }
}

async function handlePaymentProcessed(event: BaseEvent): Promise<void> {
  const payload = event.payload as PaymentProcessedPayload;

  const notification: Notification = {
    id: event.eventId,
    type: "payment_success",
    recipient: "customer@example.com",
    subject: "Payment Confirmed",
    message: `Your payment of R$ ${payload.amount.toFixed(2)} for order ${
      payload.orderId
    } has been processed successfully via ${payload.method}.`,
    channel: "email",
    sentAt: new Date().toISOString(),
    orderId: payload.orderId,
  };

  await sendNotification(notification);
  console.log(
    `[NotificationHandler] ✅ Payment success notification sent for order: ${payload.orderId}`
  );
}

async function handlePaymentFailed(event: BaseEvent): Promise<void> {
  const payload = event.payload as PaymentFailedPayload;

  const notification: Notification = {
    id: event.eventId,
    type: "payment_failed",
    recipient: "customer@example.com",
    subject: "Payment Failed",
    message: `Your payment of R$ ${payload.amount.toFixed(2)} for order ${
      payload.orderId
    } has failed. Reason: ${payload.reason}. Please try again.`,
    channel: "email",
    sentAt: new Date().toISOString(),
    orderId: payload.orderId,
  };

  await sendNotification(notification);
  console.log(
    `[NotificationHandler] ❌ Payment failed notification sent for order: ${payload.orderId}`
  );
}

async function handleInventoryUpdated(event: BaseEvent): Promise<void> {
  const payload = event.payload as InventoryUpdatedPayload;

  // Check for low stock items
  const lowStockItems = payload.items.filter((item) => item.newStock < 10);

  if (lowStockItems.length > 0) {
    const notification: Notification = {
      id: event.eventId,
      type: "low_stock_alert",
      recipient: "warehouse@example.com",
      subject: "Low Stock Alert",
      message: `The following products are running low: ${lowStockItems
        .map((i) => `${i.productId} (${i.newStock} remaining)`)
        .join(", ")}`,
      channel: "email",
      sentAt: new Date().toISOString(),
      orderId: payload.orderId,
    };

    await sendNotification(notification);
    console.log(
      `[NotificationHandler] ⚠️ Low stock alert sent for order: ${payload.orderId}`
    );
  }

  // Order shipment notification
  const shipmentNotification: Notification = {
    id: `${event.eventId}-shipment`,
    type: "order_processing",
    recipient: "customer@example.com",
    subject: "Order Being Prepared",
    message: `Your order ${payload.orderId} is being prepared for shipment.`,
    channel: "push",
    sentAt: new Date().toISOString(),
    orderId: payload.orderId,
  };

  await sendNotification(shipmentNotification);
  console.log(
    `[NotificationHandler] 📦 Order processing notification sent for order: ${payload.orderId}`
  );
}

async function sendNotification(notification: Notification): Promise<void> {
  // Simulate sending notification
  await new Promise((resolve) => setTimeout(resolve, 100));

  notifications.push(notification);

  console.log(
    `[NotificationHandler] Sending ${notification.channel.toUpperCase()}: "${
      notification.subject
    }" to ${notification.recipient}`
  );
}
