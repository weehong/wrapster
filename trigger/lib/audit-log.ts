import { Databases, ID } from 'node-appwrite'

/**
 * Audit action types for background jobs
 */
export type JobAuditActionType =
  | 'job_import_started'
  | 'job_import_completed'
  | 'job_export_started'
  | 'job_export_completed'
  | 'job_report_export_started'
  | 'job_report_export_completed'
  | 'report_email_sent'

/**
 * Audit log status
 */
export type AuditStatus = 'success' | 'failure'

/**
 * Create an audit log entry in background jobs
 * This function is designed to work with node-appwrite in trigger.dev environment
 */
export async function createAuditLog(
  databases: Databases,
  params: {
    userId: string
    userEmail?: string | null
    actionType: JobAuditActionType
    resourceType: string
    resourceId?: string | null
    actionDetails?: Record<string, unknown> | null
    status: AuditStatus
    errorMessage?: string | null
  }
): Promise<void> {
  const databaseId = process.env.APPWRITE_DATABASE_ID!
  const collectionId = process.env.APPWRITE_AUDIT_COLLECTION_ID || 'audit_logs'

  // Check if audit logging is enabled
  const auditEnabled = process.env.AUDIT_LOG_ENABLED !== 'false'
  if (!auditEnabled) {
    return
  }

  try {
    await databases.createDocument(databaseId, collectionId, ID.unique(), {
      user_id: params.userId,
      user_email: params.userEmail ?? null,
      action_type: params.actionType,
      resource_type: params.resourceType,
      resource_id: params.resourceId ?? null,
      action_details: params.actionDetails
        ? JSON.stringify(params.actionDetails)
        : null,
      ip_address: null, // Not available in background jobs
      user_agent: 'trigger.dev-worker',
      status: params.status,
      error_message: params.errorMessage ?? null,
      timestamp: new Date().toISOString(),
      session_id: null, // Not available in background jobs
    })
  } catch (error) {
    // Don't throw - audit logging shouldn't break the job
    console.error('Failed to create audit log:', error)
  }
}
