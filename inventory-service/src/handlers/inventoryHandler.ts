import { publishEvent } from "../../../shared/eventPublisher";
import {
  BaseEvent,
  OrderCreatedPayload,
  InventoryUpdatedPayload,
} from "../../../shared/types";

// Simulated inventory storage
const inventory = new Map<string, number>([
  ["prod-1", 100],
  ["prod-2", 50],
  ["prod-3", 200],
  ["prod-4", 75],
  ["prod-5", 30],
]);

export function getInventory(): Record<string, number> {
  const result: Record<string, number> = {};
  inventory.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export async function handleInventoryEvent(event: BaseEvent): Promise<void> {
  if (event.eventType !== "OrderCreated") {
    console.log(`[InventoryHandler] Ignoring event type: ${event.eventType}`);
    return;
  }

  const payload = event.payload as OrderCreatedPayload;
  console.log(
    `[InventoryHandler] Processing inventory for order: ${payload.orderId}`
  );

  // Simulate processing delay
  await simulateProcessingDelay();

  const updatedItems: Array<{
    productId: string;
    quantity: number;
    newStock: number;
  }> = [];

  // Update inventory for each item
  for (const item of payload.items) {
    const currentStock = inventory.get(item.productId) || 0;
    const newStock = Math.max(0, currentStock - item.quantity);

    inventory.set(item.productId, newStock);

    updatedItems.push({
      productId: item.productId,
      quantity: item.quantity,
      newStock,
    });

    console.log(
      `[InventoryHandler] Product ${item.productId}: ${currentStock} -> ${newStock}`
    );
  }

  // Publish InventoryUpdated event
  const inventoryPayload: InventoryUpdatedPayload = {
    orderId: payload.orderId,
    items: updatedItems,
  };

  await publishEvent("InventoryUpdated", inventoryPayload);
  console.log(
    `[InventoryHandler] Inventory updated for order: ${payload.orderId}`
  );
}

async function simulateProcessingDelay(): Promise<void> {
  const delay = Math.floor(Math.random() * 1000) + 200; // 200-1200ms
  return new Promise((resolve) => setTimeout(resolve, delay));
}
