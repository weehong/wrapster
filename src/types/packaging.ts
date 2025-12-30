import type { Models } from 'appwrite'

/**
 * Packaging record document from Appwrite
 * Represents a waybill entry for a specific date
 */
export interface PackagingRecord extends Models.Document {
  packaging_date: string // YYYY-MM-DD format
  waybill_number: string
}

/**
 * Packaging item document from Appwrite
 * Represents a single product scan within a packaging record
 */
export interface PackagingItem extends Models.Document {
  packaging_record_id: string
  product_barcode: string
  scanned_at: string // ISO datetime
}

/**
 * Bundle component info for display
 */
export interface BundleComponentInfo {
  barcode: string
  productName: string
  quantity: number
}

/**
 * Packaging item with product details (for display/caching)
 */
export interface PackagingItemWithProduct extends PackagingItem {
  product_name: string
  is_bundle?: boolean
  bundle_components?: BundleComponentInfo[]
}

/**
 * Packaging record with its items expanded
 */
export interface PackagingRecordWithItems extends PackagingRecord {
  items: PackagingItem[]
}

/**
 * Packaging record with items including product details (for display/caching)
 */
export interface PackagingRecordWithProducts extends PackagingRecord {
  items: PackagingItemWithProduct[]
}

/**
 * Input data for creating a new packaging record
 */
export type CreatePackagingRecordInput = {
  packaging_date: string
  waybill_number: string
}

/**
 * Input data for creating a packaging item
 */
export type CreatePackagingItemInput = {
  packaging_record_id: string
  product_barcode: string
  scanned_at?: string // Auto-set to current timestamp if not provided
}

/**
 * Cached packaging data for historical dates
 * Stored as serialized JSON in Appwrite database
 */
export interface PackagingCache extends Models.Document {
  cache_date: string // YYYY-MM-DD format - the date this cache represents
  data: string // JSON stringified PackagingRecordWithItems[]
  cached_at: string // ISO datetime when cache was created
}

/**
 * Collection IDs for Appwrite
 */
export const COLLECTIONS = {
  PACKAGING_RECORDS: 'packaging_records',
  PACKAGING_ITEMS: 'packaging_items',
  PACKAGING_CACHE: 'packaging_cache',
} as const
