import { OrderItem } from "../../../shared/types";

interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateOrder(
  customerId: string,
  items: OrderItem[]
): ValidationResult {
  if (!customerId || customerId.trim() === "") {
    return { valid: false, error: "ID do cliente é obrigatório" };
  }

  if (!items || items.length === 0) {
    return { valid: false, error: "Pedido deve ter pelo menos um item" };
  }

  for (const item of items) {
    if (!item.productId || item.productId.trim() === "") {
      return { valid: false, error: "Cada item deve ter um ID de produto" };
    }
    if (!item.quantity || item.quantity < 1) {
      return {
        valid: false,
        error: "Cada item deve ter uma quantidade de pelo menos 1",
      };
    }
    if (item.price === undefined || item.price < 0) {
      return {
        valid: false,
        error: "Cada item deve ter um preço válido",
      };
    }
  }

  return { valid: true };
}

export function formatOrderResponse(order: {
  id: string;
  customerId: string;
  items: OrderItem[];
  total: number;
  status: string;
  createdAt: string;
}): object {
  return {
    id: order.id,
    customerId: order.customerId,
    items: order.items,
    total: order.total,
    status: order.status,
    createdAt: order.createdAt,
  };
}

export function calculateOrderTotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => {
    const price = item.price || 0;
    return sum + price * item.quantity;
  }, 0);
}
