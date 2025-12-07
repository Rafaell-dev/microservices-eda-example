import { publishEvent } from "../../../shared/eventPublisher";
import {
  BaseEvent,
  OrderCreatedPayload,
  InventoryUpdatedPayload,
} from "../../../shared/types";

// Armazenamento de estoque simulado
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
    console.log(
      `[HandlerEstoque] Ignorando tipo de evento: ${event.eventType}`
    );
    return;
  }

  const payload = event.payload as OrderCreatedPayload;
  console.log(
    `[HandlerEstoque] Processando estoque para pedido: ${payload.orderId}`
  );

  // Simular atraso no processamento
  await simulateProcessingDelay();

  const updatedItems: Array<{
    productId: string;
    quantity: number;
    newStock: number;
  }> = [];

  // Atualizar estoque para cada item
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
      `[HandlerEstoque] Produto ${item.productId}: ${currentStock} -> ${newStock}`
    );
  }

  // Publicar evento EstoqueAtualizado
  const inventoryPayload: InventoryUpdatedPayload = {
    orderId: payload.orderId,
    items: updatedItems,
  };

  await publishEvent("InventoryUpdated", inventoryPayload);
  console.log(
    `[HandlerEstoque] Estoque atualizado para pedido: ${payload.orderId}`
  );
}

async function simulateProcessingDelay(): Promise<void> {
  const delay = Math.floor(Math.random() * 1000) + 200; // 200-1200ms
  return new Promise((resolve) => setTimeout(resolve, delay));
}
