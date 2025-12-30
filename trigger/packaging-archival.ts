import { schedules, task, logger } from "@trigger.dev/sdk/v3";
import { Client, Databases, ID, Query } from "node-appwrite";

interface PackagingRecord {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  packaging_date: string;
  waybill_number: string;
}

interface PackagingItem {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  packaging_record_id: string;
  product_barcode: string;
  scanned_at: string;
}

interface PackagingRecordWithItems extends PackagingRecord {
  items: PackagingItem[];
}

interface PackagingCache {
  cache_date: string;
  data: string;
  cached_at: string;
}

const COLLECTIONS = {
  PACKAGING_RECORDS: "packaging_records",
  PACKAGING_ITEMS: "packaging_items",
  PACKAGING_CACHE: "packaging_cache",
} as const;

const API_DELAY = 50;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createAppwriteClient() {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT!)
    .setProject(process.env.APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);

  return {
    databases: new Databases(client),
  };
}

/**
 * Get yesterday's date in YYYY-MM-DD format
 */
function getYesterdayDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split("T")[0];
}

/**
 * Fetch all packaging records for a specific date
 */
async function fetchPackagingRecordsByDate(
  databases: Databases,
  databaseId: string,
  dateString: string
): Promise<PackagingRecordWithItems[]> {
  const allRecords: PackagingRecord[] = [];
  let offset = 0;
  const limit = 100;

  // Fetch all records for the date
  while (true) {
    const result = await databases.listDocuments(
      databaseId,
      COLLECTIONS.PACKAGING_RECORDS,
      [
        Query.equal("packaging_date", dateString),
        Query.orderDesc("$createdAt"),
        Query.limit(limit),
        Query.offset(offset),
      ]
    );

    for (const doc of result.documents) {
      allRecords.push({
        $id: doc.$id,
        $createdAt: doc.$createdAt,
        $updatedAt: doc.$updatedAt,
        packaging_date: doc.packaging_date as string,
        waybill_number: doc.waybill_number as string,
      });
    }

    if (result.documents.length < limit) break;
    offset += limit;
    await delay(API_DELAY);
  }

  logger.info(`Fetched ${allRecords.length} packaging records for ${dateString}`);

  // Fetch items for each record
  const recordsWithItems: PackagingRecordWithItems[] = [];

  for (const record of allRecords) {
    const itemsResult = await databases.listDocuments(
      databaseId,
      COLLECTIONS.PACKAGING_ITEMS,
      [
        Query.equal("packaging_record_id", record.$id),
        Query.orderDesc("scanned_at"),
      ]
    );

    const items: PackagingItem[] = itemsResult.documents.map((item) => ({
      $id: item.$id,
      $createdAt: item.$createdAt,
      $updatedAt: item.$updatedAt,
      packaging_record_id: item.packaging_record_id as string,
      product_barcode: item.product_barcode as string,
      scanned_at: item.scanned_at as string,
    }));

    recordsWithItems.push({
      ...record,
      items,
    });

    await delay(API_DELAY);
  }

  return recordsWithItems;
}

/**
 * Store packaging data in cache
 */
async function cachePackagingData(
  databases: Databases,
  databaseId: string,
  dateString: string,
  data: PackagingRecordWithItems[]
): Promise<void> {
  // Check if cache already exists for this date
  const existing = await databases.listDocuments(
    databaseId,
    COLLECTIONS.PACKAGING_CACHE,
    [Query.equal("cache_date", dateString), Query.limit(1)]
  );

  const cacheData: PackagingCache = {
    cache_date: dateString,
    data: JSON.stringify(data),
    cached_at: new Date().toISOString(),
  };

  if (existing.documents.length > 0) {
    // Update existing cache
    await databases.updateDocument(
      databaseId,
      COLLECTIONS.PACKAGING_CACHE,
      existing.documents[0].$id,
      cacheData
    );
    logger.info(`Updated existing cache for ${dateString}`);
  } else {
    // Create new cache entry
    await databases.createDocument(
      databaseId,
      COLLECTIONS.PACKAGING_CACHE,
      ID.unique(),
      cacheData
    );
    logger.info(`Created new cache for ${dateString}`);
  }
}

/**
 * Scheduled task to archive yesterday's packaging data to cache
 * Runs daily at midnight (00:00 UTC)
 */
export const packagingArchivalTask = schedules.task({
  id: "packaging-archival",
  cron: "0 0 * * *", // Every day at midnight UTC
  run: async () => {
    const { databases } = createAppwriteClient();
    const databaseId = process.env.APPWRITE_DATABASE_ID!;

    const yesterdayDate = getYesterdayDate();
    logger.info(`Starting packaging archival for ${yesterdayDate}`);

    try {
      // Fetch all packaging records for yesterday
      const recordsWithItems = await fetchPackagingRecordsByDate(
        databases,
        databaseId,
        yesterdayDate
      );

      if (recordsWithItems.length === 0) {
        logger.info(`No packaging records found for ${yesterdayDate}, skipping cache`);
        return {
          success: true,
          date: yesterdayDate,
          records: 0,
          items: 0,
          cached: false,
        };
      }

      // Calculate total items
      const totalItems = recordsWithItems.reduce(
        (sum, record) => sum + record.items.length,
        0
      );

      // Store in cache
      await cachePackagingData(databases, databaseId, yesterdayDate, recordsWithItems);

      logger.info(
        `Archived ${recordsWithItems.length} records with ${totalItems} items for ${yesterdayDate}`
      );

      return {
        success: true,
        date: yesterdayDate,
        records: recordsWithItems.length,
        items: totalItems,
        cached: true,
      };
    } catch (error) {
      logger.error("Packaging archival failed", { error, date: yesterdayDate });
      throw error;
    }
  },
});

interface ManualArchivalPayload {
  date?: string; // Single date in YYYY-MM-DD format
  startDate?: string; // Start date for range (YYYY-MM-DD)
  endDate?: string; // End date for range (YYYY-MM-DD)
}

/**
 * Get all dates between start and end (inclusive)
 */
function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Manual trigger task for cache warming
 * Use this to populate cache for historical dates on-demand
 *
 * Usage examples:
 *   - Single date: { date: "2024-12-25" }
 *   - Date range: { startDate: "2024-12-01", endDate: "2024-12-31" }
 *   - Yesterday (default): {}
 */
export const packagingCacheWarmup = task({
  id: "packaging-cache-warmup",
  retry: { maxAttempts: 3 },
  run: async (payload: ManualArchivalPayload) => {
    const { databases } = createAppwriteClient();
    const databaseId = process.env.APPWRITE_DATABASE_ID!;

    // Determine which dates to process
    let datesToProcess: string[];

    if (payload.date) {
      // Single date specified
      datesToProcess = [payload.date];
    } else if (payload.startDate && payload.endDate) {
      // Date range specified
      datesToProcess = getDateRange(payload.startDate, payload.endDate);
    } else {
      // Default to yesterday
      datesToProcess = [getYesterdayDate()];
    }

    logger.info(`Starting cache warmup for ${datesToProcess.length} date(s)`, {
      dates: datesToProcess,
    });

    const results: Array<{
      date: string;
      success: boolean;
      records: number;
      items: number;
      cached: boolean;
      error?: string;
    }> = [];

    for (const dateString of datesToProcess) {
      try {
        logger.info(`Processing date: ${dateString}`);

        const recordsWithItems = await fetchPackagingRecordsByDate(
          databases,
          databaseId,
          dateString
        );

        if (recordsWithItems.length === 0) {
          logger.info(`No records found for ${dateString}, skipping`);
          results.push({
            date: dateString,
            success: true,
            records: 0,
            items: 0,
            cached: false,
          });
          continue;
        }

        const totalItems = recordsWithItems.reduce(
          (sum, record) => sum + record.items.length,
          0
        );

        await cachePackagingData(databases, databaseId, dateString, recordsWithItems);

        logger.info(`Cached ${recordsWithItems.length} records for ${dateString}`);
        results.push({
          date: dateString,
          success: true,
          records: recordsWithItems.length,
          items: totalItems,
          cached: true,
        });
      } catch (error) {
        logger.error(`Failed to cache ${dateString}`, { error });
        results.push({
          date: dateString,
          success: false,
          records: 0,
          items: 0,
          cached: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const summary = {
      totalDates: datesToProcess.length,
      successfulDates: results.filter((r) => r.success).length,
      cachedDates: results.filter((r) => r.cached).length,
      totalRecords: results.reduce((sum, r) => sum + r.records, 0),
      totalItems: results.reduce((sum, r) => sum + r.items, 0),
      results,
    };

    logger.info("Cache warmup completed", summary);
    return summary;
  },
});
