import { test, expect } from '@playwright/test'

async function waitForGalleryReady(page: import('@playwright/test').Page) {
  await expect(page.getByText('Loading gallery…')).toBeHidden({ timeout: 120_000 })
}

async function openPhotoCount(page: import('@playwright/test').Page) {
  return page.getByRole('button', { name: /^Open .+ fullscreen$/ }).count()
}

test.describe('gallery filters and collections', () => {
  test('opens a collection from the strip', async ({ page }) => {
    await page.goto('/')
    await waitForGalleryReady(page)

    const collectionCard = page.getByRole('button', {
      name: /Crewe Cult Protest/i,
    })
    if ((await collectionCard.count()) === 0) {
      test.skip(true, 'Collection crewe-cult-protest not in manifest for this build')
    }

    const total = await openPhotoCount(page)
    await collectionCard.first().click()
    await expect(page.locator('header.collection-view-bar')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Crewe Cult Protest' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'All photos' })).toBeVisible()

    const inCollection = await openPhotoCount(page)
    expect(inCollection).toBeGreaterThan(0)
    expect(inCollection).toBeLessThan(total)

    await page.getByRole('button', { name: 'All photos' }).click()
    await expect(page.locator('header.collection-view-bar')).toHaveCount(0)
    expect(await openPhotoCount(page)).toBe(total)
  })

  test('tag filter narrows results and can clear', async ({ page }) => {
    await page.goto('/')
    await waitForGalleryReady(page)

    const total = await openPhotoCount(page)
    if (total === 0) {
      test.skip(true, 'No photos in gallery-manifest for this build')
    }

    const filtersBtn = page.getByRole('button', { name: 'Filters' })
    if ((await filtersBtn.count()) === 0) {
      test.skip(true, 'No location/tag filters in this build')
    }

    await filtersBtn.click()
    await page.locator('#tags-trigger').click()
    const protestTag = page
      .getByRole('navigation', { name: 'Filter photos by tag (choose any combination)' })
      .getByRole('button', { name: 'Protest', exact: true })
    if ((await protestTag.count()) === 0) {
      test.skip(true, 'Tag "Protest" not available in this build')
    }

    await protestTag.click()
    const filtered = await openPhotoCount(page)
    expect(filtered).toBeGreaterThan(0)
    expect(filtered).toBeLessThan(total)

    await page.getByRole('button', { name: 'Clear filters' }).click()
    const restored = await openPhotoCount(page)
    expect(restored).toBe(total)
  })

  test('search with no matches then clear restores grid', async ({ page }) => {
    await page.goto('/')
    await waitForGalleryReady(page)

    const total = await openPhotoCount(page)
    if (total === 0) {
      test.skip(true, 'No photos in gallery-manifest for this build')
    }

    const search = page.locator('#gallery-search')
    await search.fill('zzznomatch-e2e-query-99999')
    await expect(page.locator('.gallery-empty-filter')).toBeVisible()
    expect(await openPhotoCount(page)).toBe(0)

    await search.fill('')
    await expect(page.locator('.gallery-empty-filter')).toHaveCount(0)
    expect(await openPhotoCount(page)).toBe(total)
  })
})
