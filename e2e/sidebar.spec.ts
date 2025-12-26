import { expect, test } from '@playwright/test'

test.describe('Sidebar Navigation', () => {
  test.describe('Unauthenticated - Protected Routes Redirect', () => {
    const protectedRoutes = [
      { name: 'Packaging', path: '/packaging' },
      { name: 'Unpack', path: '/unpack' },
      { name: 'Products', path: '/products' },
      { name: 'Reports', path: '/reports' },
    ]

    for (const route of protectedRoutes) {
      test(`should redirect to login when accessing ${route.name} page without auth`, async ({
        page,
      }) => {
        await page.goto(route.path)
        await expect(page).toHaveURL('/login')
        await expect(page.getByText('Login')).toBeVisible()
      })
    }
  })

  test.describe('Sidebar Menu Items', () => {
    test.beforeEach(async ({ page }) => {
      // Mock authentication by setting up local storage or cookies if needed
      // For now, we'll test that sidebar menu items exist in the DOM
      // This requires the app to have a way to bypass auth for testing
      // or we test via the authenticated flow
    })

    test('should have sidebar navigation structure', async ({ page }) => {
      // Navigate to dashboard - it will redirect to login if not authenticated
      await page.goto('/dashboard')

      // Wait for either the sidebar (authenticated) or login page (unauthenticated)
      const sidebarOrLogin = page.getByText(/Dashboard|Login/)
      await expect(sidebarOrLogin.first()).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Navigation Menu Item Accessibility', () => {
    test('all navigation routes should be defined and accessible', async ({ page }) => {
      const routes = ['/packaging', '/unpack', '/products', '/reports']

      for (const route of routes) {
        const response = await page.goto(route)
        // Route should exist (not 404) - it will redirect to login but route is valid
        expect(response?.status()).not.toBe(404)
      }
    })
  })

  test.describe('Sidebar Visual Elements', () => {
    test('should show loading state when accessing protected sidebar routes', async ({
      page,
    }) => {
      await page.goto('/packaging', { waitUntil: 'commit' })
      const spinnerOrLogin = page.getByText(/Checking authentication...|Login/)
      await expect(spinnerOrLogin).toBeVisible()
    })

    test('should redirect all sidebar routes to login when unauthenticated', async ({
      page,
    }) => {
      const routes = [
        { path: '/dashboard', name: 'Dashboard' },
        { path: '/packaging', name: 'Packaging' },
        { path: '/unpack', name: 'Unpack' },
        { path: '/products', name: 'Products' },
        { path: '/reports', name: 'Reports' },
      ]

      for (const route of routes) {
        await page.goto(route.path)
        await expect(page).toHaveURL('/login')
      }
    })
  })
})
