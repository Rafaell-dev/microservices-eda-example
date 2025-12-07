import { Database as DatabaseType } from "better-sqlite3";
import { OrderItem } from "../../../shared/types";

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  total: number;
  status: string;
  createdAt: string;
}

interface OrderRow {
  id: string;
  customer_id: string;
  total: number;
  status: string;
  created_at: string;
}

interface OrderItemRow {
  id: number;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number | null;
}

let db: DatabaseType;

/**
 * Inicializa o repositório com a instância do banco
 */
export function initOrderRepository(database: DatabaseType): void {
  db = database;
}

/**
 * Cria um novo pedido com seus itens
 */
export function createOrder(order: Order): void {
  const insertOrder = db.prepare(`
    INSERT INTO orders (id, customer_id, total, status, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, quantity, price)
    VALUES (?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    insertOrder.run(
      order.id,
      order.customerId,
      order.total,
      order.status,
      order.createdAt
    );

    for (const item of order.items) {
      insertItem.run(
        order.id,
        item.productId,
        item.quantity,
        item.price ?? null
      );
    }
  });

  transaction();
}

/**
 * Busca um pedido por ID
 */
export function getOrderById(orderId: string): Order | null {
  const orderRow = db
    .prepare(
      `
    SELECT id, customer_id, total, status, created_at
    FROM orders
    WHERE id = ?
  `
    )
    .get(orderId) as OrderRow | undefined;

  if (!orderRow) {
    return null;
  }

  const itemRows = db
    .prepare(
      `
    SELECT id, order_id, product_id, quantity, price
    FROM order_items
    WHERE order_id = ?
  `
    )
    .all(orderId) as OrderItemRow[];

  return mapToOrder(orderRow, itemRows);
}

/**
 * Lista todos os pedidos
 */
export function getAllOrders(): Order[] {
  const orderRows = db
    .prepare(
      `
    SELECT id, customer_id, total, status, created_at
    FROM orders
    ORDER BY created_at DESC
  `
    )
    .all() as OrderRow[];

  return orderRows.map((orderRow) => {
    const itemRows = db
      .prepare(
        `
      SELECT id, order_id, product_id, quantity, price
      FROM order_items
      WHERE order_id = ?
    `
      )
      .all(orderRow.id) as OrderItemRow[];

    return mapToOrder(orderRow, itemRows);
  });
}

/**
 * Atualiza o status de um pedido
 */
export function updateOrderStatus(orderId: string, status: string): boolean {
  const result = db
    .prepare(
      `
    UPDATE orders
    SET status = ?
    WHERE id = ?
  `
    )
    .run(status, orderId);

  return result.changes > 0;
}

/**
 * Converte as linhas do banco para o objeto Order
 */
function mapToOrder(orderRow: OrderRow, itemRows: OrderItemRow[]): Order {
  return {
    id: orderRow.id,
    customerId: orderRow.customer_id,
    total: orderRow.total,
    status: orderRow.status,
    createdAt: orderRow.created_at,
    items: itemRows.map((item) => ({
      productId: item.product_id,
      quantity: item.quantity,
      price: item.price ?? undefined,
    })),
  };
}
