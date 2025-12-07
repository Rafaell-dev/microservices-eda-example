import * as fs from "fs";
import * as path from "path";
import { BaseEvent } from "../../../shared/types";

interface AuditEntry {
  id: string;
  eventId: string;
  eventType: string;
  timestamp: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}

// In-memory storage
const auditLogs: AuditEntry[] = [];

// File path for persistence
const DATA_DIR = path.join(__dirname, "../../data");
const AUDIT_FILE = path.join(DATA_DIR, "audit.json");

// Ensure data directory exists
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Load existing audit data
function loadAuditData(): void {
  try {
    ensureDataDir();
    if (fs.existsSync(AUDIT_FILE)) {
      const data = fs.readFileSync(AUDIT_FILE, "utf-8");
      const parsed = JSON.parse(data);
      auditLogs.push(...parsed);
      console.log(
        `[AuditHandler] Loaded ${parsed.length} existing audit entries`
      );
    }
  } catch (error) {
    console.error("[AuditHandler] Error loading audit data:", error);
  }
}

// Save audit data to file
function saveAuditData(): void {
  try {
    ensureDataDir();
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(auditLogs, null, 2));
  } catch (error) {
    console.error("[AuditHandler] Error saving audit data:", error);
  }
}

// Initialize on module load
loadAuditData();

export async function handleAuditEvent(event: BaseEvent): Promise<void> {
  const entry: AuditEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    eventId: event.eventId,
    eventType: event.eventType,
    timestamp: event.timestamp,
    payload: event.payload,
    receivedAt: new Date().toISOString(),
  };

  auditLogs.push(entry);

  // Save to file (in production, use a proper database)
  saveAuditData();

  console.log(
    `[AuditHandler] 📝 Event logged: ${event.eventType} (${event.eventId})`
  );
  console.log(`[AuditHandler] Total events in audit log: ${auditLogs.length}`);
}

export function getAuditLogs(limit?: number, eventType?: string): AuditEntry[] {
  let logs = [...auditLogs];

  if (eventType) {
    logs = logs.filter((log) => log.eventType === eventType);
  }

  // Sort by receivedAt descending (most recent first)
  logs.sort(
    (a, b) =>
      new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
  );

  if (limit) {
    logs = logs.slice(0, limit);
  }

  return logs;
}

export function getAuditStats(): {
  totalEvents: number;
  eventsByType: Record<string, number>;
  lastEventAt: string | null;
} {
  const eventsByType: Record<string, number> = {};

  for (const log of auditLogs) {
    eventsByType[log.eventType] = (eventsByType[log.eventType] || 0) + 1;
  }

  const lastEvent =
    auditLogs.length > 0
      ? auditLogs.reduce((latest, current) =>
          new Date(current.receivedAt) > new Date(latest.receivedAt)
            ? current
            : latest
        )
      : null;

  return {
    totalEvents: auditLogs.length,
    eventsByType,
    lastEventAt: lastEvent?.receivedAt || null,
  };
}
