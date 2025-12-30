import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow, format } from 'date-fns'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Search,
  XCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { auditLogService } from '@/lib/appwrite/audit-log'
import type {
  AuditActionType,
  AuditResourceType,
  AuditStatus,
  ParsedAuditLog,
} from '@/types/audit'

const RESOURCE_TYPE_OPTIONS: Array<{ value: AuditResourceType | 'all'; label: string }> = [
  { value: 'all', label: 'All Resources' },
  { value: 'auth', label: 'Authentication' },
  { value: 'product', label: 'Products' },
  { value: 'product_component', label: 'Product Components' },
  { value: 'packaging_record', label: 'Packaging Records' },
  { value: 'packaging_item', label: 'Packaging Items' },
  { value: 'job', label: 'Jobs' },
  { value: 'storage', label: 'Storage' },
]

const STATUS_OPTIONS: Array<{ value: AuditStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All Statuses' },
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
]

function getActionLabel(action: AuditActionType): string {
  const labels: Record<string, string> = {
    // Auth actions
    auth_login: 'Login',
    auth_logout: 'Logout',
    auth_create_account: 'Create Account',
    auth_update_name: 'Update Name',
    auth_update_email: 'Update Email',
    auth_update_password: 'Update Password',
    auth_password_recovery_request: 'Password Recovery Request',
    auth_password_recovery_confirm: 'Password Recovery Confirm',
    auth_email_verification_request: 'Email Verification Request',
    auth_email_verification_confirm: 'Email Verification Confirm',
    // Product actions
    product_create: 'Create Product',
    product_update: 'Update Product',
    product_delete: 'Delete Product',
    product_view: 'View Product',
    product_search_barcode: 'Search by Barcode',
    product_search_sku: 'Search by SKU',
    product_list: 'List Products',
    product_stock_update: 'Update Stock',
    product_stock_deduct: 'Deduct Stock',
    product_stock_restore: 'Restore Stock',
    // Product component actions
    product_component_add: 'Add Component',
    product_component_remove: 'Remove Component',
    product_component_update: 'Update Component',
    // Packaging actions
    packaging_record_create: 'Create Packaging Record',
    packaging_record_delete: 'Delete Packaging Record',
    packaging_record_view: 'View Packaging Record',
    packaging_list_by_date: 'List Packaging by Date',
    packaging_view_by_date: 'View Packaging by Date',
    packaging_item_scan: 'Scan Item',
    packaging_item_remove: 'Remove Item',
    // Job actions
    job_queue_import: 'Queue Import',
    job_queue_export: 'Queue Export',
    job_queue_report_export: 'Queue Report Export',
    job_queue_send_email: 'Queue Send Email',
    job_delete: 'Delete Job',
    job_download: 'Download Job',
    job_import_started: 'Import Started',
    job_import_completed: 'Import Completed',
    job_export_started: 'Export Started',
    job_export_completed: 'Export Completed',
    job_report_export_started: 'Report Export Started',
    job_report_export_completed: 'Report Export Completed',
    report_email_sent: 'Report Email Sent',
    // Storage actions
    storage_file_upload: 'File Upload',
    storage_file_delete: 'File Delete',
    storage_file_view: 'File View',
    storage_file_download: 'File Download',
    // Audit log actions
    audit_log_view: 'View Audit Log',
    audit_log_export: 'Export Audit Log',
  }
  return labels[action] || action
}

function AuditLogItem({ log }: { log: ParsedAuditLog }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border p-4">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`flex size-10 items-center justify-center rounded-full ${
                  log.status === 'success'
                    ? 'bg-green-100 text-green-600'
                    : 'bg-red-100 text-red-600'
                }`}
              >
                {log.status === 'success' ? (
                  <CheckCircle2 className="size-5" />
                ) : (
                  <XCircle className="size-5" />
                )}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {getActionLabel(log.action_type)}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {log.resource_type}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{log.user_email || log.user_id}</span>
                  <span>•</span>
                  <span>
                    {format(new Date(log.timestamp), 'PPp')}
                  </span>
                  <span>•</span>
                  <span>
                    {formatDistanceToNow(new Date(log.timestamp), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {log.resource_id && (
                <span className="text-xs text-muted-foreground font-mono">
                  {log.resource_id.substring(0, 8)}...
                </span>
              )}
              {isOpen ? (
                <ChevronDown className="size-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-4 space-y-3 border-t pt-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">User ID:</span>
                <span className="ml-2 font-mono">{log.user_id}</span>
              </div>
              <div>
                <span className="text-muted-foreground">User Email:</span>
                <span className="ml-2">{log.user_email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Resource ID:</span>
                <span className="ml-2 font-mono">{log.resource_id || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Session ID:</span>
                <span className="ml-2 font-mono text-xs">
                  {log.session_id || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">IP Address:</span>
                <span className="ml-2">{log.ip_address || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">User Agent:</span>
                <span className="ml-2 text-xs truncate">
                  {log.user_agent || 'N/A'}
                </span>
              </div>
            </div>
            {log.action_details && (
              <div>
                <span className="text-sm text-muted-foreground">Action Details:</span>
                <pre className="mt-1 rounded bg-muted p-2 text-xs overflow-auto max-h-40">
                  {JSON.stringify(log.action_details, null, 2)}
                </pre>
              </div>
            )}
            {log.error_message && (
              <div className="flex items-start gap-2 rounded bg-destructive/10 p-2">
                <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                <span className="text-sm text-destructive">{log.error_message}</span>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

export default function AuditLogs() {
  const [resourceFilter, setResourceFilter] = useState<AuditResourceType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<AuditStatus | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [limit] = useState(50)
  const [offset, setOffset] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', resourceFilter, statusFilter, limit, offset],
    queryFn: () =>
      auditLogService.getAuditLogs({
        resource_type: resourceFilter === 'all' ? undefined : resourceFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit,
        offset,
      }),
  })

  const logs = data?.documents || []
  const total = data?.total || 0

  const filteredLogs = searchQuery
    ? logs.filter(
        (log) =>
          log.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.user_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.resource_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.action_type.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : logs

  const handleExport = async () => {
    const allLogs = await auditLogService.getAuditLogs({ limit: 5000 })
    const csv = [
      [
        'Timestamp',
        'User ID',
        'User Email',
        'Action Type',
        'Resource Type',
        'Resource ID',
        'Status',
        'Error Message',
        'Action Details',
      ].join(','),
      ...allLogs.documents.map((log) =>
        [
          log.timestamp,
          log.user_id,
          log.user_email || '',
          log.action_type,
          log.resource_type,
          log.resource_id || '',
          log.status,
          log.error_message || '',
          log.action_details ? JSON.stringify(log.action_details).replace(/,/g, ';') : '',
        ].join(',')
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">
            View and search system activity logs
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 size-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by user, action, or resource..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Select
            value={resourceFilter}
            onValueChange={(value) => {
              setResourceFilter(value as AuditResourceType | 'all')
              setOffset(0)
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by resource" />
            </SelectTrigger>
            <SelectContent>
              {RESOURCE_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value as AuditStatus | 'all')
              setOffset(0)
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Logs List */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>
            Showing {filteredLogs.length} of {total} logs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No audit logs found
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <AuditLogItem key={log.$id} log={log} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {total > limit && (
            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
