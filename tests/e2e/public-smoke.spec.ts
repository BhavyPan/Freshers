import { expect, test } from '@playwright/test'

test('landing and verification entry points render', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText("OBSIDIAN '26", { exact: false }).first()).toBeVisible()
  await page.goto('/#/verify')
  await expect(page.getByRole('textbox')).toBeVisible()
  await expect(page.getByText('Verify', { exact: false }).first()).toBeVisible()
})

test('admin login remains protected and available', async ({ page }) => {
  await page.goto('/#/admin')
  await expect(page.getByLabel('Username')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
})
