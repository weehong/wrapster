/**
 * Quick script to check packaging data in the database
 */

import dotenv from 'dotenv'

dotenv.config()
dotenv.config({ path: '.env.local' })

import { Client, Databases, Query } from 'node-appwrite'

const config = {
  endpoint: process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
  projectId: process.env.VITE_APPWRITE_PROJECT_ID || '',
  apiKey: process.env.APPWRITE_API_KEY || '',
  databaseId: process.env.VITE_APPWRITE_DATABASE_ID || '',
}

const client = new Client()
  .setEndpoint(config.endpoint)
  .setProject(config.projectId)
  .setKey(config.apiKey)

const databases = new Databases(client)

async function main() {
  console.log('Checking packaging data...\n')

  // Get total count
  const result = await databases.listDocuments(
    config.databaseId,
    'packaging_records',
    [Query.limit(100)]
  )

  console.log(`Total packaging records: ${result.total}`)

  if (result.documents.length > 0) {
    // Get unique dates
    const dates = new Set<string>()
    for (const doc of result.documents) {
      dates.add(doc.packaging_date as string)
    }

    console.log(`\nUnique dates found:`)
    const sortedDates = Array.from(dates).sort()
    for (const date of sortedDates) {
      const count = result.documents.filter(d => d.packaging_date === date).length
      console.log(`  ${date}: ${count} records`)
    }

    console.log(`\nToday is: ${new Date().toISOString().split('T')[0]}`)
  }
}

main().catch(console.error)
