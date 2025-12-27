# Features Documentation

## Overview

This document provides detailed documentation for each major feature in Wrapster, including workflows, business logic, and implementation details.

## Product Management

### Overview

The product management system allows users to create, view, edit, and delete products. Products can be either single items or bundles (composed of multiple single items).

### Product Types

#### Single Products
- Individual items with a unique barcode
- Can have SKU code, cost, and stock quantity
- Can be components of bundle products

#### Bundle Products
- Composed of one or more single products
- Each component has a quantity multiplier
- When packaged, component stock is deducted (not the bundle itself)

### Workflows

#### Creating a Single Product
1. Navigate to Products page
2. Click "Add Product"
3. Enter barcode (required, must be unique)
4. Enter SKU code (optional)
5. Enter product name (required)
6. Select type: "Single"
7. Enter cost (optional)
8. Enter initial stock quantity (optional)
9. Click "Save"

#### Creating a Bundle Product
1. Navigate to Products page
2. Click "Add Product"
3. Enter barcode for the bundle
4. Enter product name
5. Select type: "Bundle"
6. In the "Bundle Items" section:
   - Search and select component products
   - Set quantity for each component
7. Click "Save"

#### Importing Products
1. Navigate to Products page
2. Click "Import" button
3. Select an Excel file (.xlsx or .xls)
4. File format expected:
   - Column A: Barcode
   - Column B: SKU Code
   - Column C: Name
   - Column D: Type (single/bundle)
   - Column E: Cost
   - Column F: Stock Quantity
5. Job is queued and processed in background
6. Monitor status in Jobs page or sidebar indicator

#### Exporting Products
1. Navigate to Products page
2. Click "Export" dropdown
3. Select filter (All, Single, or Bundle)
4. Job is queued and processed
5. Download link appears in "Recent Exports" section

### Stock Management

- Stock quantity is tracked per product
- Single products: stock deducted when packaged
- Bundle products: component stock is deducted, not bundle stock
- Stock validation prevents packaging when insufficient stock
- Deleting a packaging record restores the deducted stock

## Waybill & Packaging Tracking

### Overview

The packaging system tracks waybills (shipment identifiers) and the products packed in each shipment. Each waybill is unique per date.

### Workflows

#### Creating a Packaging Record
1. Navigate to Packaging page
2. Select the packaging date (defaults to today)
3. Scan or enter waybill number
4. System checks for duplicate (same waybill on same date)
5. If unique, record is created

#### Scanning Products
1. After creating a packaging record
2. Scan product barcode
3. System looks up product:
   - If found: adds to scanned items list
   - If not found: shows error message
4. For bundle products: shows component breakdown
5. Continue scanning until complete
6. Click "Save" to persist all items

#### Stock Validation
1. Before saving, system validates stock:
   - For single products: checks available quantity
   - For bundles: checks all component quantities
2. If insufficient stock:
   - Shows warning with details
   - Lists products with insufficient stock
   - User can proceed (if allowed) or cancel
3. If sufficient stock:
   - Items are saved
   - Stock is deducted

#### Viewing Packaging History
1. Select a date on the Packaging page
2. "Records for this date" section shows all waybills
3. Expand a record to see scanned items
4. Items show barcode, product name, scan time

#### Deleting a Record
1. Find the record in the history list
2. Click delete button
3. Confirm deletion
4. Record and items are deleted
5. Stock is restored for all items

### Bundle Handling

When a bundle product is scanned:
1. The bundle barcode is recorded in packaging_items
2. All component products have their stock deducted
3. UI shows the bundle and its components for clarity

## Report Generation

### Overview

The reporting system generates summaries of packaging activity for date ranges, with export options for Excel and PDF formats.

### Report Contents

Reports include:
- **Summary**: Total records, items, and unique products
- **Daily Breakdown**: Records and items per day
- **Product Summary**: All products packed with quantities

### Workflows

#### Generating a Report
1. Navigate to Reports page
2. Select start date
3. Select end date
4. Choose export format:
   - "Export Excel" for spreadsheet format
   - "Export PDF" for printable document
5. Job is queued and processed in background
6. Download link appears when complete

#### Excel Report Format
- Sheet 1: Summary
  - Total packaging records
  - Total items scanned
  - Unique products count
  - Date range
- Sheet 2: Daily Summary
  - Date, record count, item count per day
- Sheet 3: Product Details
  - Barcode, name, total quantity packed

#### PDF Report Format
- Header with title and date range
- Summary section with totals
- Daily breakdown table
- Product summary table
- Supports Chinese characters (embedded font)

#### Emailing Reports
1. Generate and download a report first
2. Click "Email Report" button
3. Enter recipient email addresses (comma or Enter separated)
4. Click "Send"
5. Report is sent as attachment via Resend

### Report Cleanup

- Completed report exports are available for 5 minutes
- After 5 minutes, files are cleaned up automatically
- Users should download immediately after generation

## Background Job System

### Overview

Long-running operations (imports, exports, emails) are processed asynchronously using Trigger.dev. This prevents UI blocking and allows users to continue working.

### Job Types

| Action | Description |
|--------|-------------|
| `import-excel` | Import products from Excel file |
| `export-excel` | Export product catalog to Excel |
| `export-reporting-excel` | Export packaging report to Excel |
| `export-reporting-pdf` | Export packaging report to PDF |
| `send-report-email` | Send report file via email |

### Job States

| Status | Description |
|--------|-------------|
| `pending` | Job queued, waiting to start |
| `processing` | Job currently running |
| `completed` | Job finished successfully |
| `failed` | Job failed with error |

### Monitoring Jobs

1. **Sidebar Indicator**: Shows count of active jobs with spinner
2. **Jobs Page**: Detailed view of all jobs with filtering
3. **Auto-refresh**: UI polls for status updates every 2-3 seconds

### Job Statistics

For import jobs:
- **Imported**: New products created
- **Updated**: Existing products modified
- **Skipped**: Rows with no changes
- **Failed**: Rows with errors

For export jobs:
- **Total**: Number of records exported

### Error Handling

- Jobs retry up to 3 times on failure
- Exponential backoff between retries
- Error messages captured and displayed
- Stale jobs (pending > 2 minutes) marked as failed

## Internationalization

### Supported Languages

| Code | Language |
|------|----------|
| `en` | English (default) |
| `zh` | Chinese (Simplified) |

### Switching Languages

1. Click language button in sidebar
2. Select preferred language
3. All UI text updates immediately
4. Preference saved to localStorage
5. Persists across sessions

### Translation Coverage

All user-facing text is translated:
- Navigation labels
- Page titles and headings
- Form labels and placeholders
- Button text
- Error messages
- Success notifications
- Table headers
- Dialog content

### Adding Translations

1. Edit locale files in `src/lib/i18n/locales/`
2. Add new keys to both `en.json` and `zh.json`
3. Use in components: `t('key.path')`

```typescript
// Usage in component
const { t } = useTranslation()
return <h1>{t('products.title')}</h1>
```

## Authentication

### Login Flow

1. User enters email and password
2. System validates credentials with Appwrite
3. Session created and stored in browser
4. User redirected to original destination (or dashboard)

### Session Handling

- Sessions persist across browser tabs
- Automatic session validation on app load
- Protected routes redirect to login if no session
- Active session conflict handling with revoke option

### Logout

1. Click logout button in sidebar
2. Session deleted from Appwrite
3. User redirected to login page
4. All cached data cleared

### Account Creation

1. Navigate to login page
2. Click "Create Account" (if enabled)
3. Enter email, password, and name
4. Account created and automatically logged in

## UI Features

### Virtual Scrolling

Large product lists use virtual scrolling:
- Only visible rows are rendered
- Smooth scrolling performance
- Works with 10,000+ products

### Data Tables

- Sortable columns (click header)
- Search filtering (instant, debounced)
- Type filtering (dropdown)
- Pagination controls
- Row actions (edit, delete)

### Toast Notifications

- Success: Green, auto-dismiss
- Error: Red, requires dismissal
- Info: Blue, auto-dismiss
- Used for operation feedback

### Loading States

- Full-page spinner for auth checks
- Button spinners for form submissions
- Skeleton loading for data fetching
- Progress indicators for jobs

### Responsive Design

- Desktop-first design
- Collapsible sidebar on smaller screens
- Mobile-friendly forms and tables
- Touch-optimized date pickers
