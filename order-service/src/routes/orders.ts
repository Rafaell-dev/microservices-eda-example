import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { publishEvent } from "../../../shared/eventPublisher";
import { OrderCreatedPayload, OrderItem } from "../../../shared/types";
import { validateOrder, formatOrderResponse } from "../utils/orderUtils";

interface CreateOrderBody {
  customerId: string;
  items: OrderItem[];
  total: number;
}

interface GetOrderParams {
  id: string;
}

// In-memory order storage (for demo purposes)
const orders = new Map<
  string,
  {
    id: string;
    customerId: string;
    items: OrderItem[];
    total: number;
    status: string;
    createdAt: string;
  }
>();

export async function registerOrderRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // Health check
  fastify.get("/health", async () => {
    return { status: "ok", service: "order-service" };
  });

  // Create order
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

      // Validate order
      const validation = validateOrder(customerId, items, total);
      if (!validation.valid) {
        return reply.status(400).send({ error: validation.error });
      }

      const orderId = uuidv4();
      const createdAt = new Date().toISOString();

      // Store order
      const order = {
        id: orderId,
        customerId,
        items,
        total,
        status: "pending",
        createdAt,
      };
      orders.set(orderId, order);

      // Publish OrderCreated event
      const payload: OrderCreatedPayload = {
        orderId,
        customerId,
        items,
        total,
      };

      try {
        const eventId = await publishEvent("OrderCreated", payload);
        request.log.info({ orderId, eventId }, "OrderCreated event published");
      } catch (error) {
        request.log.error({ error }, "Failed to publish OrderCreated event");
        return reply.status(500).send({ error: "Failed to process order" });
      }

      return reply.status(201).send(formatOrderResponse(order));
    }
  );

  // Get order by ID
  fastify.get<{ Params: GetOrderParams }>(
    "/orders/:id",
    async (
      request: FastifyRequest<{ Params: GetOrderParams }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const order = orders.get(id);

      if (!order) {
        return reply.status(404).send({ error: "Order not found" });
      }

      return formatOrderResponse(order);
    }
  );

  // List all orders
  fastify.get("/orders", async () => {
    return Array.from(orders.values()).map(formatOrderResponse);
  });
}
