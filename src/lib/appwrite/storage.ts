import type { ImageGravity, Models } from 'appwrite'

import { ID, storage } from './config'
import { auditLogService } from './audit-log'

const BUCKET_ID = import.meta.env.VITE_APPWRITE_BUCKET_ID

export type File = Models.File

export const storageService = {
  async uploadFile(
    file: globalThis.File,
    fileId?: string,
    permissions?: string[]
  ) {
    try {
      const result = await storage.createFile(
        BUCKET_ID,
        fileId ?? ID.unique(),
        file,
        permissions
      )

      auditLogService.log('storage_file_upload', 'storage', {
        resource_id: result.$id,
        action_details: {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        },
      }).catch(console.error)

      return result
    } catch (error) {
      auditLogService.log('storage_file_upload', 'storage', {
        action_details: {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        },
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  async getFile(fileId: string) {
    const file = await storage.getFile(BUCKET_ID, fileId)

    auditLogService.log('storage_file_view', 'storage', {
      resource_id: fileId,
      action_details: {
        fileName: file.name,
        fileSize: file.sizeOriginal,
      },
    }).catch(console.error)

    return file
  },

  async listFiles(queries?: string[], search?: string) {
    return storage.listFiles(BUCKET_ID, queries, search)
  },

  async deleteFile(fileId: string) {
    try {
      // Get file details before deletion for audit
      let fileDetails: Record<string, unknown> = {}
      try {
        const file = await storage.getFile(BUCKET_ID, fileId)
        fileDetails = {
          fileName: file.name,
          fileSize: file.sizeOriginal,
        }
      } catch {
        // File may not exist, continue with deletion
      }

      await storage.deleteFile(BUCKET_ID, fileId)

      auditLogService.log('storage_file_delete', 'storage', {
        resource_id: fileId,
        action_details: fileDetails,
      }).catch(console.error)
    } catch (error) {
      auditLogService.log('storage_file_delete', 'storage', {
        resource_id: fileId,
        status: 'failure',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(console.error)
      throw error
    }
  },

  async updateFile(fileId: string, name?: string, permissions?: string[]) {
    return storage.updateFile(BUCKET_ID, fileId, name, permissions)
  },

  getFilePreview(
    fileId: string,
    options?: {
      width?: number
      height?: number
      gravity?: ImageGravity
      quality?: number
    }
  ) {
    return storage.getFilePreview(
      BUCKET_ID,
      fileId,
      options?.width,
      options?.height,
      options?.gravity,
      options?.quality
    )
  },

  getFileDownload(fileId: string) {
    auditLogService.log('storage_file_download', 'storage', {
      resource_id: fileId,
    }).catch(console.error)

    return storage.getFileDownload(BUCKET_ID, fileId)
  },

  getFileView(fileId: string) {
    return storage.getFileView(BUCKET_ID, fileId)
  },
}
