import { BaseEvent } from "../../../shared/types";
import {
  logEvent,
  getAuditLogs as getLogsFromDb,
  getAuditStats as getStatsFromDb,
  getAuditCount,
  AuditEntry,
} from "./auditRepository";

/**
 * Handler para processar eventos de auditoria
 */
export async function handleAuditEvent(event: BaseEvent): Promise<void> {
  const entry = logEvent(event);
  const totalEvents = getAuditCount();

  console.log(
    `[HandlerAuditoria] 📝 Evento registrado: ${event.eventType} (${event.eventId})`
  );
  console.log(
    `[HandlerAuditoria] Total de eventos no log de auditoria: ${totalEvents}`
  );
}

/**
 * Retorna logs de auditoria com filtros opcionais
 */
export function getAuditLogs(limit?: number, eventType?: string): AuditEntry[] {
  return getLogsFromDb(limit, eventType);
}

/**
 * Retorna estatísticas de auditoria
 */
export function getAuditStats(): {
  totalEvents: number;
  eventsByType: Record<string, number>;
  lastEventAt: string | null;
} {
  return getStatsFromDb();
}
