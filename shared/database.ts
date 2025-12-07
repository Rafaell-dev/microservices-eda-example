import Database, { Database as DatabaseType } from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";

/**
 * Cria uma conexão com o banco de dados SQLite
 * @param dbPath - Caminho para o arquivo do banco de dados
 * @returns Instância do banco de dados
 */
export function createDatabase(dbPath: string): DatabaseType {
  // Garantir que o diretório existe
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);

  // Habilitar foreign keys
  db.pragma("foreign_keys = ON");

  console.log(`[Database] Conectado ao banco: ${dbPath}`);

  return db;
}

/**
 * Inicializa as tabelas do Order Service
 */
export function initializeOrderTables(db: DatabaseType): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      total REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
  `);

  console.log("[Database] Tabelas de pedidos inicializadas");
}

/**
 * Inicializa as tabelas do Audit Service
 */
export function initializeAuditTables(db: DatabaseType): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      payload TEXT NOT NULL,
      received_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_received_at ON audit_logs(received_at);
  `);

  console.log("[Database] Tabelas de auditoria inicializadas");
}

/**
 * Fecha a conexão com o banco de dados
 */
export function closeDatabase(db: DatabaseType): void {
  if (db.open) {
    db.close();
    console.log("[Database] Conexão encerrada");
  }
}

export { DatabaseType };
