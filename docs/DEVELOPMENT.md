# Development Guide

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm 9.x or later (or pnpm)
- Git
- An Appwrite instance (cloud or local)

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd wrapster

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# (see Deployment guide for Appwrite setup)
```

### Running the Development Server

```bash
# Start Vite dev server
npm run dev

# Server runs at http://localhost:5173
```

### Running Database Migrations

```bash
# Create all database collections
npm run migrate

# Reset database (drop and recreate)
npm run reset-db

# Seed sample data
npm run seed
```

## Project Structure

```
wrapster/
├── src/
│   ├── pages/              # Route page components
│   │   ├── Dashboard.tsx
│   │   ├── Login.tsx
│   │   ├── Products.tsx
│   │   ├── Packaging.tsx
│   │   ├── Reports.tsx
│   │   └── Jobs.tsx
│   │
│   ├── components/         # Reusable components
│   │   ├── ui/             # Base UI components (shadcn/ui)
│   │   ├── products/       # Product-specific components
│   │   ├── jobs/           # Job-specific components
│   │   ├── AppLayout.tsx
│   │   ├── AppSidebar.tsx
│   │   └── AuthGuard.tsx
│   │
│   ├── hooks/              # Custom React hooks
│   │   ├── use-products.ts
│   │   ├── use-jobs.ts
│   │   └── use-debounce.ts
│   │
│   ├── contexts/           # React context providers
│   │   ├── AuthContext.tsx
│   │   └── LoadingContext.tsx
│   │
│   ├── lib/                # Utilities and services
│   │   ├── appwrite/       # Appwrite integration
│   │   │   ├── config.ts   # Client configuration
│   │   │   ├── auth.ts     # Authentication service
│   │   │   ├── database.ts # Database wrapper
│   │   │   ├── products.ts # Product operations
│   │   │   ├── packaging.ts# Packaging operations
│   │   │   ├── jobs.ts     # Job management
│   │   │   └── storage.ts  # File storage
│   │   │
│   │   ├── i18n/           # Internationalization
│   │   │   ├── index.ts    # i18n setup
│   │   │   └── locales/    # Translation files
│   │   │
│   │   └── utils.ts        # Utility functions
│   │
│   ├── types/              # TypeScript definitions
│   │   ├── product.ts
│   │   ├── packaging.ts
│   │   └── job.ts
│   │
│   ├── App.tsx             # Root component
│   ├── main.tsx            # Entry point
│   ├── routes.ts           # Route configuration
│   └── index.css           # Global styles
│
├── trigger/                # Trigger.dev background tasks
│   ├── product-import.ts
│   ├── product-export.ts
│   ├── report-export.ts
│   └── send-report-email.ts
│
├── scripts/                # Database scripts
│   ├── migrate-database.ts
│   ├── reset-database.ts
│   └── seed-products.ts
│
├── __tests__/              # Unit tests
├── e2e/                    # End-to-end tests
└── docs/                   # Documentation
```

## Code Style

### TypeScript

- Strict mode enabled
- Use explicit types for function parameters and return values
- Prefer interfaces over type aliases for object shapes
- Use Zod for runtime validation

```typescript
// Good
interface Product {
  $id: string
  name: string
  type: 'single' | 'bundle'
}

function createProduct(data: CreateProductInput): Promise<Product> {
  // ...
}

// Avoid
function createProduct(data: any): any {
  // ...
}
```

### React Components

- Use functional components with hooks
- Prefer named exports
- Co-locate component-specific styles

```typescript
// Good
export function ProductCard({ product }: { product: Product }) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader>{product.name}</CardHeader>
    </Card>
  )
}

// Avoid
export default class ProductCard extends Component {
  // ...
}
```

### Styling

- Use Tailwind CSS utility classes
- Use `cn()` helper for conditional classes
- Follow shadcn/ui patterns for custom components

```typescript
import { cn } from '@/lib/utils'

function Button({ variant, className, ...props }) {
  return (
    <button
      className={cn(
        'px-4 py-2 rounded',
        variant === 'primary' && 'bg-blue-500 text-white',
        variant === 'secondary' && 'bg-gray-200',
        className
      )}
      {...props}
    />
  )
}
```

## Adding New Features

### Adding a New Page

1. Create page component in `src/pages/`:

```typescript
// src/pages/NewFeature.tsx
export function NewFeature() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('newFeature.title')}</h1>
      {/* Page content */}
    </div>
  )
}
```

2. Add route in `src/routes.ts`:

```typescript
export const routes = [
  // ... existing routes
  { path: '/new-feature', element: <NewFeature /> }
]
```

3. Add navigation link in `src/components/AppSidebar.tsx`

4. Add translations in `src/lib/i18n/locales/*.json`

### Adding a New Database Collection

1. Define types in `src/types/`:

```typescript
// src/types/newEntity.ts
export interface NewEntity {
  $id: string
  name: string
  // ... other fields
}

export const newEntitySchema = z.object({
  name: z.string().min(1)
})
```

2. Add collection ID in `src/lib/appwrite/config.ts`:

```typescript
export const COLLECTIONS = {
  // ... existing
  NEW_ENTITY: 'new_entity'
}
```

3. Create service in `src/lib/appwrite/`:

```typescript
// src/lib/appwrite/newEntity.ts
export const newEntityService = {
  async create(data: CreateNewEntityInput) {
    return databaseService.createDocument<NewEntity>(
      COLLECTIONS.NEW_ENTITY,
      data
    )
  },
  // ... other methods
}
```

4. Add migration in `scripts/migrate-database.ts`

5. Create React Query hooks in `src/hooks/`

### Adding a Background Job

1. Create task in `trigger/`:

```typescript
// trigger/new-task.ts
import { task } from "@trigger.dev/sdk/v4"

export const newTask = task({
  id: "new-task",
  run: async (payload: { data: string }) => {
    // Task logic
    return { success: true }
  }
})
```

2. Deploy to Trigger.dev:

```bash
npx trigger.dev deploy
```

3. Queue from frontend:

```typescript
const queueNewTask = async (data: string) => {
  await jobService.create({
    user_id: userId,
    action: 'new-task',
    status: 'pending'
  })
  // Trigger.dev picks up and processes
}
```

## Testing

### Unit Tests

```bash
# Run all unit tests
npm run test

# Run in watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

Example test:

```typescript
// __tests__/utils.test.ts
import { describe, it, expect } from 'vitest'
import { formatCurrency } from '@/lib/utils'

describe('formatCurrency', () => {
  it('formats numbers as currency', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56')
  })
})
```

### E2E Tests

```bash
# Run Playwright tests
npm run test:e2e

# With UI
npm run test:e2e:ui
```

Example test:

```typescript
// e2e/products.spec.ts
import { test, expect } from '@playwright/test'

test('can create a product', async ({ page }) => {
  await page.goto('/products')
  await page.click('button:has-text("Add Product")')
  await page.fill('input[name="barcode"]', '123456')
  await page.fill('input[name="name"]', 'Test Product')
  await page.click('button:has-text("Save")')
  await expect(page.locator('text=Test Product')).toBeVisible()
})
```

## Debugging

### Browser DevTools

- React DevTools extension for component inspection
- Network tab for API calls
- Console for errors and logs

### Appwrite Console

- Database browser for data inspection
- Logs for function execution
- Auth for user management

### Trigger.dev Dashboard

- Run history and logs
- Failed job inspection
- Real-time execution monitoring

## Common Tasks

### Updating Dependencies

```bash
# Check for updates
npm outdated

# Update all dependencies
npm update

# Update specific package
npm install package@latest
```

### Adding a UI Component

Using shadcn/ui CLI:

```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add dialog
```

### Generating Types

If using Appwrite's type generation:

```bash
# Generate types from Appwrite schema
# (manual process - copy from console)
```

### Code Formatting

```bash
# Format all files
npm run format

# Check formatting
npm run format:check
```

### Linting

```bash
# Run ESLint
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

## Git Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates

### Commit Messages

Follow conventional commits:

```
feat: add product import functionality
fix: resolve stock calculation bug
docs: update API documentation
refactor: extract common hooks
```

### Pull Requests

1. Create feature branch from `main`
2. Make changes and commit
3. Push and create PR
4. Request review
5. Address feedback
6. Merge when approved

## Performance Tips

### React Query

- Use appropriate `staleTime` to reduce refetches
- Implement pagination for large lists
- Use `select` to transform data

### Virtual Scrolling

For large lists, use TanStack Virtual:

```typescript
const rowVirtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 50
})
```

### Bundle Size

- Import only needed lodash functions
- Use dynamic imports for large components
- Analyze bundle with `npm run build -- --analyze`
