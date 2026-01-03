import { task, logger } from "@trigger.dev/sdk/v3";
import { Client, Databases, Storage } from "node-appwrite";
import { Resend } from "resend";
import { createAuditLog } from "./lib/audit-log";

interface SendReportEmailPayload {
  jobId: string;
  userId: string;
  fileId: string;
  recipients: string[];
  dateRange: string;
}

const COLLECTIONS = {
  IMPORT_JOBS: "import_jobs",
} as const;

function createAppwriteClient() {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT!)
    .setProject(process.env.APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);

  return {
    databases: new Databases(client),
    storage: new Storage(client),
  };
}

async function updateJobStatus(
  databases: Databases,
  jobId: string,
  status: string,
  stats?: object,
  error?: string
) {
  const databaseId = process.env.APPWRITE_DATABASE_ID!;
  const updateData: Record<string, unknown> = { status };

  if (stats) {
    updateData.stats = JSON.stringify(stats);
  }
  if (error) {
    updateData.error = error;
  }
  if (status === "completed" || status === "failed") {
    updateData.completed_at = new Date().toISOString();
  }

  await databases.updateDocument(databaseId, COLLECTIONS.IMPORT_JOBS, jobId, updateData);
}

async function markJobFailed(jobId: string, errorMessage: string) {
  try {
    const { databases } = createAppwriteClient();
    await updateJobStatus(databases, jobId, "failed", undefined, errorMessage);
  } catch (e) {
    logger.error("Failed to update job status", { jobId, error: e });
  }
}

export const sendReportEmailTask = task({
  id: "send-report-email",
  retry: { maxAttempts: 3 },
  queue: {
    concurrencyLimit: 5,
  },
  onFailure: async ({ payload, error }) => {
    logger.error("Send report email task failed permanently", { jobId: payload.jobId, error });
    await markJobFailed(payload.jobId, error instanceof Error ? error.message : "Task failed after all retries");
  },
  run: async (payload: SendReportEmailPayload) => {
    const { jobId, userId, fileId, recipients, dateRange } = payload;
    const { databases, storage } = createAppwriteClient();
    const bucketId = process.env.APPWRITE_BUCKET_ID!;

    logger.info("Starting send report email", { jobId, recipients, dateRange });

    // Check for Resend API key
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      const errorMsg = "RESEND_API_KEY environment variable is not set";
      logger.error(errorMsg);
      await updateJobStatus(databases, jobId, "failed", undefined, errorMsg);
      throw new Error(errorMsg);
    }

    const resend = new Resend(resendApiKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "reports@wrapster.app";

    try {
      await updateJobStatus(databases, jobId, "processing");

      // Get file details to determine file type
      const file = await storage.getFile(bucketId, fileId);
      const fileName = file.name;
      const isPdf = fileName.endsWith('.pdf');

      // Get download URL for the file
      const endpoint = process.env.APPWRITE_ENDPOINT!;
      const projectId = process.env.APPWRITE_PROJECT_ID!;
      const downloadUrl = `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${projectId}`;

      // Create email content
      const subject = `Packaging Report - ${dateRange}`;
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Packaging Report</h2>
          <p>Hello,</p>
          <p>Please find the packaging report for <strong>${dateRange}</strong>.</p>
          <p>
            <a href="${downloadUrl}"
               style="display: inline-block; padding: 12px 24px; background-color: #eaa108; color: #422f06; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Download ${isPdf ? 'PDF' : 'Excel'} Report
            </a>
          </p>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            This is an automated email from Wrapster Packaging System.
          </p>
        </div>
      `;

      // Send email using Resend
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: recipients,
        subject,
        html: htmlContent,
      });

      if (error) {
        logger.error("Resend API error", { error });
        await updateJobStatus(databases, jobId, "failed", undefined, error.message);
        throw new Error(error.message);
      }

      logger.info("Email sent successfully via Resend", {
        messageId: data?.id,
        recipients,
      });

      // Update job status to completed
      await updateJobStatus(databases, jobId, "completed", {
        recipients: recipients.length,
        emailsSent: recipients.length,
        messageId: data?.id,
      });

      // Log email sent
      await createAuditLog(databases, {
        userId,
        actionType: 'report_email_sent',
        resourceType: 'job',
        resourceId: jobId,
        actionDetails: {
          recipientCount: recipients.length,
          fileId,
          dateRange,
          messageId: data?.id,
        },
        status: 'success',
      });

      logger.info("Send report email completed", { jobId, recipients: recipients.length });

      return {
        success: true,
        recipients: recipients.length,
        messageId: data?.id,
      };
    } catch (error) {
      logger.error("Send report email failed", { error });

      // Log email failure
      await createAuditLog(databases, {
        userId,
        actionType: 'report_email_sent',
        resourceType: 'job',
        resourceId: jobId,
        actionDetails: {
          recipientCount: recipients.length,
          fileId,
          dateRange,
        },
        status: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      await updateJobStatus(
        databases,
        jobId,
        "failed",
        undefined,
        error instanceof Error ? error.message : "Unknown error"
      );
      throw error;
    }
  },
});
