# Deployment Guide

## Overview

Wrapster can be deployed to any static hosting provider (Vercel, Netlify, etc.) for the frontend, with Appwrite Cloud or self-hosted Appwrite for the backend.

## Prerequisites

- Node.js 18 or later
- npm or pnpm package manager
- Appwrite instance (cloud or self-hosted)
- Trigger.dev account for background jobs
- Resend account for email delivery (optional)

## Environment Variables

### Frontend (.env)

```env
# Appwrite Configuration
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your_project_id
VITE_APPWRITE_DATABASE_ID=your_database_id
VITE_APPWRITE_BUCKET_ID=your_bucket_id
VITE_APPWRITE_QUEUE_FUNCTION_ID=queue-product-job

# Optional: Allowed hosts for development
VITE_ALLOWED_HOSTS=localhost,your-domain.com
```

### Backend (Trigger.dev / Functions)

```env
# Appwrite Server Configuration
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your_project_id
APPWRITE_DATABASE_ID=your_database_id
APPWRITE_API_KEY=your_server_api_key
APPWRITE_BUCKET_ID=your_bucket_id

# Email Service
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=reports@your-domain.com

# Trigger.dev
TRIGGER_SECRET_KEY=tr_dev_xxxxxxxxxxxxx
```

## Appwrite Setup

### 1. Create Appwrite Project

1. Log in to Appwrite console
2. Create a new project
3. Note the Project ID

### 2. Create Database

1. Go to Databases section
2. Create a new database
3. Note the Database ID

### 3. Run Migrations

```bash
# Set up environment variables first
cp .env.example .env
# Edit .env with your Appwrite credentials

# Run migration script
npm run migrate
```

This creates all required collections:
- products
- product_components
- packaging_records
- packaging_items
- import_jobs

### 4. Create Storage Bucket

1. Go to Storage section
2. Create a bucket named "exports"
3. Set permissions:
   - Read: Users
   - Create: Users
   - Update: Users
   - Delete: Users
4. Note the Bucket ID

### 5. Generate API Key

1. Go to Project Settings > API Keys
2. Create a new key with scopes:
   - `databases.read`
   - `databases.write`
   - `files.read`
   - `files.write`
3. Save the key securely

### 6. Configure Authentication

1. Go to Auth > Settings
2. Enable Email/Password authentication
3. Configure password requirements
4. Set up email templates (optional)

## Trigger.dev Setup

### 1. Create Project

1. Sign up at trigger.dev
2. Create a new project
3. Note the Project ID and Secret Key

### 2. Configure Trigger

Create/update `trigger.config.ts`:

```typescript
import { defineConfig } from "@trigger.dev/sdk/v4"

export default defineConfig({
  project: "your-project-id",
  runtime: "node",
  maxDuration: 300,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
    },
  },
  additionalFiles: ["./trigger/fonts/**/*"],
})
```

### 3. Deploy Tasks

```bash
# Login to Trigger.dev
npx trigger.dev login

# Deploy tasks
npx trigger.dev deploy
```

## Resend Setup (Optional)

### 1. Create Account

1. Sign up at resend.com
2. Verify your domain
3. Generate API key

### 2. Configure Sender

1. Add and verify sending domain
2. Or use default @resend.dev domain for testing
3. Update `RESEND_FROM_EMAIL` in environment

## Vercel Deployment

### 1. Connect Repository

1. Log in to Vercel
2. Import your Git repository
3. Select the project

### 2. Configure Environment

Add environment variables in Vercel dashboard:
- All `VITE_*` variables from .env

### 3. Configure Build

Build settings:
- **Framework**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### 4. Deploy

1. Push to main branch
2. Vercel automatically builds and deploys
3. Access via provided domain

## Manual Deployment

### Build

```bash
# Install dependencies
npm install

# Build for production
npm run build
```

### Output

The `dist/` directory contains:
- `index.html` - Entry point
- `assets/` - JS, CSS, and other assets

### Serving

Serve the `dist/` directory with any static file server:

```bash
# Using npm serve
npx serve dist

# Using Python
python -m http.server -d dist

# Using nginx
# Configure to serve dist/ directory
```

### SPA Configuration

Ensure your server redirects all routes to `index.html` for client-side routing:

**nginx example:**
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

**Vercel (vercel.json):**
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

## Database Seeding (Optional)

For development or demo purposes:

```bash
# Seed sample products
npm run seed

# Clear all products
npm run clear-products
```

## Health Checks

### Frontend
- Access the app URL
- Should redirect to login if not authenticated
- Login page should load without errors

### Backend (Appwrite)
- Appwrite console should show healthy project
- Database collections should exist
- Storage bucket should be accessible

### Jobs (Trigger.dev)
- Trigger.dev dashboard should show deployed tasks
- Test by queuing an export job

### Email (Resend)
- Send a test email from Resend dashboard
- Check email delivery logs

## Troubleshooting

### Common Issues

**"Failed to fetch" errors:**
- Check CORS settings in Appwrite
- Verify environment variables are correct
- Ensure Appwrite endpoint is accessible

**Authentication not working:**
- Verify Email/Password auth is enabled in Appwrite
- Check browser console for session errors
- Clear browser storage and retry

**Jobs not processing:**
- Check Trigger.dev dashboard for errors
- Verify TRIGGER_SECRET_KEY is correct
- Check task deployment status

**Emails not sending:**
- Verify domain is verified in Resend
- Check RESEND_API_KEY is valid
- Review Resend logs for delivery status

### Logs

**Frontend:** Browser developer console

**Appwrite:** Project > Settings > Logs

**Trigger.dev:** Dashboard > Runs

**Resend:** Dashboard > Emails

## Security Checklist

- [ ] Use HTTPS for all endpoints
- [ ] Keep API keys secure (never commit to repo)
- [ ] Set appropriate Appwrite permissions
- [ ] Enable rate limiting in Appwrite
- [ ] Configure CORS origins
- [ ] Use strong password requirements
- [ ] Regular security updates

## Scaling Considerations

### Frontend
- Enable CDN for static assets
- Configure caching headers
- Use compression (gzip/brotli)

### Appwrite
- Use Appwrite Cloud for automatic scaling
- Or scale self-hosted instances as needed

### Trigger.dev
- Adjust concurrency limits based on load
- Monitor job queue depth
- Consider dedicated workers for high volume
