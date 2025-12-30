import type { AuditActionType, AuditResourceType } from '@/types/audit'

import {
  auditLogService,
  getAuditUserContext,
  sanitizeData,
} from './audit-log'

/**
 * Configuration for the audit wrapper
 */
interface AuditConfig {
  actionType: AuditActionType
  resourceType: AuditResourceType
  /**
   * Extract resource ID from arguments
   * @param args - The arguments passed to the wrapped function
   * @returns The resource ID or null
   */
  getResourceId?: (...args: unknown[]) => string | null
  /**
   * Extract action details from arguments
   * @param args - The arguments passed to the wrapped function
   * @returns Additional details to log
   */
  getDetails?: (...args: unknown[]) => Record<string, unknown>
  /**
   * Extract resource ID from the result
   * @param result - The result of the wrapped function
   * @returns The resource ID
   */
  getResourceIdFromResult?: (result: unknown) => string | null
  /**
   * Whether to log this action (can be used to conditionally skip logging)
   */
  shouldLog?: (...args: unknown[]) => boolean
}

/**
 * Wrap a service function with audit logging
 *
 * @param fn - The function to wrap
 * @param config - Audit configuration
 * @returns The wrapped function
 *
 * @example
 * ```typescript
 * const auditedCreate = withAudit(
 *   productService.create.bind(productService),
 *   {
 *     actionType: 'product_create',
 *     resourceType: 'product',
 *     getDetails: (data) => ({ barcode: data.barcode, name: data.name }),
 *     getResourceIdFromResult: (result) => result.$id,
 *   }
 * )
 * ```
 */
export function withAudit<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  config: AuditConfig
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const userContext = getAuditUserContext()

    // Skip audit logging if no user context or shouldLog returns false
    if (!userContext || (config.shouldLog && !config.shouldLog(...args))) {
      return fn(...args)
    }

    const resourceId = config.getResourceId?.(...args) ?? null
    const details = config.getDetails?.(...args) ?? {}

    try {
      // Execute the original function
      const result = await fn(...args)

      // Get resource ID from result if not available from args
      const finalResourceId =
        resourceId ?? config.getResourceIdFromResult?.(result) ?? null

      // Log successful action (async, don't await)
      auditLogService.createAuditLog({
        user_id: userContext.user_id,
        user_email: userContext.user_email,
        action_type: config.actionType,
        resource_type: config.resourceType,
        resource_id: finalResourceId,
        action_details: sanitizeData(details),
        status: 'success',
        session_id: userContext.session_id,
      }).catch((error) => {
        console.error('Failed to create audit log:', error)
      })

      return result
    } catch (error) {
      // Log failed action (async, don't await)
      auditLogService.createAuditLog({
        user_id: userContext.user_id,
        user_email: userContext.user_email,
        action_type: config.actionType,
        resource_type: config.resourceType,
        resource_id: resourceId,
        action_details: sanitizeData(details),
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        session_id: userContext.session_id,
      }).catch((logError) => {
        console.error('Failed to create audit log:', logError)
      })

      throw error
    }
  }
}

/**
 * Wrap a synchronous service function that returns a value (not a promise)
 * Used for simple getter functions that need audit logging
 */
export function withAuditSync<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  config: AuditConfig
): (...args: TArgs) => TResult {
  return (...args: TArgs): TResult => {
    const userContext = getAuditUserContext()

    // Skip audit logging if no user context or shouldLog returns false
    if (!userContext || (config.shouldLog && !config.shouldLog(...args))) {
      return fn(...args)
    }

    const resourceId = config.getResourceId?.(...args) ?? null
    const details = config.getDetails?.(...args) ?? {}

    try {
      // Execute the original function
      const result = fn(...args)

      // Get resource ID from result if not available from args
      const finalResourceId =
        resourceId ?? config.getResourceIdFromResult?.(result) ?? null

      // Log successful action (async, don't await)
      auditLogService.createAuditLog({
        user_id: userContext.user_id,
        user_email: userContext.user_email,
        action_type: config.actionType,
        resource_type: config.resourceType,
        resource_id: finalResourceId,
        action_details: sanitizeData(details),
        status: 'success',
        session_id: userContext.session_id,
      }).catch((error) => {
        console.error('Failed to create audit log:', error)
      })

      return result
    } catch (error) {
      // Log failed action (async, don't await)
      auditLogService.createAuditLog({
        user_id: userContext.user_id,
        user_email: userContext.user_email,
        action_type: config.actionType,
        resource_type: config.resourceType,
        resource_id: resourceId,
        action_details: sanitizeData(details),
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        session_id: userContext.session_id,
      }).catch((logError) => {
        console.error('Failed to create audit log:', logError)
      })

      throw error
    }
  }
}

/**
 * Create an audited version of an entire service object
 *
 * @param service - The service object to wrap
 * @param configs - Map of method names to their audit configurations
 * @returns The service with audited methods
 *
 * @example
 * ```typescript
 * const auditedProductService = createAuditedService(productService, {
 *   create: {
 *     actionType: 'product_create',
 *     resourceType: 'product',
 *     getDetails: (data) => ({ barcode: data.barcode }),
 *     getResourceIdFromResult: (result) => result.$id,
 *   },
 *   delete: {
 *     actionType: 'product_delete',
 *     resourceType: 'product',
 *     getResourceId: (id) => id,
 *   },
 * })
 * ```
 */
export function createAuditedService<T extends Record<string, unknown>>(
  service: T,
  configs: { [K in keyof T]?: AuditConfig }
): T {
  const auditedService = { ...service }

  for (const [methodName, config] of Object.entries(configs)) {
    const originalMethod = service[methodName as keyof T]

    if (typeof originalMethod === 'function' && config) {
      // Bind the method to the original service to preserve `this` context
      const boundMethod = originalMethod.bind(service)

      // Wrap with audit
      auditedService[methodName as keyof T] = withAudit(
        boundMethod as (...args: unknown[]) => Promise<unknown>,
        config
      ) as T[keyof T]
    }
  }

  return auditedService
}

/**
 * Helper to extract common document properties
 */
export const extractors = {
  /**
   * Extract $id from a document result
   */
  documentId: (result: unknown): string | null => {
    if (result && typeof result === 'object' && '$id' in result) {
      return (result as { $id: string }).$id
    }
    return null
  },

  /**
   * Extract first argument as resource ID
   */
  firstArg: (arg: unknown): string | null => {
    if (typeof arg === 'string') return arg
    return null
  },

  /**
   * Extract barcode from product data
   */
  productBarcode: (data: unknown): Record<string, unknown> => {
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>
      return {
        barcode: d.barcode,
        name: d.name,
        type: d.type,
        sku_code: d.sku_code,
      }
    }
    return {}
  },

  /**
   * Extract packaging record details
   */
  packagingDetails: (data: unknown): Record<string, unknown> => {
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>
      return {
        packaging_date: d.packaging_date,
        waybill_number: d.waybill_number,
      }
    }
    return {}
  },

  /**
   * Extract file details
   */
  fileDetails: (file: unknown): Record<string, unknown> => {
    if (file && typeof file === 'object' && 'name' in file) {
      const f = file as { name: string; size?: number; type?: string }
      return {
        filename: f.name,
        size: f.size,
        type: f.type,
      }
    }
    return {}
  },
}
