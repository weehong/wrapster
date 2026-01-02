const { Client, Databases, ID, Query } = require("node-appwrite");

const COLLECTIONS = {
  PACKAGING_RECORDS: "packaging_records",
  PACKAGING_ITEMS: "packaging_items",
  PRODUCTS: "products",
  AUDIT_LOGS: "audit_logs",
};

// Batch size for parallel operations to avoid overwhelming Appwrite
const BATCH_SIZE = 20;

/**
 * Process array in batches with parallel execution within each batch
 */
async function processBatches(items, processor, batchSize = BATCH_SIZE) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  return results;
}

/**
 * Appwrite Function: update-packaging
 *
 * Updates a packaging record (waybill) and/or replaces all items.
 * Uses Server SDK (API Key) - NO RATE LIMITS.
 *
 * Expected body:
 * {
 *   record_id: string,
 *   waybill_number?: string,           // New waybill number (optional)
 *   items?: Array<{                    // New items to replace existing (optional)
 *     product_barcode: string,
 *     product_name?: string,
 *     scanned_at?: string
 *   }>,
 *   user_id: string,
 *   user_email?: string,
 *   session_id?: string
 * }
 */
module.exports = async (context) => {
  const { req, res, log, error } = context;

  try {
    // Parse request body
    let body;
    try {
      body = JSON.parse(req.body || "{}");
    } catch {
      return res.json({ success: false, error: "Invalid JSON body" }, 400);
    }

    const {
      record_id,
      waybill_number,
      items,
      user_id,
      user_email,
      session_id,
    } = body;

    // Validate required fields
    if (!record_id || !user_id) {
      return res.json(
        {
          success: false,
          error: "Missing required fields: record_id, user_id",
        },
        400
      );
    }

    // At least one update must be provided
    if (waybill_number === undefined && items === undefined) {
      return res.json(
        {
          success: false,
          error: "At least one of waybill_number or items must be provided",
        },
        400
      );
    }

    log(`Updating packaging record: ${record_id}`);

    // Initialize Appwrite client with Server SDK (API Key)
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);
    const databaseId = process.env.APPWRITE_DATABASE_ID;

    // 1. Get original record for audit
    const originalRecord = await databases.getDocument(
      databaseId,
      COLLECTIONS.PACKAGING_RECORDS,
      record_id
    );

    let updatedRecord = originalRecord;
    let oldItems = [];
    let newItems = [];

    // 2. Update waybill number if provided
    if (waybill_number !== undefined) {
      updatedRecord = await databases.updateDocument(
        databaseId,
        COLLECTIONS.PACKAGING_RECORDS,
        record_id,
        { waybill_number }
      );
      log(`Updated waybill number to: ${waybill_number}`);
    }

    // 3. Replace items if provided
    if (items !== undefined) {
      if (!Array.isArray(items)) {
        return res.json(
          { success: false, error: "Items must be an array" },
          400
        );
      }

      // Get existing items
      const existingItemsResult = await databases.listDocuments(
        databaseId,
        COLLECTIONS.PACKAGING_ITEMS,
        [
          Query.equal("packaging_record_id", record_id),
          Query.limit(1000),
        ]
      );
      oldItems = existingItemsResult.documents;

      log(`Deleting ${oldItems.length} existing items in batches of ${BATCH_SIZE}...`);

      // Delete all existing items in batches
      await processBatches(oldItems, (item) =>
        databases.deleteDocument(
          databaseId,
          COLLECTIONS.PACKAGING_ITEMS,
          item.$id
        )
      );

      // Create new items in batches
      if (items.length > 0) {
        log(`Creating ${items.length} new items in batches of ${BATCH_SIZE}...`);
        newItems = await processBatches(items, (item) =>
          databases.createDocument(
            databaseId,
            COLLECTIONS.PACKAGING_ITEMS,
            ID.unique(),
            {
              packaging_record_id: record_id,
              product_barcode: item.product_barcode,
              scanned_at: item.scanned_at || new Date().toISOString(),
            }
          )
        );
      }
    }

    // 4. Create audit log entry
    try {
      const actionDetails = {
        packaging_date: updatedRecord.packaging_date,
      };

      if (waybill_number !== undefined) {
        actionDetails.old_waybill_number = originalRecord.waybill_number;
        actionDetails.new_waybill_number = waybill_number;
      }

      if (items !== undefined) {
        actionDetails.old_item_count = oldItems.length;
        actionDetails.new_item_count = items.length;
        actionDetails.old_items = oldItems.map((i) => i.product_barcode);
        actionDetails.new_items = items.map((i) => i.product_barcode);
      }

      await databases.createDocument(
        databaseId,
        COLLECTIONS.AUDIT_LOGS,
        ID.unique(),
        {
          user_id,
          user_email: user_email || null,
          action_type: items !== undefined ? "packaging_items_update" : "packaging_record_update",
          resource_type: items !== undefined ? "packaging_item" : "packaging_record",
          resource_id: record_id,
          action_details: JSON.stringify(actionDetails),
          ip_address: null,
          user_agent: req.headers["user-agent"] || null,
          status: "success",
          error_message: null,
          timestamp: new Date().toISOString(),
          session_id: session_id || null,
        }
      );
      log("Created audit log entry");
    } catch (auditError) {
      error(`Failed to create audit log: ${auditError.message}`);
    }

    // Return success response
    return res.json({
      success: true,
      record: {
        $id: updatedRecord.$id,
        packaging_date: updatedRecord.packaging_date,
        waybill_number: updatedRecord.waybill_number,
        $createdAt: updatedRecord.$createdAt,
        $updatedAt: updatedRecord.$updatedAt,
      },
      items: newItems.map((item) => ({
        $id: item.$id,
        packaging_record_id: item.packaging_record_id,
        product_barcode: item.product_barcode,
        scanned_at: item.scanned_at,
      })),
    });
  } catch (err) {
    error(`Unhandled error: ${err.message || err}`);

    return res.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      500
    );
  }
};
