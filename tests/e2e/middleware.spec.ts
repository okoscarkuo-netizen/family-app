import { expect, test } from '@playwright/test'

const protectedPaths = ['/', '/accounts', '/ledger', '/more', '/categories', '/merchants']

test.describe('未登入時受保護路由的導向', () => {
  for (const path of protectedPaths) {
    test(`${path} 未登入會導到 /login`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login/)
    })
  }
})
