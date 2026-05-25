import { expect, test } from '@playwright/test'

test.describe('PWA 基本檢查', () => {
  test('manifest.webmanifest 可下載且 JSON 合法', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest')
    expect(response.status()).toBe(200)
    const json = await response.json()
    expect(json.name).toBeTruthy()
  })

  test('service worker 檔案可下載', async ({ request }) => {
    const response = await request.get('/sw.js')
    expect(response.status()).toBe(200)
    const body = await response.text()
    expect(body.length).toBeGreaterThan(0)
  })

  test('首頁 HTML 沒有 5xx 錯誤', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status() ?? 0).toBeLessThan(500)
  })
})
