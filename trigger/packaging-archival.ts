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

interface Product {
  $id: string;
  barcode: string;
  name: string;
  type: "single" | "bundle";
}

interface BundleComponentInfo {
  barcode: string;
  productName: string;
  quantity: number;
}

interface PackagingItemWithProduct extends PackagingItem {
  product_name: string;
  is_bundle?: boolean;
  bundle_components?: BundleComponentInfo[];
}

interface PackagingRecordWithProducts extends PackagingRecord {
  items: PackagingItemWithProduct[];
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
  PRODUCTS: "products",
  PRODUCT_COMPONENTS: "product_components",
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
 * Fetch all packaging records for a specific date with product info
 */
async function fetchPackagingRecordsByDate(
  databases: Databases,
  databaseId: string,
  dateString: string
): Promise<PackagingRecordWithProducts[]> {
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

  // Fetch all items for all records
  const allItems: PackagingItem[] = [];
  for (const record of allRecords) {
    const itemsResult = await databases.listDocuments(
      databaseId,
      COLLECTIONS.PACKAGING_ITEMS,
      [
        Query.equal("packaging_record_id", record.$id),
        Query.orderDesc("scanned_at"),
      ]
    );

    for (const item of itemsResult.documents) {
      allItems.push({
        $id: item.$id,
        $createdAt: item.$createdAt,
        $updatedAt: item.$updatedAt,
        packaging_record_id: item.packaging_record_id as string,
        product_barcode: item.product_barcode as string,
        scanned_at: item.scanned_at as string,
      });
    }
    await delay(API_DELAY);
  }

  // Collect unique barcodes and batch fetch products
  const uniqueBarcodes = [...new Set(allItems.map((item) => item.product_barcode))];
  const productMap = new Map<string, Product>();

  // Fetch products in batches
  for (let i = 0; i < uniqueBarcodes.length; i += 50) {
    const batch = uniqueBarcodes.slice(i, i + 50);
    const result = await databases.listDocuments(
      databaseId,
      COLLECTIONS.PRODUCTS,
      [Query.equal("barcode", batch), Query.limit(50)]
    );
    for (const doc of result.documents) {
      productMap.set(doc.barcode as string, {
        $id: doc.$id,
        barcode: doc.barcode as string,
        name: doc.name as string,
        type: doc.type as "single" | "bundle",
      });
    }
    await delay(API_DELAY);
  }

  // Fetch bundle components for bundle products
  const bundleProducts = Array.from(productMap.values()).filter((p) => p.type === "bundle");
  const bundleComponentsMap = new Map<string, BundleComponentInfo[]>();

  for (const bundle of bundleProducts) {
    try {
      const componentsResult = await databases.listDocuments(
        databaseId,
        COLLECTIONS.PRODUCT_COMPONENTS,
        [Query.equal("parent_product_id", bundle.$id)]
      );

      const components: BundleComponentInfo[] = [];
      for (const comp of componentsResult.documents) {
        const childProductId = comp.child_product_id as string;
        const quantity = comp.quantity as number;

        const childProduct = await databases.getDocument(
          databaseId,
          COLLECTIONS.PRODUCTS,
          childProductId
        );

        components.push({
          barcode: childProduct.barcode as string,
          productName: childProduct.name as string,
          quantity,
        });
        await delay(API_DELAY);
      }

      if (components.length > 0) {
        bundleComponentsMap.set(bundle.barcode, components);
      }
    } catch {
      // Skip if components can't be fetched
    }
  }

  // Build records with enriched items
  const recordsWithProducts: PackagingRecordWithProducts[] = allRecords.map((record) => {
    const recordItems = allItems.filter((item) => item.packaging_record_id === record.$id);
    const enrichedItems: PackagingItemWithProduct[] = recordItems.map((item) => {
      const product = productMap.get(item.product_barcode);
      return {
        ...item,
        product_name: product?.name ?? "Unknown Product",
        is_bundle: product?.type === "bundle",
        bundle_components: bundleComponentsMap.get(item.product_barcode),
      };
    });

    return {
      ...record,
      items: enrichedItems,
    };
  });

  return recordsWithProducts;
}

/**
 * Store packaging data in cache
 */
async function cachePackagingData(
  databases: Databases,
  databaseId: string,
  dateString: string,
  data: PackagingRecordWithProducts[]
): Promise<void> {
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
    await databases.updateDocument(
      databaseId,
      COLLECTIONS.PACKAGING_CACHE,
      existing.documents[0].$id,
      cacheData
    );
    logger.info(`Updated existing cache for ${dateString}`);
  } else {
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
 * Includes product names and bundle components for fast retrieval
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
      const recordsWithProducts = await fetchPackagingRecordsByDate(
        databases,
        databaseId,
        yesterdayDate
      );

      if (recordsWithProducts.length === 0) {
        logger.info(`No packaging records found for ${yesterdayDate}, skipping cache`);
        return {
          success: true,
          date: yesterdayDate,
          records: 0,
          items: 0,
          cached: false,
        };
      }

      const totalItems = recordsWithProducts.reduce(
        (sum, record) => sum + record.items.length,
        0
      );

      await cachePackagingData(databases, databaseId, yesterdayDate, recordsWithProducts);

      logger.info(
        `Archived ${recordsWithProducts.length} records with ${totalItems} items for ${yesterdayDate}`
      );

      return {
        success: true,
        date: yesterdayDate,
        records: recordsWithProducts.length,
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
  date?: string;
  startDate?: string;
  endDate?: string;
}

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
 * Manual trigger task for cache warming with product info
 */
export const packagingCacheWarmup = task({
  id: "packaging-cache-warmup",
  retry: { maxAttempts: 3 },
  run: async (payload: ManualArchivalPayload) => {
    const { databases } = createAppwriteClient();
    const databaseId = process.env.APPWRITE_DATABASE_ID!;

    let datesToProcess: string[];

    if (payload.date) {
      datesToProcess = [payload.date];
    } else if (payload.startDate && payload.endDate) {
      datesToProcess = getDateRange(payload.startDate, payload.endDate);
    } else {
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

        const recordsWithProducts = await fetchPackagingRecordsByDate(
          databases,
          databaseId,
          dateString
        );

        if (recordsWithProducts.length === 0) {
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

        const totalItems = recordsWithProducts.reduce(
          (sum, record) => sum + record.items.length,
          0
        );

        await cachePackagingData(databases, databaseId, dateString, recordsWithProducts);

        logger.info(`Cached ${recordsWithProducts.length} records for ${dateString}`);
        results.push({
          date: dateString,
          success: true,
          records: recordsWithProducts.length,
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
