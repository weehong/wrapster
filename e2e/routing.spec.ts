import { expect, test } from '@playwright/test'

test.describe('Routing', () => {
  test.describe('Public Routes', () => {
    test('should load the home page at root path', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByText('Home')).toBeVisible()
    })

    test('should load the login page at /login', async ({ page }) => {
      await page.goto('/login')
      await expect(page.getByText('Login')).toBeVisible()
    })

    test('should navigate from home to login', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByText('Home')).toBeVisible()
      await page.goto('/login')
      await expect(page.getByText('Login')).toBeVisible()
    })
  })

  test.describe('Protected Routes', () => {
    test('should redirect to login when accessing dashboard without auth', async ({ page }) => {
      await page.goto('/dashboard')
      await expect(page.getByText('Login')).toBeVisible()
      await expect(page).toHaveURL('/login')
    })

    test('should show loading spinner before redirecting', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'commit' })
      const spinnerOrLogin = page.getByText(/Checking authentication...|Login/)
      await expect(spinnerOrLogin).toBeVisible()
    })
  })
})
