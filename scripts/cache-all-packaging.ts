/**
 * Script to cache all historical packaging data
 *
 * This script queries the database to find all packaging dates,
 * then caches each date's data (excluding today).
 *
 * Usage:
 *   npx tsx scripts/cache-all-packaging.ts
 */

import dotenv from 'dotenv'

dotenv.config()
dotenv.config({ path: '.env.local' })

import { Client, Databases, ID, Query } from 'node-appwrite'

const config = {
  endpoint: process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
  projectId: process.env.VITE_APPWRITE_PROJECT_ID || '',
  apiKey: process.env.APPWRITE_API_KEY || '',
  databaseId: process.env.VITE_APPWRITE_DATABASE_ID || '',
}

const COLLECTIONS = {
  PACKAGING_RECORDS: 'packaging_records',
  PACKAGING_ITEMS: 'packaging_items',
  PACKAGING_CACHE: 'packaging_cache',
} as const

const client = new Client()
  .setEndpoint(config.endpoint)
  .setProject(config.projectId)
  .setKey(config.apiKey)

const databases = new Databases(client)

const API_DELAY = 50
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

interface PackagingRecord {
  $id: string
  $createdAt: string
  $updatedAt: string
  packaging_date: string
  waybill_number: string
}

interface PackagingItem {
  $id: string
  $createdAt: string
  $updatedAt: string
  packaging_record_id: string
  product_barcode: string
  scanned_at: string
}

interface PackagingRecordWithItems extends PackagingRecord {
  items: PackagingItem[]
}

async function getAllUniqueDates(): Promise<string[]> {
  console.log('Fetching all unique packaging dates...')

  const allDates = new Set<string>()
  let offset = 0
  const limit = 100

  while (true) {
    const result = await databases.listDocuments(
      config.databaseId,
      COLLECTIONS.PACKAGING_RECORDS,
      [
        Query.orderAsc('packaging_date'),
        Query.limit(limit),
        Query.offset(offset),
      ]
    )

    for (const doc of result.documents) {
      allDates.add(doc.packaging_date as string)
    }

    if (result.documents.length < limit) break
    offset += limit
    await delay(API_DELAY)
  }

  const today = getTodayDate()
  const historicalDates = Array.from(allDates)
    .filter(date => date !== today)
    .sort()

  return historicalDates
}

async function fetchPackagingRecordsByDate(dateString: string): Promise<PackagingRecordWithItems[]> {
  const allRecords: PackagingRecord[] = []
  let offset = 0
  const limit = 100

  while (true) {
    const result = await databases.listDocuments(
      config.databaseId,
      COLLECTIONS.PACKAGING_RECORDS,
      [
        Query.equal('packaging_date', dateString),
        Query.orderDesc('$createdAt'),
        Query.limit(limit),
        Query.offset(offset),
      ]
    )

    for (const doc of result.documents) {
      allRecords.push({
        $id: doc.$id,
        $createdAt: doc.$createdAt,
        $updatedAt: doc.$updatedAt,
        packaging_date: doc.packaging_date as string,
        waybill_number: doc.waybill_number as string,
      })
    }

    if (result.documents.length < limit) break
    offset += limit
    await delay(API_DELAY)
  }

  const recordsWithItems: PackagingRecordWithItems[] = []

  for (const record of allRecords) {
    const itemsResult = await databases.listDocuments(
      config.databaseId,
      COLLECTIONS.PACKAGING_ITEMS,
      [
        Query.equal('packaging_record_id', record.$id),
        Query.orderDesc('scanned_at'),
      ]
    )

    const items: PackagingItem[] = itemsResult.documents.map((item) => ({
      $id: item.$id,
      $createdAt: item.$createdAt,
      $updatedAt: item.$updatedAt,
      packaging_record_id: item.packaging_record_id as string,
      product_barcode: item.product_barcode as string,
      scanned_at: item.scanned_at as string,
    }))

    recordsWithItems.push({
      ...record,
      items,
    })

    await delay(API_DELAY)
  }

  return recordsWithItems
}

async function cachePackagingData(dateString: string, data: PackagingRecordWithItems[]): Promise<void> {
  const existing = await databases.listDocuments(
    config.databaseId,
    COLLECTIONS.PACKAGING_CACHE,
    [Query.equal('cache_date', dateString), Query.limit(1)]
  )

  const cacheData = {
    cache_date: dateString,
    data: JSON.stringify(data),
    cached_at: new Date().toISOString(),
  }

  if (existing.documents.length > 0) {
    await databases.updateDocument(
      config.databaseId,
      COLLECTIONS.PACKAGING_CACHE,
      existing.documents[0].$id,
      cacheData
    )
  } else {
    await databases.createDocument(
      config.databaseId,
      COLLECTIONS.PACKAGING_CACHE,
      ID.unique(),
      cacheData
    )
  }
}

async function main() {
  console.log('='.repeat(50))
  console.log('Cache All Historical Packaging Data')
  console.log('='.repeat(50))

  if (!config.projectId || !config.apiKey || !config.databaseId) {
    console.error('Error: Missing required environment variables')
    process.exit(1)
  }

  console.log(`\nEndpoint: ${config.endpoint}`)
  console.log(`Project: ${config.projectId}`)
  console.log(`Database: ${config.databaseId}`)
  console.log(`Today: ${getTodayDate()} (will be skipped)\n`)

  try {
    // Get all unique dates
    const dates = await getAllUniqueDates()

    if (dates.length === 0) {
      console.log('No historical packaging data found to cache.')
      return
    }

    console.log(`Found ${dates.length} historical date(s) to cache:`)
    console.log(dates.join(', '))
    console.log('')

    let successCount = 0
    let totalRecords = 0
    let totalItems = 0

    for (let i = 0; i < dates.length; i++) {
      const dateString = dates[i]
      process.stdout.write(`[${i + 1}/${dates.length}] Caching ${dateString}... `)

      try {
        const records = await fetchPackagingRecordsByDate(dateString)
        const itemCount = records.reduce((sum, r) => sum + r.items.length, 0)

        await cachePackagingData(dateString, records)

        console.log(`✓ ${records.length} records, ${itemCount} items`)
        successCount++
        totalRecords += records.length
        totalItems += itemCount
      } catch (error) {
        console.log(`✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }

      await delay(100) // Small delay between dates
    }

    console.log('\n' + '='.repeat(50))
    console.log('Cache warmup completed!')
    console.log(`  Dates cached: ${successCount}/${dates.length}`)
    console.log(`  Total records: ${totalRecords}`)
    console.log(`  Total items: ${totalItems}`)
    console.log('='.repeat(50))

  } catch (error) {
    console.error('\nError:', error)
    process.exit(1)
  }
}

main()
