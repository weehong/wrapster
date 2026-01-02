import { Account, Client, Databases, Functions, Messaging, Storage } from 'appwrite'

const client = new Client()

client
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID)

export const account = new Account(client)
export const databases = new Databases(client)
export const storage = new Storage(client)
export const messaging = new Messaging(client)
export const functions = new Functions(client)

export { ID, Query } from 'appwrite'
export default client
