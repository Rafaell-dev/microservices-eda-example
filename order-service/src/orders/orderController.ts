import { FastifyRequest, FastifyReply } from "fastify";
import * as orderService from "./orderService";
import { formatOrderResponse } from "../utils/orderUtils";
import { OrderItem } from "../../../shared/types";

export interface CreateOrderBody {
  customerId: string;
  items: OrderItem[];
}

export interface GetOrderParams {
  id: string;
}

/**
 * Controller para criar um novo pedido
 */
export async function createOrder(
  request: FastifyRequest<{ Body: CreateOrderBody }>,
  reply: FastifyReply
) {
  const { customerId, items } = request.body;

  const result = await orderService.createOrder({ customerId, items });

  if (!result.success) {
    const statusCode = result.error?.includes("Falha ao") ? 500 : 400;
    return reply.status(statusCode).send({ error: result.error });
  }

  request.log.info({ orderId: result.data!.id }, "Pedido criado com sucesso");
  return reply.status(201).send(formatOrderResponse(result.data!));
}

/**
 * Controller para buscar pedido por ID
 */
export async function getOrderById(
  request: FastifyRequest<{ Params: GetOrderParams }>,
  reply: FastifyReply
) {
  const { id } = request.params;

  const result = orderService.getOrderById(id);

  if (!result.success) {
    return reply.status(404).send({ error: result.error });
  }

  return formatOrderResponse(result.data!);
}

/**
 * Controller para listar todos os pedidos
 */
export async function getAllOrders(
  _request: FastifyRequest,
  _reply: FastifyReply
) {
  const orders = orderService.getAllOrders();
  return orders.map(formatOrderResponse);
}
