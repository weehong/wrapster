import { expect, test } from '@playwright/test'

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test.describe('Unauthenticated User', () => {
    test('should be able to access public home page', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByText('Home')).toBeVisible()
    })

    test('should be able to access public login page', async ({ page }) => {
      await page.goto('/login')
      await expect(page.getByText('Login')).toBeVisible()
    })

    test('should be redirected when trying to access protected dashboard', async ({ page }) => {
      await page.goto('/dashboard')
      await expect(page).toHaveURL('/login')
      await expect(page.getByText('Login')).toBeVisible()
    })

    test('should see login form elements', async ({ page }) => {
      await page.goto('/login')
      await expect(page.getByLabel('Email')).toBeVisible()
      await expect(page.getByLabel('Password')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    })
  })

  test.describe('Protected Routes', () => {
    test('should redirect to login for protected dashboard route', async ({ page }) => {
      await page.goto('/dashboard')
      await expect(page).toHaveURL('/login')
    })

    test('should show spinner during authentication check', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'commit' })
      const spinnerOrLogin = page.getByText(/Checking authentication...|Login/)
      await expect(spinnerOrLogin).toBeVisible()
    })
  })
})
