import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { publishEvent } from "../../../shared/eventPublisher";
import { OrderCreatedPayload, OrderItem } from "../../../shared/types";
import { validateOrder, formatOrderResponse } from "../utils/orderUtils";
import {
  createOrder as createOrderInDb,
  getOrderById,
  getAllOrders,
} from "../utils/orderRepository";

interface CreateOrderBody {
  customerId: string;
  items: OrderItem[];
  total: number;
}

interface GetOrderParams {
  id: string;
}

export async function registerOrderRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // Verificação de saúde
  fastify.get("/health", async () => {
    return { status: "ok", service: "order-service" };
  });

  // Criar pedido
  fastify.post<{ Body: CreateOrderBody }>(
    "/orders",
    {
      schema: {
        body: {
          type: "object",
          required: ["customerId", "items", "total"],
          properties: {
            customerId: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                required: ["productId", "quantity"],
                properties: {
                  productId: { type: "string" },
                  quantity: { type: "number", minimum: 1 },
                  price: { type: "number", minimum: 0 },
                },
              },
            },
            total: { type: "number", minimum: 0 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: CreateOrderBody }>,
      reply: FastifyReply
    ) => {
      const { customerId, items, total } = request.body;

      // Validar pedido
      const validation = validateOrder(customerId, items, total);
      if (!validation.valid) {
        return reply.status(400).send({ error: validation.error });
      }

      const orderId = uuidv4();
      const createdAt = new Date().toISOString();

      // Criar pedido no banco de dados
      const order = {
        id: orderId,
        customerId,
        items,
        total,
        status: "pending",
        createdAt,
      };

      try {
        createOrderInDb(order);
        request.log.info({ orderId }, "Pedido salvo no banco de dados");
      } catch (dbError) {
        request.log.error(
          { error: dbError },
          "Falha ao salvar pedido no banco"
        );
        return reply.status(500).send({ error: "Falha ao salvar pedido" });
      }

      // Publicar evento PedidoCriado
      const payload: OrderCreatedPayload = {
        orderId,
        customerId,
        items,
        total,
      };

      try {
        const eventId = await publishEvent(
          "OrderCreated",
          payload as Record<string, unknown>
        );
        request.log.info({ orderId, eventId }, "Evento PedidoCriado publicado");
      } catch (error) {
        request.log.error({ error }, "Falha ao publicar evento PedidoCriado");
        return reply.status(500).send({ error: "Falha ao processar pedido" });
      }

      return reply.status(201).send(formatOrderResponse(order));
    }
  );

  // Buscar pedido por ID
  fastify.get<{ Params: GetOrderParams }>(
    "/orders/:id",
    async (
      request: FastifyRequest<{ Params: GetOrderParams }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const order = getOrderById(id);

      if (!order) {
        return reply.status(404).send({ error: "Pedido não encontrado" });
      }

      return formatOrderResponse(order);
    }
  );

  // Listar todos os pedidos
  fastify.get("/orders", async () => {
    return getAllOrders().map(formatOrderResponse);
  });
}
