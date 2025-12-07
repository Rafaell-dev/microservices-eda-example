import { OrderItem } from "../../../shared/types";

interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateOrder(
  customerId: string,
  items: OrderItem[],
  total: number
): ValidationResult {
  if (!customerId || customerId.trim() === "") {
    return { valid: false, error: "Customer ID is required" };
  }

  if (!items || items.length === 0) {
    return { valid: false, error: "Order must have at least one item" };
  }

  for (const item of items) {
    if (!item.productId || item.productId.trim() === "") {
      return { valid: false, error: "Each item must have a product ID" };
    }
    if (!item.quantity || item.quantity < 1) {
      return {
        valid: false,
        error: "Each item must have a quantity of at least 1",
      };
    }
  }

  if (total < 0) {
    return { valid: false, error: "Total cannot be negative" };
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
