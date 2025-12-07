import { Database as DatabaseType } from "better-sqlite3";
import { BaseEvent } from "../../../shared/types";

export interface AuditEntry {
  id: string;
  eventId: string;
  eventType: string;
  timestamp: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}

interface AuditRow {
  id: string;
  event_id: string;
  event_type: string;
  timestamp: string;
  payload: string;
  received_at: string;
}

let db: DatabaseType;

/**
 * Inicializa o repositório com a instância do banco
 */
export function initAuditRepository(database: DatabaseType): void {
  db = database;
}

/**
 * Registra um evento no log de auditoria
 */
export function logEvent(event: BaseEvent): AuditEntry {
  const entry: AuditEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    eventId: event.eventId,
    eventType: event.eventType,
    timestamp: event.timestamp,
    payload: event.payload,
    receivedAt: new Date().toISOString(),
  };

  const insert = db.prepare(`
    INSERT INTO audit_logs (id, event_id, event_type, timestamp, payload, received_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insert.run(
    entry.id,
    entry.eventId,
    entry.eventType,
    entry.timestamp,
    JSON.stringify(entry.payload),
    entry.receivedAt
  );

  return entry;
}

/**
 * Lista logs de auditoria com filtros opcionais
 */
export function getAuditLogs(limit?: number, eventType?: string): AuditEntry[] {
  let query = "SELECT * FROM audit_logs";
  const params: (string | number)[] = [];

  if (eventType) {
    query += " WHERE event_type = ?";
    params.push(eventType);
  }

  query += " ORDER BY received_at DESC";

  if (limit) {
    query += " LIMIT ?";
    params.push(limit);
  }

  const rows = db.prepare(query).all(...params) as AuditRow[];

  return rows.map(mapToAuditEntry);
}

/**
 * Retorna estatísticas agregadas de auditoria
 */
export function getAuditStats(): {
  totalEvents: number;
  eventsByType: Record<string, number>;
  lastEventAt: string | null;
} {
  const totalResult = db
    .prepare("SELECT COUNT(*) as count FROM audit_logs")
    .get() as { count: number };
  const totalEvents = totalResult.count;

  const typeRows = db
    .prepare(
      `
    SELECT event_type, COUNT(*) as count
    FROM audit_logs
    GROUP BY event_type
  `
    )
    .all() as { event_type: string; count: number }[];

  const eventsByType: Record<string, number> = {};
  for (const row of typeRows) {
    eventsByType[row.event_type] = row.count;
  }

  const lastRow = db
    .prepare(
      `
    SELECT received_at
    FROM audit_logs
    ORDER BY received_at DESC
    LIMIT 1
  `
    )
    .get() as { received_at: string } | undefined;

  return {
    totalEvents,
    eventsByType,
    lastEventAt: lastRow?.received_at || null,
  };
}

/**
 * Retorna contagem total de eventos
 */
export function getAuditCount(): number {
  const result = db
    .prepare("SELECT COUNT(*) as count FROM audit_logs")
    .get() as { count: number };
  return result.count;
}

/**
 * Converte linha do banco para AuditEntry
 */
function mapToAuditEntry(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    eventId: row.event_id,
    eventType: row.event_type,
    timestamp: row.timestamp,
    payload: JSON.parse(row.payload),
    receivedAt: row.received_at,
  };
}
