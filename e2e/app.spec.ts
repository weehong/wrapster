import { expect, test } from '@playwright/test'

test.describe('App', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Vite/)
  })

  test('should increment counter when clicking button', async ({ page }) => {
    await page.goto('/')
    const button = page.getByRole('button', { name: /count is/i })
    await expect(button).toContainText('count is 0')
    await button.click()
    await expect(button).toContainText('count is 1')
  })
})
