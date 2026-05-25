import { expect, test } from '@playwright/test'

test.describe('未登入頁面', () => {
  test('根路徑未登入會導到 /login', async ({ page }) => {
    const response = await page.goto('/')
    expect(page.url()).toContain('/login')
    expect(response?.status() ?? 0).toBeLessThan(500)
  })

  test('登入頁顯示 Email 與密碼欄位', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByPlaceholder(/email/i)).toBeVisible()
    await expect(page.getByPlaceholder(/密碼/)).toBeVisible()
    await expect(page.getByRole('button', { name: '進入' })).toBeVisible()
  })

  test('註冊頁可開啟', async ({ page }) => {
    const response = await page.goto('/signup')
    expect(response?.status() ?? 0).toBeLessThan(500)
  })

  test('忘記密碼頁可開啟', async ({ page }) => {
    const response = await page.goto('/reset-password')
    expect(response?.status() ?? 0).toBeLessThan(500)
  })
})
