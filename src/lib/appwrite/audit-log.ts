import type {
  AuditActionType,
  AuditLog,
  AuditLogFilters,
  AuditRequestContext,
  AuditResourceType,
  AuditStatus,
  AuditUserContext,
  CreateAuditLogInput,
  ParsedAuditLog,
} from '@/types/audit'
import { COLLECTIONS, SENSITIVE_FIELDS } from '@/types/audit'

import { databaseService, Query } from './database'

/**
 * Check if audit logging is enabled
 */
function isAuditEnabled(): boolean {
  const enabled = import.meta.env.VITE_AUDIT_LOG_ENABLED
  return enabled !== 'false' && enabled !== false
}

/**
 * Sanitize sensitive data from action details
 * Removes passwords, tokens, and other sensitive fields
 */
export function sanitizeData(
  data: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!data) return null

  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    // Check if key is sensitive
    const lowerKey = key.toLowerCase()
    const isSensitive = SENSITIVE_FIELDS.some(
      (field) => lowerKey.includes(field.toLowerCase())
    )

    if (isSensitive) {
      sanitized[key] = '[REDACTED]'
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeData(value as Record<string, unknown>)
    } else if (Array.isArray(value)) {
      // Sanitize array items if they're objects
      sanitized[key] = value.map((item) =>
        item && typeof item === 'object'
          ? sanitizeData(item as Record<string, unknown>)
          : item
      )
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Capture request context from browser environment
 */
export function captureRequestContext(): AuditRequestContext {
  if (typeof window === 'undefined') {
    return {
      ip_address: null,
      user_agent: null,
      session_id: null,
    }
  }

  return {
    ip_address: null, // IP address is captured server-side
    user_agent: navigator.userAgent || null,
    session_id: sessionStorage.getItem('audit_session_id') || null,
  }
}

/**
 * Initialize a session ID for audit correlation
 */
export function initAuditSession(): string {
  if (typeof window === 'undefined') return ''

  let sessionId = sessionStorage.getItem('audit_session_id')
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    sessionStorage.setItem('audit_session_id', sessionId)
  }
  return sessionId
}

/**
 * Clear audit session (call on logout)
 */
export function clearAuditSession(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem('audit_session_id')
}

/**
 * Format action details for consistent logging
 */
export function formatActionDetails(
  action: AuditActionType,
  params: Record<string, unknown>
): Record<string, unknown> {
  return {
    action,
    timestamp: new Date().toISOString(),
    ...sanitizeData(params),
  }
}

/**
 * Parse audit log document with typed action details
 */
function parseAuditLog(log: AuditLog): ParsedAuditLog {
  return {
    ...log,
    action_details: log.action_details ? JSON.parse(log.action_details) : null,
  }
}

// Global user context storage
let currentUserContext: AuditUserContext | null = null

/**
 * Set the current user context for audit logging
 * Should be called when user logs in or context changes
 */
export function setAuditUserContext(context: AuditUserContext | null): void {
  currentUserContext = context
}

/**
 * Get the current user context
 */
export function getAuditUserContext(): AuditUserContext | null {
  return currentUserContext
}

export const auditLogService = {
  /**
   * Create a new audit log entry
   */
  async createAuditLog(input: CreateAuditLogInput): Promise<AuditLog | null> {
    if (!isAuditEnabled()) {
      return null
    }

    try {
      const context = captureRequestContext()

      const data = {
        user_id: input.user_id,
        user_email: input.user_email ?? null,
        action_type: input.action_type,
        resource_type: input.resource_type,
        resource_id: input.resource_id ?? null,
        action_details: input.action_details
          ? JSON.stringify(sanitizeData(input.action_details))
          : null,
        ip_address: input.ip_address ?? context.ip_address,
        user_agent: input.user_agent ?? context.user_agent,
        status: input.status,
        error_message: input.error_message ?? null,
        timestamp: new Date().toISOString(),
        session_id: input.session_id ?? context.session_id,
      }

      return await databaseService.createDocument<AuditLog>(
        COLLECTIONS.AUDIT_LOGS,
        data
      )
    } catch (error) {
      // Audit logging should not break the application
      console.error('Failed to create audit log:', error)
      return null
    }
  },

  /**
   * Log an action with the current user context
   */
  async log(
    action_type: AuditActionType,
    resource_type: AuditResourceType,
    options: {
      resource_id?: string | null
      action_details?: Record<string, unknown> | null
      status?: AuditStatus
      error_message?: string | null
    } = {}
  ): Promise<AuditLog | null> {
    const userContext = getAuditUserContext()

    if (!userContext) {
      console.warn('No user context available for audit logging')
      return null
    }

    return this.createAuditLog({
      user_id: userContext.user_id,
      user_email: userContext.user_email,
      action_type,
      resource_type,
      resource_id: options.resource_id,
      action_details: options.action_details,
      status: options.status ?? 'success',
      error_message: options.error_message,
      session_id: userContext.session_id,
    })
  },

  /**
   * Get audit logs with filters
   */
  async getAuditLogs(
    filters: AuditLogFilters = {}
  ): Promise<{ documents: ParsedAuditLog[]; total: number }> {
    const queries: string[] = []

    if (filters.user_id) {
      queries.push(Query.equal('user_id', filters.user_id))
    }

    if (filters.action_type) {
      const types = Array.isArray(filters.action_type)
        ? filters.action_type
        : [filters.action_type]
      queries.push(Query.equal('action_type', types))
    }

    if (filters.resource_type) {
      const types = Array.isArray(filters.resource_type)
        ? filters.resource_type
        : [filters.resource_type]
      queries.push(Query.equal('resource_type', types))
    }

    if (filters.resource_id) {
      queries.push(Query.equal('resource_id', filters.resource_id))
    }

    if (filters.status) {
      queries.push(Query.equal('status', filters.status))
    }

    if (filters.startDate) {
      queries.push(Query.greaterThanEqual('timestamp', filters.startDate))
    }

    if (filters.endDate) {
      queries.push(Query.lessThanEqual('timestamp', filters.endDate))
    }

    // Default sort by timestamp descending
    queries.push(Query.orderDesc('timestamp'))

    if (filters.limit) {
      queries.push(Query.limit(filters.limit))
    }

    if (filters.offset) {
      queries.push(Query.offset(filters.offset))
    }

    const result = await databaseService.listDocuments<AuditLog>(
      COLLECTIONS.AUDIT_LOGS,
      queries
    )

    return {
      documents: result.documents.map(parseAuditLog),
      total: result.total,
    }
  },

  /**
   * Get audit logs for a specific user
   */
  async getAuditLogsByUser(
    userId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ documents: ParsedAuditLog[]; total: number }> {
    return this.getAuditLogs({
      user_id: userId,
      limit: options?.limit,
      offset: options?.offset,
    })
  },

  /**
   * Get audit logs for a specific resource
   */
  async getAuditLogsByResource(
    resourceType: AuditResourceType,
    resourceId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ documents: ParsedAuditLog[]; total: number }> {
    return this.getAuditLogs({
      resource_type: resourceType,
      resource_id: resourceId,
      limit: options?.limit,
      offset: options?.offset,
    })
  },

  /**
   * Get audit logs within a date range
   */
  async getAuditLogsByDateRange(
    startDate: string,
    endDate: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ documents: ParsedAuditLog[]; total: number }> {
    return this.getAuditLogs({
      startDate,
      endDate,
      limit: options?.limit,
      offset: options?.offset,
    })
  },

  /**
   * Get audit logs by action type
   */
  async getAuditLogsByAction(
    actionType: AuditActionType | AuditActionType[],
    options?: { limit?: number; offset?: number }
  ): Promise<{ documents: ParsedAuditLog[]; total: number }> {
    return this.getAuditLogs({
      action_type: actionType,
      limit: options?.limit,
      offset: options?.offset,
    })
  },

  /**
   * Get recent failed actions (for monitoring)
   */
  async getRecentFailures(
    limit = 50
  ): Promise<{ documents: ParsedAuditLog[]; total: number }> {
    return this.getAuditLogs({
      status: 'failure',
      limit,
    })
  },

  /**
   * Count audit logs by action type (for analytics)
   */
  async countByActionType(
    startDate?: string,
    endDate?: string
  ): Promise<Map<AuditActionType, number>> {
    const filters: AuditLogFilters = { limit: 5000 }
    if (startDate) filters.startDate = startDate
    if (endDate) filters.endDate = endDate

    const result = await this.getAuditLogs(filters)
    const counts = new Map<AuditActionType, number>()

    for (const log of result.documents) {
      const current = counts.get(log.action_type) || 0
      counts.set(log.action_type, current + 1)
    }

    return counts
  },
}
