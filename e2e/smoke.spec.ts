import { test, expect } from '@playwright/test'

/** Wait until the manifest fetch finishes (grid, empty copy, or error). */
async function waitForGalleryReady(page: import('@playwright/test').Page) {
  await expect(page.getByText('Loading gallery…')).toBeHidden({ timeout: 120_000 })
}

test.describe('gallery smoke', () => {
  test('homepage shell loads', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Skip to gallery' })).toBeVisible()
    await expect(page.locator('#gallery-main')).toBeVisible()
    await expect(page.locator('.portfolio-header')).toBeVisible()
    await expect(page.getByText('Photography')).toBeVisible()
  })

  test('gallery manifest resolves', async ({ page }) => {
    await page.goto('/')
    await waitForGalleryReady(page)
    const grid = page.locator('.gallery-grid')
    const empty = page.locator('#gallery-main .gallery-empty')
    const error = page.getByRole('alert')
    await expect(grid.or(empty).or(error)).toBeVisible()
    await expect(error).toHaveCount(0)
  })

  test('lightbox opens when photos exist', async ({ page }) => {
    await page.goto('/')
    await waitForGalleryReady(page)
    const openBtn = page.getByRole('button', { name: /^Open .+ fullscreen$/ }).first()
    if ((await openBtn.count()) === 0) {
      test.skip(true, 'No photos in gallery-manifest for this build')
    }
    await openBtn.click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByLabel('Close photo viewer')).toBeVisible()
  })
})
