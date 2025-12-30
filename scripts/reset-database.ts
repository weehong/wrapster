/**
 * Reset Database Script
 *
 * Deletes all data from all Appwrite collections and clears storage files.
 */

import 'dotenv/config'

import { Client, Databases, Query, Storage } from 'node-appwrite'

const config = {
  endpoint: process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
  projectId: process.env.VITE_APPWRITE_PROJECT_ID || '',
  apiKey: process.env.APPWRITE_API_KEY || '',
  databaseId: process.env.VITE_APPWRITE_DATABASE_ID || '',
  bucketId: process.env.VITE_APPWRITE_BUCKET_ID || '',
}

const client = new Client()
  .setEndpoint(config.endpoint)
  .setProject(config.projectId)
  .setKey(config.apiKey)

const databases = new Databases(client)
const storage = new Storage(client)

// All collections in order of deletion (child tables first to respect dependencies)
const COLLECTIONS = [
  'product_components',  // Depends on products
  'packaging_items',     // Depends on packaging_records
  'packaging_records',
  'products',
  'import_jobs',
]

async function clearCollection(collectionId: string) {
  console.log(`\nClearing ${collectionId}...`)
  let deleted = 0

  while (true) {
    const result = await databases.listDocuments(
      config.databaseId,
      collectionId,
      [Query.limit(100)]
    )

    if (result.documents.length === 0) break

    for (const doc of result.documents) {
      await databases.deleteDocument(config.databaseId, collectionId, doc.$id)
      deleted++
      process.stdout.write(`\r  Deleted ${deleted} records`)
    }
  }

  console.log(`\n  Completed: ${deleted} records deleted`)
  return deleted
}

async function clearStorage() {
  console.log(`\nClearing storage bucket...`)
  let deleted = 0

  while (true) {
    const result = await storage.listFiles(
      config.bucketId,
      [Query.limit(100)]
    )

    if (result.files.length === 0) break

    for (const file of result.files) {
      await storage.deleteFile(config.bucketId, file.$id)
      deleted++
      process.stdout.write(`\r  Deleted ${deleted} files`)
    }
  }

  console.log(`\n  Completed: ${deleted} files deleted`)
  return deleted
}

async function main() {
  console.log('='.repeat(50))
  console.log('RESET DATABASE - Deleting All Data')
  console.log('='.repeat(50))
  console.log(`\nEndpoint: ${config.endpoint}`)
  console.log(`Project:  ${config.projectId}`)
  console.log(`Database: ${config.databaseId}`)
  console.log(`Bucket:   ${config.bucketId}`)

  let totalRecords = 0
  let totalFiles = 0

  // Clear all collections
  for (const collectionId of COLLECTIONS) {
    try {
      const count = await clearCollection(collectionId)
      totalRecords += count
    } catch (error) {
      console.log(`\n  Error clearing ${collectionId}:`, error instanceof Error ? error.message : error)
    }
  }

  // Clear storage
  try {
    totalFiles = await clearStorage()
  } catch (error) {
    console.log(`\n  Error clearing storage:`, error instanceof Error ? error.message : error)
  }

  console.log('\n' + '='.repeat(50))
  console.log('RESET COMPLETE')
  console.log('='.repeat(50))
  console.log(`Total records deleted: ${totalRecords}`)
  console.log(`Total files deleted:   ${totalFiles}`)
}

main().catch(console.error)
