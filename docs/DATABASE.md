# Database Schema

## Overview

Wrapster uses Appwrite's Tables API (SQL-like database) for data persistence. The database consists of five main collections that handle products, packaging records, and job tracking.

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                            products                                  │
├─────────────────────────────────────────────────────────────────────┤
│ $id (PK)                                                            │
│ barcode (UNIQUE)                                                    │
│ sku_code                                                            │
│ name                                                                │
│ type (single | bundle)                                              │
│ cost                                                                │
│ stock_quantity                                                      │
│ $createdAt, $updatedAt                                              │
└────────────────────────────┬────────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                              │
              ▼                              ▼
┌─────────────────────────┐    ┌─────────────────────────────────────┐
│   product_components    │    │         packaging_items             │
├─────────────────────────┤    ├─────────────────────────────────────┤
│ $id (PK)                │    │ $id (PK)                            │
│ parent_product_id (FK)  │    │ packaging_record_id (FK)            │
│ child_product_id (FK)   │    │ product_barcode                     │
│ quantity                │    │ scanned_at                          │
└─────────────────────────┘    │ $createdAt, $updatedAt              │
                               └──────────────────┬──────────────────┘
                                                  │
                                                  ▼
                               ┌─────────────────────────────────────┐
                               │        packaging_records            │
                               ├─────────────────────────────────────┤
                               │ $id (PK)                            │
                               │ packaging_date                      │
                               │ waybill_number                      │
                               │ $createdAt, $updatedAt              │
                               └─────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                           import_jobs                                │
├─────────────────────────────────────────────────────────────────────┤
│ $id (PK)                                                            │
│ user_id                                                             │
│ action (import-excel | export-excel | export-reporting-* | ...)    │
│ status (pending | processing | completed | failed)                  │
│ file_id, result_file_id                                             │
│ filters, stats, error                                               │
│ created_at, completed_at                                            │
└─────────────────────────────────────────────────────────────────────┘
```

## Collections

### products

Master catalog of all products (single items and bundles).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `$id` | string | Primary key, auto-generated | Unique document identifier |
| `barcode` | string(100) | Required, unique, indexed | Product barcode for scanning |
| `sku_code` | string(50) | Optional, indexed | Stock keeping unit code |
| `name` | string(255) | Required | Product display name |
| `type` | enum | Required, default: 'single' | Product type: 'single' or 'bundle' |
| `cost` | float | Optional, min: 0, max: 9999999999.99 | Product cost/price |
| `stock_quantity` | integer | Optional, min: 0, default: 0 | Available stock count |
| `$createdAt` | datetime | Auto-generated | Creation timestamp |
| `$updatedAt` | datetime | Auto-generated | Last update timestamp |

**Indexes:**
- `idx_barcode` (Unique) - Fast barcode lookups
- `idx_sku_code` (Key) - SKU searches
- `idx_type` (Key) - Filter by product type

**TypeScript Interface:**
```typescript
interface Product {
  $id: string
  barcode: string
  sku_code?: string
  name: string
  type: 'single' | 'bundle'
  cost?: number
  stock_quantity?: number
  $createdAt: string
  $updatedAt: string
}
```

### product_components

Junction table defining bundle product composition (parent-child relationships).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `$id` | string | Primary key | Unique document identifier |
| `parent_product_id` | string(36) | Required, indexed | Bundle product ID |
| `child_product_id` | string(36) | Required, indexed | Component product ID |
| `quantity` | integer | Required, min: 1, default: 1 | Quantity of component in bundle |
| `$createdAt` | datetime | Auto-generated | Creation timestamp |
| `$updatedAt` | datetime | Auto-generated | Last update timestamp |

**Indexes:**
- `idx_parent_product` (Key) - Find components of a bundle
- `idx_child_product` (Key) - Find bundles containing a product
- `idx_parent_child` (Unique) - Prevent duplicate entries

**TypeScript Interface:**
```typescript
interface ProductComponent {
  $id: string
  parent_product_id: string
  child_product_id: string
  quantity: number
  $createdAt: string
  $updatedAt: string
}
```

### packaging_records

Waybill tracking records, one per waybill per date.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `$id` | string | Primary key | Unique document identifier |
| `packaging_date` | string(10) | Required, indexed | Date in YYYY-MM-DD format |
| `waybill_number` | string(100) | Required, indexed | Waybill/shipment identifier |
| `$createdAt` | datetime | Auto-generated | Creation timestamp |
| `$updatedAt` | datetime | Auto-generated | Last update timestamp |

**Indexes:**
- `idx_packaging_date` (Key) - Filter by date
- `idx_waybill_number` (Key) - Search by waybill
- `idx_date_waybill` (Unique) - Prevent duplicate waybills per date

**TypeScript Interface:**
```typescript
interface PackagingRecord {
  $id: string
  packaging_date: string
  waybill_number: string
  $createdAt: string
  $updatedAt: string
}
```

### packaging_items

Individual product scans linked to packaging records.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `$id` | string | Primary key | Unique document identifier |
| `packaging_record_id` | string(36) | Required, indexed | Parent packaging record ID |
| `product_barcode` | string(100) | Required, indexed | Scanned product barcode |
| `scanned_at` | string | Auto-set | ISO datetime of scan |
| `$createdAt` | datetime | Auto-generated | Creation timestamp |
| `$updatedAt` | datetime | Auto-generated | Last update timestamp |

**Indexes:**
- `idx_packaging_record` (Key) - Get items for a record
- `idx_product_barcode` (Key) - Find all scans of a product
- `idx_scanned_at` (Key) - Order by scan time

**TypeScript Interface:**
```typescript
interface PackagingItem {
  $id: string
  packaging_record_id: string
  product_barcode: string
  scanned_at: string
  $createdAt: string
  $updatedAt: string
}
```

### import_jobs

Tracks background job status for import/export operations.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `$id` | string | Primary key | Unique document identifier |
| `user_id` | string | Required, indexed | User who initiated the job |
| `action` | enum | Required, indexed | Job type (see below) |
| `status` | enum | Required, indexed | Job status (see below) |
| `file_id` | string | Optional | Source file ID (for imports) |
| `result_file_id` | string | Optional | Output file ID (for exports) |
| `filters` | string | Optional | JSON stringified filter options |
| `stats` | string | Optional | JSON stringified statistics |
| `error` | string | Optional | Error message if failed |
| `created_at` | string | Required, indexed | ISO datetime of creation |
| `completed_at` | string | Optional | ISO datetime of completion |

**Action Types:**
- `import-excel` - Import products from Excel
- `export-excel` - Export products to Excel
- `export-reporting-excel` - Export reports to Excel
- `export-reporting-pdf` - Export reports to PDF
- `send-report-email` - Send report via email

**Status Values:**
- `pending` - Job queued, waiting to start
- `processing` - Job currently running
- `completed` - Job finished successfully
- `failed` - Job failed with error

**Indexes:**
- `idx_user_id` (Key) - Filter jobs by user
- `idx_action` (Key) - Filter by job type
- `idx_status` (Key) - Filter by status
- `idx_created_at` (Key) - Order by creation time
- `idx_user_status` (Key) - Combined user and status filter

**TypeScript Interface:**
```typescript
interface ImportJob {
  $id: string
  user_id: string
  action: JobAction
  status: JobStatus
  file_id?: string
  result_file_id?: string
  filters?: string
  stats?: string
  error?: string
  created_at: string
  completed_at?: string
  $createdAt: string
  $updatedAt: string
}

interface JobStats {
  imported?: number
  updated?: number
  skipped?: number
  failed?: number
  total?: number
}
```

## Database Operations

### Common Queries

**Get products by type:**
```typescript
const bundles = await databaseService.listDocuments<Product>(
  COLLECTIONS.PRODUCTS,
  [Query.equal('type', 'bundle')]
)
```

**Search products:**
```typescript
const results = await databaseService.listDocuments<Product>(
  COLLECTIONS.PRODUCTS,
  [
    Query.or([
      Query.contains('barcode', searchTerm),
      Query.contains('name', searchTerm)
    ])
  ]
)
```

**Get packaging records for date range:**
```typescript
const records = await databaseService.listDocuments<PackagingRecord>(
  COLLECTIONS.PACKAGING_RECORDS,
  [
    Query.greaterThanEqual('packaging_date', startDate),
    Query.lessThanEqual('packaging_date', endDate)
  ]
)
```

**Get pending jobs for user:**
```typescript
const jobs = await databaseService.listDocuments<ImportJob>(
  COLLECTIONS.IMPORT_JOBS,
  [
    Query.equal('user_id', userId),
    Query.equal('status', 'pending')
  ]
)
```

## Database Migration

The database schema is managed through migration scripts in the `scripts/` directory:

```bash
# Create all tables and indexes
npm run migrate

# Reset database (drop and recreate)
npm run reset-db

# Seed with sample data
npm run seed
```

Migration script location: `scripts/migrate-database.ts`
