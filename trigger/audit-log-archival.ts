import { schedules, task, logger } from "@trigger.dev/sdk/v3";
import { Client, Databases, Storage, ID, Query } from "node-appwrite";
import { InputFile } from "node-appwrite/file";

interface AuditLog {
  $id: string;
  $createdAt: string;
  user_id: string;
  user_email: string | null;
  action_type: string;
  resource_type: string;
  resource_id: string | null;
  action_details: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
  error_message: string | null;
  timestamp: string;
  session_id: string | null;
}

const COLLECTIONS = {
  AUDIT_LOGS: "audit_logs",
} as const;

const API_DELAY = 50;
const BATCH_SIZE = 100;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createAppwriteClient() {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT!)
    .setProject(process.env.APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);

  return {
    databases: new Databases(client),
    storage: new Storage(client),
  };
}

/**
 * Get the date N days ago in ISO format
 */
function getRetentionDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

/**
 * Fetch all audit logs older than the retention date
 */
async function fetchOldAuditLogs(
  databases: Databases,
  databaseId: string,
  retentionDate: string
): Promise<AuditLog[]> {
  const allLogs: AuditLog[] = [];
  let offset = 0;

  while (true) {
    const result = await databases.listDocuments(
      databaseId,
      COLLECTIONS.AUDIT_LOGS,
      [
        Query.lessThan("timestamp", retentionDate),
        Query.orderAsc("timestamp"),
        Query.limit(BATCH_SIZE),
        Query.offset(offset),
      ]
    );

    for (const doc of result.documents) {
      allLogs.push({
        $id: doc.$id,
        $createdAt: doc.$createdAt,
        user_id: doc.user_id as string,
        user_email: doc.user_email as string | null,
        action_type: doc.action_type as string,
        resource_type: doc.resource_type as string,
        resource_id: doc.resource_id as string | null,
        action_details: doc.action_details as string | null,
        ip_address: doc.ip_address as string | null,
        user_agent: doc.user_agent as string | null,
        status: doc.status as string,
        error_message: doc.error_message as string | null,
        timestamp: doc.timestamp as string,
        session_id: doc.session_id as string | null,
      });
    }

    if (result.documents.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
    await delay(API_DELAY);
  }

  return allLogs;
}

/**
 * Archive audit logs to storage as JSON
 */
async function archiveToStorage(
  storage: Storage,
  bucketId: string,
  logs: AuditLog[],
  archiveDate: string
): Promise<string> {
  const archiveData = {
    archived_at: new Date().toISOString(),
    retention_date: archiveDate,
    log_count: logs.length,
    logs,
  };

  const fileName = `audit-logs-archive-${archiveDate.split("T")[0]}.json`;
  const buffer = Buffer.from(JSON.stringify(archiveData, null, 2));

  const file = await storage.createFile(
    bucketId,
    ID.unique(),
    InputFile.fromBuffer(buffer, fileName)
  );

  return file.$id;
}

/**
 * Delete archived logs from database
 */
async function deleteArchivedLogs(
  databases: Databases,
  databaseId: string,
  logs: AuditLog[]
): Promise<number> {
  let deleted = 0;

  for (const log of logs) {
    try {
      await databases.deleteDocument(databaseId, COLLECTIONS.AUDIT_LOGS, log.$id);
      deleted++;
      await delay(API_DELAY);
    } catch (error) {
      logger.warn(`Failed to delete audit log ${log.$id}`, { error });
    }
  }

  return deleted;
}

/**
 * Scheduled task to archive old audit logs
 * Runs daily at 2:00 AM UTC
 */
export const auditLogArchivalTask = schedules.task({
  id: "audit-log-archival",
  cron: "0 2 * * *", // Every day at 2:00 AM UTC
  run: async () => {
    const { databases, storage } = createAppwriteClient();
    const databaseId = process.env.APPWRITE_DATABASE_ID!;
    const bucketId = process.env.APPWRITE_BUCKET_ID!;

    // Get retention period from environment (default: 90 days)
    const retentionDays = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || "90", 10);
    const retentionDate = getRetentionDate(retentionDays);

    logger.info(`Starting audit log archival`, {
      retentionDays,
      retentionDate,
    });

    try {
      // Fetch old audit logs
      const oldLogs = await fetchOldAuditLogs(databases, databaseId, retentionDate);

      if (oldLogs.length === 0) {
        logger.info("No audit logs to archive");
        return {
          success: true,
          archived: 0,
          deleted: 0,
        };
      }

      logger.info(`Found ${oldLogs.length} audit logs to archive`);

      // Archive to storage
      const archiveFileId = await archiveToStorage(
        storage,
        bucketId,
        oldLogs,
        retentionDate
      );

      logger.info(`Archived logs to file ${archiveFileId}`);

      // Delete archived logs from database
      const deleted = await deleteArchivedLogs(databases, databaseId, oldLogs);

      logger.info(`Deleted ${deleted} audit logs from database`);

      return {
        success: true,
        archived: oldLogs.length,
        deleted,
        archiveFileId,
      };
    } catch (error) {
      logger.error("Audit log archival failed", { error });
      throw error;
    }
  },
});

interface ManualArchivalPayload {
  retentionDays?: number;
  dryRun?: boolean;
}

/**
 * Manual trigger for audit log archival
 * Use this for testing or one-off archival operations
 */
export const auditLogArchivalManual = task({
  id: "audit-log-archival-manual",
  retry: { maxAttempts: 1 },
  run: async (payload: ManualArchivalPayload) => {
    const { databases, storage } = createAppwriteClient();
    const databaseId = process.env.APPWRITE_DATABASE_ID!;
    const bucketId = process.env.APPWRITE_BUCKET_ID!;

    const retentionDays = payload.retentionDays || 90;
    const dryRun = payload.dryRun || false;
    const retentionDate = getRetentionDate(retentionDays);

    logger.info(`Starting manual audit log archival`, {
      retentionDays,
      retentionDate,
      dryRun,
    });

    try {
      // Fetch old audit logs
      const oldLogs = await fetchOldAuditLogs(databases, databaseId, retentionDate);

      if (oldLogs.length === 0) {
        logger.info("No audit logs to archive");
        return {
          success: true,
          archived: 0,
          deleted: 0,
          dryRun,
        };
      }

      logger.info(`Found ${oldLogs.length} audit logs to archive`);

      if (dryRun) {
        logger.info("Dry run - not archiving or deleting logs");
        return {
          success: true,
          wouldArchive: oldLogs.length,
          wouldDelete: oldLogs.length,
          dryRun: true,
          sampleLogs: oldLogs.slice(0, 5).map((log) => ({
            id: log.$id,
            action: log.action_type,
            timestamp: log.timestamp,
          })),
        };
      }

      // Archive to storage
      const archiveFileId = await archiveToStorage(
        storage,
        bucketId,
        oldLogs,
        retentionDate
      );

      logger.info(`Archived logs to file ${archiveFileId}`);

      // Delete archived logs from database
      const deleted = await deleteArchivedLogs(databases, databaseId, oldLogs);

      logger.info(`Deleted ${deleted} audit logs from database`);

      return {
        success: true,
        archived: oldLogs.length,
        deleted,
        archiveFileId,
        dryRun: false,
      };
    } catch (error) {
      logger.error("Manual audit log archival failed", { error });
      throw error;
    }
  },
});
