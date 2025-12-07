import { FastifyInstance } from "fastify";
import * as orderController from "./orderController";

/**
 * Schema de validação e documentação Swagger para as rotas de pedidos
 */
const orderSchemas = {
  // Schema do item do pedido
  orderItem: {
    type: "object",
    required: ["productId", "quantity", "price"],
    properties: {
      productId: { type: "string", description: "ID do produto" },
      quantity: { type: "number", minimum: 1, description: "Quantidade" },
      price: { type: "number", minimum: 0, description: "Preço unitário" },
    },
  },

  // Schema de resposta do pedido
  orderResponse: {
    type: "object",
    properties: {
      id: { type: "string", description: "ID do pedido" },
      customerId: { type: "string", description: "ID do cliente" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            productId: { type: "string" },
            quantity: { type: "number" },
            price: { type: "number" },
          },
        },
      },
      total: { type: "number", description: "Total do pedido" },
      status: { type: "string", description: "Status do pedido" },
      createdAt: { type: "string", description: "Data de criação" },
    },
  },

  // Schema de erro
  errorResponse: {
    type: "object",
    properties: {
      error: { type: "string", description: "Mensagem de erro" },
    },
  },
};

/**
 * Registra as rotas de pedidos no Fastify
 */
export async function registerOrderRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // Verificação de saúde
  fastify.get("/health", {
    schema: {
      description: "Verificação de saúde do serviço",
      tags: ["Health"],
      response: {
        200: {
          type: "object",
          properties: {
            status: { type: "string" },
            service: { type: "string" },
          },
        },
      },
    },
    handler: async () => ({ status: "ok", service: "order-service" }),
  });

  // Criar pedido
  fastify.post("/orders", {
    schema: {
      description: "Cria um novo pedido",
      tags: ["Pedidos"],
      body: {
        type: "object",
        required: ["customerId", "items"],
        properties: {
          customerId: { type: "string", description: "ID do cliente" },
          items: {
            type: "array",
            minItems: 1,
            description: "Lista de itens do pedido",
            items: orderSchemas.orderItem,
          },
        },
      },
      response: {
        201: {
          description: "Pedido criado com sucesso",
          ...orderSchemas.orderResponse,
        },
        400: {
          description: "Dados inválidos",
          ...orderSchemas.errorResponse,
        },
        500: {
          description: "Erro interno do servidor",
          ...orderSchemas.errorResponse,
        },
      },
    },
    handler: orderController.createOrder,
  });

  // Buscar pedido por ID
  fastify.get("/orders/:id", {
    schema: {
      description: "Busca um pedido pelo ID",
      tags: ["Pedidos"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "ID do pedido" },
        },
      },
      response: {
        200: {
          description: "Pedido encontrado",
          ...orderSchemas.orderResponse,
        },
        404: {
          description: "Pedido não encontrado",
          ...orderSchemas.errorResponse,
        },
      },
    },
    handler: orderController.getOrderById,
  });

  // Listar todos os pedidos
  fastify.get("/orders", {
    schema: {
      description: "Lista todos os pedidos",
      tags: ["Pedidos"],
      response: {
        200: {
          description: "Lista de pedidos",
          type: "array",
          items: orderSchemas.orderResponse,
        },
      },
    },
    handler: orderController.getAllOrders,
  });
}
