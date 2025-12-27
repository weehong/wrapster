# API Reference

## Overview

Wrapster uses Appwrite as its backend platform, providing authentication, database, storage, and serverless functions. This document covers the service layer APIs and their usage.

## Authentication Service

Location: `src/lib/appwrite/auth.ts`

### Methods

#### getCurrentUser()
Get the currently authenticated user.

```typescript
const user = await authService.getCurrentUser()
// Returns: User | null
```

#### login(email, password)
Authenticate a user with email and password.

```typescript
await authService.login('user@example.com', 'password123')
// Creates a session and returns User object
// Throws if credentials are invalid
```

#### createAccount(email, password, name?)
Create a new user account and automatically log in.

```typescript
await authService.createAccount('user@example.com', 'password123', 'John Doe')
// Creates account, creates session, returns User object
```

#### logout()
Log out the current user by deleting the session.

```typescript
await authService.logout()
// Deletes current session
```

#### deleteCurrentSession()
Delete the current session (used when handling active session conflicts).

```typescript
await authService.deleteCurrentSession()
```

## Database Service

Location: `src/lib/appwrite/database.ts`

### Generic CRUD Operations

#### createDocument<T>()
Create a new document in a collection.

```typescript
const product = await databaseService.createDocument<Product>(
  COLLECTIONS.PRODUCTS,
  { barcode: '123456', name: 'Widget', type: 'single' },
  ID.unique(),  // optional custom ID
  []            // optional permissions
)
```

#### getDocument<T>()
Retrieve a single document by ID.

```typescript
const product = await databaseService.getDocument<Product>(
  COLLECTIONS.PRODUCTS,
  'product_id_here'
)
```

#### listDocuments<T>()
Query documents with optional filters.

```typescript
const products = await databaseService.listDocuments<Product>(
  COLLECTIONS.PRODUCTS,
  [
    Query.equal('type', 'bundle'),
    Query.orderDesc('$createdAt'),
    Query.limit(25)
  ]
)
// Returns: { documents: Product[], total: number }
```

#### updateDocument<T>()
Update an existing document.

```typescript
const updated = await databaseService.updateDocument<Product>(
  COLLECTIONS.PRODUCTS,
  'product_id_here',
  { stock_quantity: 50 }
)
```

#### deleteDocument()
Delete a document by ID.

```typescript
await databaseService.deleteDocument(
  COLLECTIONS.PRODUCTS,
  'product_id_here'
)
```

## Product Service

Location: `src/lib/appwrite/products.ts`

### Methods

#### create(product)
Create a new product with optional bundle components.

```typescript
const product = await productService.create({
  barcode: '123456789',
  name: 'Gift Bundle',
  type: 'bundle',
  cost: 29.99,
  stock_quantity: 100,
  bundleItems: [
    { productId: 'item1_id', quantity: 2 },
    { productId: 'item2_id', quantity: 1 }
  ]
})
```

#### update(id, product)
Update a product and its bundle components.

```typescript
const updated = await productService.update('product_id', {
  name: 'Updated Name',
  stock_quantity: 150
})
```

#### delete(id)
Delete a product and its component relationships.

```typescript
await productService.delete('product_id')
```

#### getByBarcode(barcode)
Find a product by its barcode.

```typescript
const product = await productService.getByBarcode('123456789')
// Returns: Product | null
```

#### search(query, options?)
Search products by barcode, name, or SKU.

```typescript
const results = await productService.search('widget', {
  type: 'single',
  limit: 25
})
```

#### getBundleComponents(productId)
Get all components of a bundle product.

```typescript
const components = await productService.getBundleComponents('bundle_id')
// Returns: Array<{ product: Product, quantity: number }>
```

#### updateStock(productId, quantity)
Update the stock quantity for a product.

```typescript
await productService.updateStock('product_id', -5) // Deduct 5
await productService.updateStock('product_id', 10) // Add 10
```

#### checkStockAvailability(items)
Check if sufficient stock is available for packaging.

```typescript
const { available, insufficientItems } = await productService.checkStockAvailability([
  { barcode: '123', quantity: 5 },
  { barcode: '456', quantity: 3 }
])
```

## Packaging Service

Location: `src/lib/appwrite/packaging.ts`

### PackagingRecordService

#### create(record)
Create a new packaging record.

```typescript
const record = await packagingRecordService.create({
  packaging_date: '2024-01-15',
  waybill_number: 'WB123456'
})
```

#### getByDate(date)
Get all packaging records for a specific date.

```typescript
const records = await packagingRecordService.getByDate('2024-01-15')
```

#### getByDateRange(startDate, endDate)
Get packaging records within a date range.

```typescript
const records = await packagingRecordService.getByDateRange(
  '2024-01-01',
  '2024-01-31'
)
```

#### checkDuplicate(date, waybillNumber)
Check if a waybill already exists for a date.

```typescript
const exists = await packagingRecordService.checkDuplicate(
  '2024-01-15',
  'WB123456'
)
```

### PackagingItemService

#### create(item)
Add a scanned item to a packaging record.

```typescript
const item = await packagingItemService.create({
  packaging_record_id: 'record_id',
  product_barcode: '123456789'
})
```

#### getByRecordId(recordId)
Get all items for a packaging record.

```typescript
const items = await packagingItemService.getByRecordId('record_id')
```

#### deleteByRecordId(recordId)
Delete all items for a packaging record (cascade delete).

```typescript
await packagingItemService.deleteByRecordId('record_id')
```

## Job Service

Location: `src/lib/appwrite/jobs.ts`

### Methods

#### queueImport(userId, fileId)
Queue a product import job.

```typescript
const job = await jobService.queueImport('user_id', 'file_id')
```

#### queueExport(userId, filters?)
Queue a product export job.

```typescript
const job = await jobService.queueExport('user_id', {
  type: 'bundle'
})
```

#### queueReportExport(userId, format, dateRange)
Queue a report export job.

```typescript
const job = await jobService.queueReportExport('user_id', 'pdf', {
  startDate: '2024-01-01',
  endDate: '2024-01-31'
})
```

#### queueSendReportEmail(userId, fileId, recipients)
Queue an email sending job.

```typescript
const job = await jobService.queueSendReportEmail(
  'user_id',
  'file_id',
  ['recipient@example.com']
)
```

#### getJob(jobId)
Get job details by ID.

```typescript
const job = await jobService.getJob('job_id')
```

#### getActiveJobs(userId)
Get pending or processing jobs for a user.

```typescript
const jobs = await jobService.getActiveJobs('user_id')
```

#### updateJobStatus(jobId, status, data?)
Update job status and optional metadata.

```typescript
await jobService.updateJobStatus('job_id', 'completed', {
  result_file_id: 'file_id',
  stats: JSON.stringify({ imported: 100, failed: 2 })
})
```

## Storage Service

Location: `src/lib/appwrite/storage.ts`

### Methods

#### uploadFile(file, bucketId?)
Upload a file to storage.

```typescript
const fileInfo = await storageService.uploadFile(file, 'exports')
// Returns: { $id: string, name: string, ... }
```

#### getFileDownloadUrl(fileId, bucketId?)
Get a download URL for a file.

```typescript
const url = await storageService.getFileDownloadUrl('file_id')
```

#### deleteFile(fileId, bucketId?)
Delete a file from storage.

```typescript
await storageService.deleteFile('file_id')
```

#### downloadFile(fileId, bucketId?)
Download file content as ArrayBuffer.

```typescript
const content = await storageService.downloadFile('file_id')
```

## React Query Hooks

Location: `src/hooks/`

### useProducts()
Fetch products with filtering and pagination.

```typescript
const { data, isLoading, error } = useProducts({
  type: 'bundle',
  search: 'widget',
  limit: 25,
  offset: 0
})
```

### useCreateProduct()
Mutation hook for creating products.

```typescript
const createProduct = useCreateProduct()
await createProduct.mutateAsync(productData)
```

### useUpdateProduct()
Mutation hook for updating products.

```typescript
const updateProduct = useUpdateProduct()
await updateProduct.mutateAsync({ id: 'product_id', data: updates })
```

### useDeleteProduct()
Mutation hook for deleting products.

```typescript
const deleteProduct = useDeleteProduct()
await deleteProduct.mutateAsync('product_id')
```

### useJobs()
Fetch jobs with filtering.

```typescript
const { data, isLoading } = useJobs({
  userId: 'user_id',
  action: 'export-excel',
  status: 'completed'
})
```

### useActiveJobs()
Fetch pending/processing jobs with auto-refresh.

```typescript
const { data: activeJobs } = useActiveJobs('user_id')
// Auto-refreshes every 3 seconds
```

### useQueueImport()
Mutation hook for queuing import jobs.

```typescript
const queueImport = useQueueImport()
await queueImport.mutateAsync({ userId: 'user_id', fileId: 'file_id' })
```

### useQueueExport()
Mutation hook for queuing export jobs.

```typescript
const queueExport = useQueueExport()
await queueExport.mutateAsync({ userId: 'user_id', filters: { type: 'single' } })
```

### useDownloadExport()
Mutation hook for downloading export files.

```typescript
const downloadExport = useDownloadExport()
await downloadExport.mutateAsync('file_id')
```

## Collection IDs

Defined in `src/lib/appwrite/config.ts`:

```typescript
export const COLLECTIONS = {
  PRODUCTS: 'products',
  PRODUCT_COMPONENTS: 'product_components',
  PACKAGING_RECORDS: 'packaging_records',
  PACKAGING_ITEMS: 'packaging_items',
  IMPORT_JOBS: 'import_jobs'
}
```

## Query Helpers

Common Appwrite Query builders:

```typescript
import { Query } from 'appwrite'

// Equality
Query.equal('field', 'value')

// Comparison
Query.greaterThan('field', 10)
Query.lessThanEqual('field', 100)

// Contains (partial match)
Query.contains('field', 'search')

// Logical OR
Query.or([Query.equal('a', 1), Query.equal('b', 2)])

// Ordering
Query.orderAsc('field')
Query.orderDesc('$createdAt')

// Pagination
Query.limit(25)
Query.offset(50)

// Cursor-based pagination
Query.cursorAfter('last_doc_id')
```
