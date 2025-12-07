import { v4 as uuidv4 } from "uuid";
import { publishEvent } from "../../../shared/eventPublisher";
import { OrderCreatedPayload, OrderItem } from "../../../shared/types";
import { validateOrder, calculateOrderTotal } from "../utils/orderUtils";
import * as orderRepository from "./orderRepository";

export interface CreateOrderInput {
  customerId: string;
  items: OrderItem[];
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  total: number;
  status: string;
  createdAt: string;
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Cria um novo pedido
 */
export async function createOrder(
  input: CreateOrderInput
): Promise<ServiceResult<Order>> {
  const { customerId, items } = input;

  // Validar pedido
  const validation = validateOrder(customerId, items);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Calcular total
  const total = calculateOrderTotal(items);

  // Criar pedido
  const order: Order = {
    id: uuidv4(),
    customerId,
    items,
    total,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  // Salvar no banco de dados
  try {
    orderRepository.createOrder(order);
  } catch (error) {
    return {
      success: false,
      error: "Falha ao salvar pedido no banco de dados",
    };
  }

  // Publicar evento
  const payload: OrderCreatedPayload = {
    orderId: order.id,
    customerId: order.customerId,
    items: order.items,
    total: order.total,
  };

  try {
    await publishEvent("OrderCreated", payload as Record<string, unknown>);
  } catch (error) {
    return { success: false, error: "Falha ao publicar evento do pedido" };
  }

  return { success: true, data: order };
}

/**
 * Busca um pedido por ID
 */
export function getOrderById(orderId: string): ServiceResult<Order> {
  const order = orderRepository.getOrderById(orderId);

  if (!order) {
    return { success: false, error: "Pedido não encontrado" };
  }

  return { success: true, data: order };
}

/**
 * Lista todos os pedidos
 */
export function getAllOrders(): Order[] {
  return orderRepository.getAllOrders();
}

/**
 * Atualiza o status de um pedido
 */
export function updateOrderStatus(
  orderId: string,
  status: string
): ServiceResult<void> {
  const updated = orderRepository.updateOrderStatus(orderId, status);

  if (!updated) {
    return { success: false, error: "Pedido não encontrado" };
  }

  return { success: true };
}
