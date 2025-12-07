/**
 * Tipos de eventos para o sistema EDA
 */

export interface BaseEvent<T = Record<string, unknown>> {
  eventId: string;
  eventType: string;
  timestamp: string;
  payload: T;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  price?: number;
  [key: string]: unknown;
}

export interface OrderCreatedPayload {
  orderId: string;
  customerId: string;
  items: OrderItem[];
  total: number;
  [key: string]: unknown;
}

export interface OrderCreatedEvent extends BaseEvent<OrderCreatedPayload> {
  eventType: "OrderCreated";
}

export interface PaymentProcessedPayload {
  orderId: string;
  paymentId: string;
  amount: number;
  method: string;
  [key: string]: unknown;
}

export interface PaymentProcessedEvent
  extends BaseEvent<PaymentProcessedPayload> {
  eventType: "PaymentProcessed";
}

export interface PaymentFailedPayload {
  orderId: string;
  reason: string;
  amount: number;
  [key: string]: unknown;
}

export interface PaymentFailedEvent extends BaseEvent<PaymentFailedPayload> {
  eventType: "PaymentFailed";
}

export interface InventoryItemUpdate {
  productId: string;
  quantity: number;
  newStock: number;
  [key: string]: unknown;
}

export interface InventoryUpdatedPayload {
  orderId: string;
  items: InventoryItemUpdate[];
  [key: string]: unknown;
}

export interface InventoryUpdatedEvent
  extends BaseEvent<InventoryUpdatedPayload> {
  eventType: "InventoryUpdated";
}

export type EventTypes =
  | OrderCreatedEvent
  | PaymentProcessedEvent
  | PaymentFailedEvent
  | InventoryUpdatedEvent;

export interface EventHandler {
  (event: BaseEvent): Promise<void>;
}

export interface ConsumerConfig {
  streamKey: string;
  groupName: string;
  consumerName: string;
  eventTypes?: string[];
  handler: EventHandler;
}
