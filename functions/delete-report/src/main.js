const { Client, Databases, Storage, ID } = require("node-appwrite");

const COLLECTIONS = {
  IMPORT_JOBS: "import_jobs",
  AUDIT_LOGS: "audit_logs",
};

/**
 * Appwrite Function: delete-report
 *
 * Deletes report job records and their associated files from storage.
 * Uses Server SDK (API Key) to bypass permission restrictions.
 *
 * Expected body:
 * {
 *   job_ids: string[],           // Array of job IDs to delete
 *   file_ids: string[],          // Array of file IDs to delete from storage
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
      job_ids = [],
      file_ids = [],
      user_id,
      user_email,
      session_id,
    } = body;

    // Validate required fields
    if (!user_id) {
      return res.json(
        { success: false, error: "Missing required field: user_id" },
        400
      );
    }

    if (job_ids.length === 0 && file_ids.length === 0) {
      return res.json(
        { success: false, error: "No job_ids or file_ids provided" },
        400
      );
    }

    log(`Deleting ${job_ids.length} jobs and ${file_ids.length} files`);

    // Initialize Appwrite client with Server SDK (API Key)
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);
    const storage = new Storage(client);
    const databaseId = process.env.APPWRITE_DATABASE_ID;
    const bucketId = process.env.APPWRITE_BUCKET_ID;

    const results = {
      jobs_deleted: 0,
      jobs_failed: [],
      files_deleted: 0,
      files_failed: [],
    };

    // Delete files from storage first
    for (const fileId of file_ids) {
      if (!fileId) continue;

      try {
        await storage.deleteFile(bucketId, fileId);
        results.files_deleted++;
        log(`Deleted file: ${fileId}`);
      } catch (err) {
        // File may already be deleted or not exist
        log(`Failed to delete file ${fileId}: ${err.message}`);
        results.files_failed.push({ fileId, error: err.message });
      }
    }

    // Delete job records
    for (const jobId of job_ids) {
      if (!jobId) continue;

      try {
        // Get job details for audit before deletion
        let jobDetails = {};
        try {
          const job = await databases.getDocument(
            databaseId,
            COLLECTIONS.IMPORT_JOBS,
            jobId
          );
          jobDetails = {
            action: job.action,
            status: job.status,
            filters: job.filters,
          };
        } catch {
          // Job may not exist, continue with deletion
        }

        await databases.deleteDocument(
          databaseId,
          COLLECTIONS.IMPORT_JOBS,
          jobId
        );
        results.jobs_deleted++;
        log(`Deleted job: ${jobId}`);
      } catch (err) {
        log(`Failed to delete job ${jobId}: ${err.message}`);
        results.jobs_failed.push({ jobId, error: err.message });
      }
    }

    // Create audit log entry
    try {
      await databases.createDocument(
        databaseId,
        COLLECTIONS.AUDIT_LOGS,
        ID.unique(),
        {
          user_id,
          user_email: user_email || null,
          action_type: "report_delete",
          resource_type: "job",
          resource_id: job_ids.join(","),
          action_details: JSON.stringify({
            jobs_deleted: results.jobs_deleted,
            files_deleted: results.files_deleted,
            file_ids,
          }),
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

    return res.json({
      success: true,
      ...results,
    });
  } catch (err) {
    error(`Delete report error: ${err.message}`);
    return res.json(
      {
        success: false,
        error: err.message,
      },
      500
    );
  }
};
