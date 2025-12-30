import { databaseService, Query } from './database'
import { packagingCacheService } from './packaging-cache'
import { productService } from './products'
import { auditLogService } from './audit-log'
import { getTodayDate } from '@/lib/utils'

import type {
  CreatePackagingItemInput,
  CreatePackagingRecordInput,
  PackagingItem,
  PackagingRecord,
  PackagingRecordWithItems,
  PackagingRecordWithProducts,
  PackagingItemWithProduct,
} from '@/types/packaging'
import { COLLECTIONS } from '@/types/packaging'
import type { Product } from '@/types/product'

export const packagingRecordService = {
  /**
   * Create a new packaging record
   */
  async create(data: CreatePackagingRecordInput): Promise<PackagingRecord> {
    try {
      const record = await databaseService.createDocument<PackagingRecord>(
        COLLECTIONS.PACKAGING_RECORDS,
        {
          packaging_date: data.packaging_date,
          waybill_number: data.waybill_number,
        }
      )

      auditLogService.log('packaging_record_create', 'packaging_record', {
        resource_id: record.$id,
        action_details: {
          packaging_date: data.packaging_date,
          waybill_number: data.waybill_number,
        },
      }).catch(console.error)

      return record
    } catch (error) {
      auditLogService.log('packaging_record_create', 'packaging_record', {
        action_details: data,
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  /**
   * Get a packaging record by ID
   */
  async getById(recordId: string): Promise<PackagingRecord> {
    const record = await databaseService.getDocument<PackagingRecord>(
      COLLECTIONS.PACKAGING_RECORDS,
      recordId
    )

    auditLogService.log('packaging_record_view', 'packaging_record', {
      resource_id: recordId,
      action_details: {
        packaging_date: record.packaging_date,
        waybill_number: record.waybill_number,
      },
    }).catch(console.error)

    return record
  },

  /**
   * Check if a waybill exists for a specific date
   */
  async getByDateAndWaybill(
    date: string,
    waybill: string
  ): Promise<PackagingRecord | null> {
    const result = await databaseService.listDocuments<PackagingRecord>(
      COLLECTIONS.PACKAGING_RECORDS,
      [
        Query.equal('packaging_date', date),
        Query.equal('waybill_number', waybill),
        Query.limit(1),
      ]
    )
    return result.documents[0] ?? null
  },

  /**
   * List all packaging records for a specific date (direct database query)
   * Use getPackagingByDate for cache-aside pattern
   */
  async listByDate(date: string): Promise<PackagingRecordWithItems[]> {
    const result = await databaseService.listDocuments<PackagingRecord>(
      COLLECTIONS.PACKAGING_RECORDS,
      [Query.equal('packaging_date', date), Query.orderDesc('$createdAt')]
    )

    // Fetch items for each record
    const recordsWithItems = await Promise.all(
      result.documents.map(async (record) => {
        const items = await packagingItemService.listByRecordId(record.$id)
        return {
          ...record,
          items,
        }
      })
    )

    auditLogService.log('packaging_list_by_date', 'packaging_record', {
      action_details: {
        date,
        recordCount: recordsWithItems.length,
        totalItems: recordsWithItems.reduce((sum, r) => sum + r.items.length, 0),
      },
    }).catch(console.error)

    return recordsWithItems
  },

  /**
   * Enrich packaging records with product names and bundle components
   * Uses batch fetching for efficiency
   */
  async enrichWithProducts(
    records: PackagingRecordWithItems[]
  ): Promise<PackagingRecordWithProducts[]> {
    // Collect all unique barcodes
    const allBarcodes = new Set<string>()
    for (const record of records) {
      for (const item of record.items) {
        allBarcodes.add(item.product_barcode)
      }
    }

    // Batch fetch all products
    const productMap = new Map<string, Product>()
    const barcodeArray = Array.from(allBarcodes)

    // Fetch products in batches of 50
    for (let i = 0; i < barcodeArray.length; i += 50) {
      const batch = barcodeArray.slice(i, i + 50)
      const result = await productService.list({
        barcodes: batch,
        limit: 50,
      })
      for (const product of result.documents) {
        productMap.set(product.barcode, product)
      }
    }

    // Fetch bundle components for all bundle products
    const bundleProducts = Array.from(productMap.values()).filter(
      (p) => p.type === 'bundle'
    )
    const bundleComponentsMap = new Map<
      string,
      Array<{ barcode: string; productName: string; quantity: number }>
    >()

    for (const bundle of bundleProducts) {
      try {
        const withComponents = await productService.getWithComponents(bundle.$id)
        if (withComponents.components && withComponents.components.length > 0) {
          bundleComponentsMap.set(
            bundle.barcode,
            withComponents.components.map((comp) => ({
              barcode: comp.product.barcode,
              productName: comp.product.name,
              quantity: comp.quantity,
            }))
          )
        }
      } catch {
        // Skip if components can't be fetched
      }
    }

    // Enrich records with product info
    return records.map((record) => ({
      ...record,
      items: record.items.map((item): PackagingItemWithProduct => {
        const product = productMap.get(item.product_barcode)
        return {
          ...item,
          product_name: product?.name ?? 'Unknown Product',
          is_bundle: product?.type === 'bundle',
          bundle_components: bundleComponentsMap.get(item.product_barcode),
        }
      }),
    }))
  },

  /**
   * Get packaging records by date with cache-aside pattern
   * - For today: Query database directly for real-time data
   * - For past dates: Check cache first, fallback to database and update cache
   * Returns records with product names and bundle info included
   */
  async getPackagingByDate(date: string): Promise<PackagingRecordWithProducts[]> {
    const today = getTodayDate()
    console.log(`[Packaging] getPackagingByDate called for: ${date}, today is: ${today}`)

    // For today's date, always fetch from database for real-time editing
    if (date === today) {
      console.log(`[Packaging] Fetching TODAY from database (no cache)`)
      const records = await this.listByDate(date)
      const enrichedRecords = await this.enrichWithProducts(records)

      auditLogService.log('packaging_view_by_date', 'packaging_record', {
        action_details: {
          date,
          recordCount: enrichedRecords.length,
          source: 'database',
        },
      }).catch(console.error)

      return enrichedRecords
    }

    // For historical dates, try cache first
    console.log(`[Packaging] Historical date - checking cache...`)
    const cachedData = await packagingCacheService.get(date)
    if (cachedData !== null) {
      console.log(`[Packaging] Cache HIT! Returning ${cachedData.length} records`)
      auditLogService.log('packaging_view_by_date', 'packaging_record', {
        action_details: {
          date,
          recordCount: cachedData.length,
          source: 'cache',
        },
      }).catch(console.error)

      return cachedData
    }

    // Cache miss: fetch from database and enrich with product info
    console.log(`[Packaging] Cache MISS - fetching from database...`)
    const records = await this.listByDate(date)
    const enrichedRecords = await this.enrichWithProducts(records)

    // Store in cache for future requests (async, don't wait)
    console.log(`[Packaging] Storing ${enrichedRecords.length} records in cache...`)
    packagingCacheService.set(date, enrichedRecords).catch((error) => {
      console.error('Failed to update packaging cache:', error)
    })

    auditLogService.log('packaging_view_by_date', 'packaging_record', {
      action_details: {
        date,
        recordCount: enrichedRecords.length,
        source: 'database_cache_miss',
      },
    }).catch(console.error)

    return enrichedRecords
  },

  /**
   * Get a packaging record with all its items
   */
  async getWithItems(recordId: string): Promise<PackagingRecordWithItems> {
    const record = await this.getById(recordId)
    const items = await packagingItemService.listByRecordId(recordId)
    return {
      ...record,
      items,
    }
  },

  /**
   * Delete a packaging record and all its items
   */
  async delete(recordId: string): Promise<void> {
    try {
      // Get record details before deletion for audit
      let recordDetails: Record<string, unknown> = {}
      try {
        const record = await databaseService.getDocument<PackagingRecord>(
          COLLECTIONS.PACKAGING_RECORDS,
          recordId
        )
        recordDetails = {
          packaging_date: record.packaging_date,
          waybill_number: record.waybill_number,
        }
      } catch {
        // Record may not exist, continue with deletion
      }

      // First, delete all items for this record
      const items = await packagingItemService.listByRecordId(recordId)
      for (const item of items) {
        await databaseService.deleteDocument(COLLECTIONS.PACKAGING_ITEMS, item.$id)
      }

      // Delete the record
      await databaseService.deleteDocument(COLLECTIONS.PACKAGING_RECORDS, recordId)

      auditLogService.log('packaging_record_delete', 'packaging_record', {
        resource_id: recordId,
        action_details: {
          ...recordDetails,
          itemsDeleted: items.length,
        },
      }).catch(console.error)
    } catch (error) {
      auditLogService.log('packaging_record_delete', 'packaging_record', {
        resource_id: recordId,
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },
}

export const packagingItemService = {
  /**
   * Create a new packaging item
   */
  async create(data: CreatePackagingItemInput): Promise<PackagingItem> {
    try {
      const item = await databaseService.createDocument<PackagingItem>(
        COLLECTIONS.PACKAGING_ITEMS,
        {
          packaging_record_id: data.packaging_record_id,
          product_barcode: data.product_barcode,
          scanned_at: data.scanned_at ?? new Date().toISOString(),
        }
      )

      auditLogService.log('packaging_item_scan', 'packaging_item', {
        resource_id: item.$id,
        action_details: {
          packaging_record_id: data.packaging_record_id,
          product_barcode: data.product_barcode,
        },
      }).catch(console.error)

      return item
    } catch (error) {
      auditLogService.log('packaging_item_scan', 'packaging_item', {
        action_details: data,
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  /**
   * Get all items for a packaging record
   */
  async listByRecordId(recordId: string): Promise<PackagingItem[]> {
    const result = await databaseService.listDocuments<PackagingItem>(
      COLLECTIONS.PACKAGING_ITEMS,
      [
        Query.equal('packaging_record_id', recordId),
        Query.orderDesc('scanned_at'),
      ]
    )
    return result.documents
  },

  /**
   * Delete a packaging item
   */
  async delete(itemId: string): Promise<void> {
    try {
      // Get item details before deletion for audit
      let itemDetails: Record<string, unknown> = {}
      try {
        const item = await databaseService.getDocument<PackagingItem>(
          COLLECTIONS.PACKAGING_ITEMS,
          itemId
        )
        itemDetails = {
          packaging_record_id: item.packaging_record_id,
          product_barcode: item.product_barcode,
        }
      } catch {
        // Item may not exist, continue with deletion
      }

      await databaseService.deleteDocument(COLLECTIONS.PACKAGING_ITEMS, itemId)

      auditLogService.log('packaging_item_remove', 'packaging_item', {
        resource_id: itemId,
        action_details: itemDetails,
      }).catch(console.error)
    } catch (error) {
      auditLogService.log('packaging_item_remove', 'packaging_item', {
        resource_id: itemId,
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },
}
