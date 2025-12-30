/**
 * Database Population Script
 *
 * Directly populates Appwrite database tables with sample data.
 *
 * Usage:
 *   npx tsx scripts/populate-database.ts
 *
 * Required environment variables:
 *   VITE_APPWRITE_ENDPOINT    - Appwrite server endpoint
 *   VITE_APPWRITE_PROJECT_ID  - Project ID
 *   VITE_APPWRITE_DATABASE_ID - Database ID
 *   APPWRITE_API_KEY          - Server API key with databases.write permission
 */

import 'dotenv/config'

import { Client, Databases, ID } from 'node-appwrite'

// Configuration
const config = {
  endpoint: process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
  projectId: process.env.VITE_APPWRITE_PROJECT_ID || '',
  apiKey: process.env.APPWRITE_API_KEY || '',
  databaseId: process.env.VITE_APPWRITE_DATABASE_ID || '',
}

// Collection IDs
const COLLECTIONS = {
  PRODUCTS: 'products',
  PRODUCT_COMPONENTS: 'product_components',
  PACKAGING_RECORDS: 'packaging_records',
  PACKAGING_ITEMS: 'packaging_items',
  IMPORT_JOBS: 'import_jobs',
}

// Initialize Appwrite client
const client = new Client()
  .setEndpoint(config.endpoint)
  .setProject(config.projectId)
  .setKey(config.apiKey)

const databases = new Databases(client)

// Sample product data
const singleProducts = [
  { barcode: '5901234567890', sku_code: 'SKU-A00001', name: 'Premium Widget Pro', type: 'single', cost: 24.99, stock_quantity: 150 },
  { barcode: '5901234567891', sku_code: 'SKU-A00002', name: 'Classic Gadget Max', type: 'single', cost: 49.99, stock_quantity: 75 },
  { barcode: '5901234567892', sku_code: 'SKU-A00003', name: 'Essential Tool Kit', type: 'single', cost: 12.50, stock_quantity: 200 },
  { barcode: '5901234567893', sku_code: 'SKU-B00001', name: 'Professional Device SE', type: 'single', cost: 89.99, stock_quantity: 50 },
  { barcode: '5901234567894', sku_code: 'SKU-B00002', name: 'Deluxe Accessory Pack', type: 'single', cost: 34.99, stock_quantity: 120 },
  { barcode: '5901234567895', sku_code: 'SKU-C00001', name: 'Smart Module V2', type: 'single', cost: 67.00, stock_quantity: 85 },
  { barcode: '5901234567896', sku_code: 'SKU-C00002', name: 'Compact Unit Lite', type: 'single', cost: 19.99, stock_quantity: 300 },
  { barcode: '5901234567897', sku_code: 'SKU-D00001', name: 'Heavy-Duty Equipment', type: 'single', cost: 149.99, stock_quantity: 25 },
  { barcode: '5901234567898', sku_code: 'SKU-D00002', name: 'Portable Gear Mini', type: 'single', cost: 29.99, stock_quantity: 180 },
  { barcode: '5901234567899', sku_code: 'SKU-E00001', name: 'Eco-Friendly Supply', type: 'single', cost: 15.00, stock_quantity: 250 },
  { barcode: '5901234567900', sku_code: null, name: 'Basic Component Alpha', type: 'single', cost: 8.99, stock_quantity: 500 },
  { barcode: '5901234567901', sku_code: null, name: 'Standard Part Beta', type: 'single', cost: 11.50, stock_quantity: 400 },
]

const bundleProducts = [
  { barcode: '5909876543210', sku_code: 'BND-001', name: 'Starter Bundle Pack', type: 'bundle', cost: 99.99, stock_quantity: 0 },
  { barcode: '5909876543211', sku_code: 'BND-002', name: 'Professional Bundle Set', type: 'bundle', cost: 249.99, stock_quantity: 0 },
  { barcode: '5909876543212', sku_code: 'BND-003', name: 'Ultimate Value Bundle', type: 'bundle', cost: 399.99, stock_quantity: 0 },
]

// Format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// Generate ISO datetime string
function generateTimestamp(dateStr: string, hour: number, minute: number): string {
  return `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000+00:00`
}

async function populateProducts(): Promise<Map<string, string>> {
  console.log('\n📦 Populating Products...')
  const barcodeToId = new Map<string, string>()

  const allProducts = [...singleProducts, ...bundleProducts]

  for (const product of allProducts) {
    try {
      const doc = await databases.createDocument(
        config.databaseId,
        COLLECTIONS.PRODUCTS,
        ID.unique(),
        product
      )
      barcodeToId.set(product.barcode, doc.$id)
      console.log(`  ✓ Created: ${product.name}`)
    } catch (error) {
      const err = error as Error
      console.error(`  ✗ Failed to create ${product.name}: ${err.message}`)
    }
  }

  console.log(`  Total products created: ${barcodeToId.size}`)
  return barcodeToId
}

async function populateProductComponents(barcodeToId: Map<string, string>): Promise<void> {
  console.log('\n🔗 Populating Product Components (Bundle Recipes)...')

  // Get bundle and single product IDs
  const bundleIds = bundleProducts.map(p => barcodeToId.get(p.barcode)).filter(Boolean) as string[]
  const singleIds = singleProducts.map(p => barcodeToId.get(p.barcode)).filter(Boolean) as string[]

  if (bundleIds.length === 0 || singleIds.length === 0) {
    console.log('  No bundles or singles found, skipping components')
    return
  }

  // Bundle 1: Starter Bundle - 3 items
  const bundle1Components = [
    { parent_product_id: bundleIds[0], child_product_id: singleIds[0], quantity: 1 },
    { parent_product_id: bundleIds[0], child_product_id: singleIds[2], quantity: 2 },
    { parent_product_id: bundleIds[0], child_product_id: singleIds[6], quantity: 1 },
  ]

  // Bundle 2: Professional Bundle - 4 items
  const bundle2Components = [
    { parent_product_id: bundleIds[1], child_product_id: singleIds[1], quantity: 1 },
    { parent_product_id: bundleIds[1], child_product_id: singleIds[3], quantity: 1 },
    { parent_product_id: bundleIds[1], child_product_id: singleIds[5], quantity: 2 },
    { parent_product_id: bundleIds[1], child_product_id: singleIds[8], quantity: 1 },
  ]

  // Bundle 3: Ultimate Value Bundle - 5 items
  const bundle3Components = [
    { parent_product_id: bundleIds[2], child_product_id: singleIds[0], quantity: 2 },
    { parent_product_id: bundleIds[2], child_product_id: singleIds[3], quantity: 1 },
    { parent_product_id: bundleIds[2], child_product_id: singleIds[4], quantity: 3 },
    { parent_product_id: bundleIds[2], child_product_id: singleIds[7], quantity: 1 },
    { parent_product_id: bundleIds[2], child_product_id: singleIds[9], quantity: 2 },
  ]

  const allComponents = [...bundle1Components, ...bundle2Components, ...bundle3Components]
  let created = 0

  for (const component of allComponents) {
    try {
      await databases.createDocument(
        config.databaseId,
        COLLECTIONS.PRODUCT_COMPONENTS,
        ID.unique(),
        component
      )
      created++
    } catch (error) {
      const err = error as Error
      console.error(`  ✗ Failed to create component: ${err.message}`)
    }
  }

  console.log(`  ✓ Created ${created} bundle components`)
}

async function populatePackagingRecords(barcodeToId: Map<string, string>): Promise<void> {
  console.log('\n📋 Populating Packaging Records...')

  const today = new Date()
  const dates = [
    formatDate(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)), // 6 days ago
    formatDate(new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000)), // 5 days ago
    formatDate(new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000)), // 4 days ago
    formatDate(new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000)), // 3 days ago
    formatDate(new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000)), // 2 days ago
    formatDate(new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000)), // yesterday
    formatDate(today), // today
  ]

  const productBarcodes = Array.from(barcodeToId.keys())
  if (productBarcodes.length === 0) {
    console.log('  No products found, skipping packaging records')
    return
  }

  let recordsCreated = 0
  let itemsCreated = 0

  for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
    const dateStr = dates[dayIndex]
    const recordsPerDay = 2 + dayIndex % 3 // 2-4 records per day

    for (let i = 0; i < recordsPerDay; i++) {
      const waybill = `WB-${dateStr.replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`

      try {
        // Create packaging record
        const record = await databases.createDocument(
          config.databaseId,
          COLLECTIONS.PACKAGING_RECORDS,
          ID.unique(),
          {
            packaging_date: dateStr,
            waybill_number: waybill,
          }
        )
        recordsCreated++

        // Create 3-6 items per record
        const itemCount = 3 + (i % 4)
        for (let j = 0; j < itemCount; j++) {
          const barcodeIndex = (dayIndex * 3 + i * 2 + j) % productBarcodes.length
          const barcode = productBarcodes[barcodeIndex]
          const hour = 8 + j + i * 2
          const minute = (j * 15) % 60

          try {
            await databases.createDocument(
              config.databaseId,
              COLLECTIONS.PACKAGING_ITEMS,
              ID.unique(),
              {
                packaging_record_id: record.$id,
                product_barcode: barcode,
                scanned_at: generateTimestamp(dateStr, hour, minute),
              }
            )
            itemsCreated++
          } catch (error) {
            const err = error as Error
            console.error(`  ✗ Failed to create item: ${err.message}`)
          }
        }
      } catch (error) {
        const err = error as Error
        console.error(`  ✗ Failed to create record ${waybill}: ${err.message}`)
      }
    }
  }

  console.log(`  ✓ Created ${recordsCreated} packaging records`)
  console.log(`  ✓ Created ${itemsCreated} packaging items`)
}

async function populateImportJobs(): Promise<void> {
  console.log('\n📥 Populating Import Jobs...')

  const now = new Date()
  const jobs = [
    {
      user_id: 'sample-user-001',
      action: 'import-excel',
      status: 'completed',
      file_id: null,
      result_file_id: null,
      filters: null,
      stats: JSON.stringify({ processed: 100, created: 98, updated: 0, failed: 2 }),
      error: null,
      created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 30000).toISOString(),
    },
    {
      user_id: 'sample-user-001',
      action: 'export-excel',
      status: 'completed',
      file_id: null,
      result_file_id: null,
      filters: JSON.stringify({ dateFrom: '2024-12-01', dateTo: '2024-12-29' }),
      stats: JSON.stringify({ exported: 250 }),
      error: null,
      created_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000 + 15000).toISOString(),
    },
    {
      user_id: 'sample-user-002',
      action: 'export-reporting-pdf',
      status: 'completed',
      file_id: null,
      result_file_id: null,
      filters: JSON.stringify({ reportType: 'daily-summary' }),
      stats: JSON.stringify({ pages: 5 }),
      error: null,
      created_at: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date(now.getTime() - 12 * 60 * 60 * 1000 + 45000).toISOString(),
    },
  ]

  let created = 0

  for (const job of jobs) {
    try {
      await databases.createDocument(
        config.databaseId,
        COLLECTIONS.IMPORT_JOBS,
        ID.unique(),
        job
      )
      created++
    } catch (error) {
      const err = error as Error
      console.error(`  ✗ Failed to create job: ${err.message}`)
    }
  }

  console.log(`  ✓ Created ${created} import jobs`)
}

async function main() {
  console.log('='.repeat(60))
  console.log('Database Population Script')
  console.log('='.repeat(60))

  // Validate configuration
  if (!config.projectId) {
    console.error('Error: VITE_APPWRITE_PROJECT_ID is not set')
    process.exit(1)
  }
  if (!config.apiKey) {
    console.error('Error: APPWRITE_API_KEY is not set')
    process.exit(1)
  }
  if (!config.databaseId) {
    console.error('Error: VITE_APPWRITE_DATABASE_ID is not set')
    process.exit(1)
  }

  console.log(`\nEndpoint: ${config.endpoint}`)
  console.log(`Project: ${config.projectId}`)
  console.log(`Database: ${config.databaseId}`)

  const startTime = Date.now()

  try {
    // Populate in order (respecting dependencies)
    const barcodeToId = await populateProducts()
    await populateProductComponents(barcodeToId)
    await populatePackagingRecords(barcodeToId)
    await populateImportJobs()

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log('\n' + '='.repeat(60))
    console.log('✅ Database Population Complete!')
    console.log('='.repeat(60))
    console.log(`Total time: ${elapsed}s`)

  } catch (error) {
    console.error('\n❌ Population failed:', error)
    process.exit(1)
  }
}

main()
