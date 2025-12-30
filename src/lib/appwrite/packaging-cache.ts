import { databaseService, Query } from './database'

import type { PackagingCache, PackagingRecordWithProducts } from '@/types/packaging'
import { COLLECTIONS } from '@/types/packaging'

/**
 * Cache service for packaging data using Appwrite database
 * Implements cache-aside pattern for historical packaging records
 * Cached data includes product names and bundle components for fast retrieval
 */
export const packagingCacheService = {
  /**
   * Get cached packaging data for a specific date
   * @param dateString - Date in YYYY-MM-DD format
   * @returns Cached packaging records with product info or null if not cached
   */
  async get(dateString: string): Promise<PackagingRecordWithProducts[] | null> {
    try {
      console.log(`[Cache] Looking for cache: ${dateString}`)
      const result = await databaseService.listDocuments<PackagingCache>(
        COLLECTIONS.PACKAGING_CACHE,
        [Query.equal('cache_date', dateString), Query.limit(1)]
      )

      if (result.documents.length === 0) {
        console.log(`[Cache] MISS - No cache found for ${dateString}`)
        return null
      }

      const cache = result.documents[0]
      const parsed = JSON.parse(cache.data) as PackagingRecordWithProducts[]
      console.log(`[Cache] HIT - Found ${parsed.length} records for ${dateString}`)
      return parsed
    } catch (error) {
      console.error('[Cache] Error fetching packaging cache:', error)
      return null
    }
  },

  /**
   * Store packaging data in cache for a specific date
   * @param dateString - Date in YYYY-MM-DD format
   * @param data - Packaging records with product info to cache
   */
  async set(
    dateString: string,
    data: PackagingRecordWithProducts[]
  ): Promise<void> {
    try {
      // Check if cache already exists for this date
      const existing = await databaseService.listDocuments<PackagingCache>(
        COLLECTIONS.PACKAGING_CACHE,
        [Query.equal('cache_date', dateString), Query.limit(1)]
      )

      const cacheData = {
        cache_date: dateString,
        data: JSON.stringify(data),
        cached_at: new Date().toISOString(),
      }

      if (existing.documents.length > 0) {
        // Update existing cache
        await databaseService.updateDocument<PackagingCache>(
          COLLECTIONS.PACKAGING_CACHE,
          existing.documents[0].$id,
          cacheData
        )
      } else {
        // Create new cache entry
        await databaseService.createDocument<PackagingCache>(
          COLLECTIONS.PACKAGING_CACHE,
          cacheData
        )
      }
    } catch (error) {
      console.error('Error setting packaging cache:', error)
      throw error
    }
  },

  /**
   * Invalidate (delete) cache for a specific date
   * @param dateString - Date in YYYY-MM-DD format
   */
  async invalidate(dateString: string): Promise<void> {
    try {
      const result = await databaseService.listDocuments<PackagingCache>(
        COLLECTIONS.PACKAGING_CACHE,
        [Query.equal('cache_date', dateString), Query.limit(1)]
      )

      if (result.documents.length > 0) {
        await databaseService.deleteDocument(
          COLLECTIONS.PACKAGING_CACHE,
          result.documents[0].$id
        )
      }
    } catch (error) {
      console.error('Error invalidating packaging cache:', error)
    }
  },

  /**
   * Check if cache exists for a specific date
   * @param dateString - Date in YYYY-MM-DD format
   */
  async exists(dateString: string): Promise<boolean> {
    try {
      const result = await databaseService.listDocuments<PackagingCache>(
        COLLECTIONS.PACKAGING_CACHE,
        [Query.equal('cache_date', dateString), Query.limit(1)]
      )
      return result.documents.length > 0
    } catch (error) {
      console.error('Error checking packaging cache:', error)
      return false
    }
  },
}
