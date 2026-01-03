import { functions, storage, ExecutionMethod } from './config'
import { databaseService, Query } from './database'
import { auditLogService, getAuditUserContext } from './audit-log'

import type {
  ImportJob,
  JobAction,
  JobStatus,
  ParsedJob,
  QueueJobResponse,
} from '@/types/job'
import { COLLECTIONS } from '@/types/job'

const FUNCTION_ID = import.meta.env.VITE_APPWRITE_QUEUE_FUNCTION_ID || 'queue-product-job'
const DELETE_REPORT_FUNCTION_ID = import.meta.env.VITE_APPWRITE_DELETE_REPORT_FUNCTION_ID || 'delete-report'
const BUCKET_ID = import.meta.env.VITE_APPWRITE_BUCKET_ID

/**
 * Parse job document to typed job
 */
function parseJob(job: ImportJob): ParsedJob {
  return {
    ...job,
    stats: job.stats ? JSON.parse(job.stats) : null,
    filters: job.filters ? JSON.parse(job.filters) : null,
  }
}

export const jobService = {
  /**
   * Upload file for import and queue the import job
   */
  async queueImport(file: File, userId: string): Promise<QueueJobResponse> {
    try {
      // Upload file to storage first
      const uploadedFile = await storage.createFile(BUCKET_ID, 'unique()', file)

      // Call Appwrite Function to queue the job
      const execution = await functions.createExecution(
        FUNCTION_ID,
        JSON.stringify({
          action: 'import-excel',
          fileId: uploadedFile.$id,
          userId,
        }),
        false, // async
        '/', // path
        ExecutionMethod.POST // method
      )

      // Parse the response
      const response = JSON.parse(execution.responseBody) as QueueJobResponse

      if (!response.success) {
        // Clean up uploaded file on failure
        try {
          await storage.deleteFile(BUCKET_ID, uploadedFile.$id)
        } catch {
          // Ignore cleanup errors
        }
        throw new Error(response.error || 'Failed to queue import job')
      }

      auditLogService.log('job_queue_import', 'job', {
        resource_id: response.jobId,
        action_details: {
          action: 'import-excel',
          fileId: uploadedFile.$id,
          fileName: file.name,
          fileSize: file.size,
        },
      }).catch(console.error)

      return response
    } catch (error) {
      auditLogService.log('job_queue_import', 'job', {
        action_details: {
          action: 'import-excel',
          fileName: file.name,
        },
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  /**
   * Queue an export job
   */
  async queueExport(
    userId: string,
    filters?: { type?: 'single' | 'bundle' }
  ): Promise<QueueJobResponse> {
    try {
      const execution = await functions.createExecution(
        FUNCTION_ID,
        JSON.stringify({
          action: 'export-excel',
          userId,
          filters,
        }),
        false, // async
        '/', // path
        ExecutionMethod.POST // method
      )

      // Check if function executed successfully
      if (execution.status === 'failed') {
        console.error('Function execution failed:', execution.errors)
        throw new Error(`Function failed: ${execution.errors || 'Unknown error'}`)
      }

      // Check for empty response
      if (!execution.responseBody) {
        console.error('Function returned empty response:', execution)
        throw new Error('Function returned empty response. Check function logs in Appwrite Console.')
      }

      const response = JSON.parse(execution.responseBody) as QueueJobResponse

      if (!response.success) {
        throw new Error(response.error || 'Failed to queue export job')
      }

      auditLogService.log('job_queue_export', 'job', {
        resource_id: response.jobId,
        action_details: {
          action: 'export-excel',
          filters,
        },
      }).catch(console.error)

      return response
    } catch (error) {
      auditLogService.log('job_queue_export', 'job', {
        action_details: {
          action: 'export-excel',
          filters,
        },
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  /**
   * Queue a report export job
   */
  async queueReportExport(
    userId: string,
    startDate: string,
    endDate: string,
    format: 'excel' | 'pdf' = 'excel'
  ): Promise<QueueJobResponse> {
    const action = format === 'pdf' ? 'export-reporting-pdf' : 'export-reporting-excel'

    try {
      const execution = await functions.createExecution(
        FUNCTION_ID,
        JSON.stringify({
          action,
          userId,
          startDate,
          endDate,
          format,
        }),
        false, // async
        '/', // path
        ExecutionMethod.POST // method
      )

      // Check if function executed successfully
      if (execution.status === 'failed') {
        console.error('Function execution failed:', execution.errors)
        throw new Error(`Function failed: ${execution.errors || 'Unknown error'}`)
      }

      // Check for empty response
      if (!execution.responseBody) {
        console.error('Function returned empty response:', execution)
        throw new Error('Function returned empty response. Check function logs in Appwrite Console.')
      }

      const response = JSON.parse(execution.responseBody) as QueueJobResponse

      if (!response.success) {
        throw new Error(response.error || 'Failed to queue report export job')
      }

      auditLogService.log('job_queue_report_export', 'job', {
        resource_id: response.jobId,
        action_details: {
          action,
          startDate,
          endDate,
          format,
        },
      }).catch(console.error)

      return response
    } catch (error) {
      auditLogService.log('job_queue_report_export', 'job', {
        action_details: {
          action,
          startDate,
          endDate,
          format,
        },
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  /**
   * Queue a send report email job
   */
  async queueSendReportEmail(
    userId: string,
    fileId: string,
    recipients: string[],
    dateRange: string
  ): Promise<QueueJobResponse> {
    try {
      const execution = await functions.createExecution(
        FUNCTION_ID,
        JSON.stringify({
          action: 'send-report-email',
          userId,
          fileId,
          recipients,
          dateRange,
        }),
        false, // async
        '/', // path
        ExecutionMethod.POST // method
      )

      // Check if function executed successfully
      if (execution.status === 'failed') {
        console.error('Function execution failed:', execution.errors)
        throw new Error(`Function failed: ${execution.errors || 'Unknown error'}`)
      }

      // Check for empty response
      if (!execution.responseBody) {
        console.error('Function returned empty response:', execution)
        throw new Error('Function returned empty response. Check function logs in Appwrite Console.')
      }

      const response = JSON.parse(execution.responseBody) as QueueJobResponse

      if (!response.success) {
        throw new Error(response.error || 'Failed to queue send report email job')
      }

      auditLogService.log('job_queue_send_email', 'job', {
        resource_id: response.jobId,
        action_details: {
          action: 'send-report-email',
          fileId,
          recipientCount: recipients.length,
          dateRange,
        },
      }).catch(console.error)

      return response
    } catch (error) {
      auditLogService.log('job_queue_send_email', 'job', {
        action_details: {
          action: 'send-report-email',
          fileId,
          recipientCount: recipients.length,
          dateRange,
        },
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  /**
   * Get a job by ID
   */
  async getById(jobId: string): Promise<ParsedJob> {
    const job = await databaseService.getDocument<ImportJob>(
      COLLECTIONS.IMPORT_JOBS,
      jobId
    )
    return parseJob(job)
  },

  /**
   * List jobs for a user
   */
  async listByUser(
    userId: string,
    options?: {
      action?: JobAction
      status?: JobStatus
      limit?: number
      offset?: number
    }
  ): Promise<{ documents: ParsedJob[]; total: number }> {
    const queries: string[] = [Query.equal('user_id', userId)]

    if (options?.action) {
      queries.push(Query.equal('action', options.action))
    }
    if (options?.status) {
      queries.push(Query.equal('status', options.status))
    }

    queries.push(Query.orderDesc('created_at'))

    if (options?.limit) {
      queries.push(Query.limit(options.limit))
    }
    if (options?.offset) {
      queries.push(Query.offset(options.offset))
    }

    const result = await databaseService.listDocuments<ImportJob>(
      COLLECTIONS.IMPORT_JOBS,
      queries
    )

    return {
      documents: result.documents.map(parseJob),
      total: result.total,
    }
  },

  /**
   * Get active and recent jobs for a user
   * Includes pending/processing jobs and recently completed/failed jobs (last 1 hour)
   * Also marks stale pending jobs (>15 min) as failed
   */
  async getActiveJobs(userId: string): Promise<ParsedJob[]> {
    // Get active jobs (pending/processing)
    const activeResult = await databaseService.listDocuments<ImportJob>(
      COLLECTIONS.IMPORT_JOBS,
      [
        Query.equal('user_id', userId),
        Query.equal('status', ['pending', 'processing']),
        Query.orderDesc('created_at'),
        Query.limit(10),
      ]
    )

    // Check for stale pending jobs (>2 minutes) and mark them as failed
    const staleThreshold = 2 * 60 * 1000 // 2 minutes
    for (const job of activeResult.documents) {
      const jobAge = Date.now() - new Date(job.created_at).getTime()
      if (job.status === 'pending' && jobAge > staleThreshold) {
        try {
          await databaseService.updateDocument(COLLECTIONS.IMPORT_JOBS, job.$id, {
            status: 'failed',
            error: 'Task expired - worker did not pick up the job in time',
            completed_at: new Date().toISOString(),
          })
          job.status = 'failed'
          job.error = 'Task expired - worker did not pick up the job in time'
        } catch {
          // Ignore update errors
        }
      }
    }

    // Get recently completed/failed jobs (last 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const recentResult = await databaseService.listDocuments<ImportJob>(
      COLLECTIONS.IMPORT_JOBS,
      [
        Query.equal('user_id', userId),
        Query.equal('status', ['completed', 'failed']),
        Query.greaterThan('$updatedAt', oneHourAgo),
        Query.orderDesc('created_at'),
        Query.limit(10),
      ]
    )

    // Combine and deduplicate
    const allJobs = [...activeResult.documents, ...recentResult.documents]
    const uniqueJobs = allJobs.filter(
      (job, index, self) => index === self.findIndex((j) => j.$id === job.$id)
    )

    // Sort by created_at descending
    uniqueJobs.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    return uniqueJobs.slice(0, 10).map(parseJob)
  },

  /**
   * Get recently completed export jobs with downloadable files
   */
  async getRecentCompletedExports(userId: string): Promise<ParsedJob[]> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const result = await databaseService.listDocuments<ImportJob>(
      COLLECTIONS.IMPORT_JOBS,
      [
        Query.equal('user_id', userId),
        Query.equal('status', 'completed'),
        Query.contains('action', 'export'),
        Query.isNotNull('result_file_id'),
        Query.greaterThan('completed_at', fiveMinutesAgo),
        Query.orderDesc('completed_at'),
        Query.limit(5),
      ]
    )

    return result.documents.map(parseJob)
  },

  /**
   * Get completed report exports with downloadable files
   */
  async getCompletedReportExports(userId: string, limit = 20): Promise<ParsedJob[]> {
    const result = await databaseService.listDocuments<ImportJob>(
      COLLECTIONS.IMPORT_JOBS,
      [
        Query.equal('user_id', userId),
        Query.equal('status', 'completed'),
        Query.contains('action', 'reporting'),
        Query.isNotNull('result_file_id'),
        Query.orderDesc('completed_at'),
        Query.limit(limit),
      ]
    )

    return result.documents.map(parseJob)
  },

  /**
   * Get download URL for export result
   */
  getDownloadUrl(fileId: string): string {
    const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT
    const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID
    return `${endpoint}/storage/buckets/${BUCKET_ID}/files/${fileId}/download?project=${projectId}`
  },

  /**
   * Download export file
   */
  async downloadExport(fileId: string): Promise<Blob> {
    try {
      const url = storage.getFileDownload(BUCKET_ID, fileId)
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`)
      }
      const blob = await response.blob()

      auditLogService.log('job_download', 'job', {
        resource_id: fileId,
        action_details: {
          fileId,
          size: blob.size,
        },
      }).catch(console.error)

      return blob
    } catch (error) {
      auditLogService.log('job_download', 'job', {
        resource_id: fileId,
        action_details: { fileId },
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  /**
   * Delete a job record and its associated file
   */
  async deleteJob(jobId: string, fileId?: string | null): Promise<void> {
    try {
      // Get job details before deletion for audit
      let jobDetails: Record<string, unknown> = {}
      try {
        const job = await databaseService.getDocument<ImportJob>(
          COLLECTIONS.IMPORT_JOBS,
          jobId
        )
        jobDetails = {
          action: job.action,
          status: job.status,
          user_id: job.user_id,
        }
      } catch {
        // Job may not exist, continue with deletion
      }

      // Delete the associated file if it exists
      if (fileId) {
        try {
          await storage.deleteFile(BUCKET_ID, fileId)
        } catch {
          // Ignore file deletion errors (file may already be deleted)
        }
      }

      // Delete the job record
      await databaseService.deleteDocument(COLLECTIONS.IMPORT_JOBS, jobId)

      auditLogService.log('job_delete', 'job', {
        resource_id: jobId,
        action_details: {
          ...jobDetails,
          fileId,
        },
      }).catch(console.error)
    } catch (error) {
      auditLogService.log('job_delete', 'job', {
        resource_id: jobId,
        action_details: { fileId },
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  /**
   * Delete report jobs and their files via server-side function
   * This uses the API key to bypass permission restrictions for files
   * created by the server-side triggers.
   */
  async deleteReportViaFunction(
    jobIds: string[],
    fileIds: (string | null)[]
  ): Promise<{ success: boolean; jobsDeleted: number; filesDeleted: number }> {
    const userContext = getAuditUserContext()

    const payload = {
      job_ids: jobIds,
      file_ids: fileIds.filter(Boolean),
      user_id: userContext?.user_id || '',
      user_email: userContext?.user_email,
      session_id: userContext?.session_id,
    }

    try {
      const execution = await functions.createExecution(
        DELETE_REPORT_FUNCTION_ID,
        JSON.stringify(payload),
        false // synchronous execution
      )

      const response = JSON.parse(execution.responseBody)

      if (!response.success) {
        throw new Error(response.error || 'Function execution failed')
      }

      return {
        success: true,
        jobsDeleted: response.jobs_deleted || 0,
        filesDeleted: response.files_deleted || 0,
      }
    } catch (error) {
      console.error('Delete report function error:', error)
      throw error
    }
  },
}
