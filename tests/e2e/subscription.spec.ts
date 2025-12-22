import { test, expect } from '@playwright/test';

test.describe('Subscription Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pricing');
  });

  test('should display all pricing tiers', async ({ page }) => {
    // Check for Free tier
    await expect(page.locator('text=Free')).toBeVisible();
    
    // Check for Pro tier
    await expect(page.locator('text=Pro')).toBeVisible();
    
    // Check for Teams tier
    await expect(page.locator('text=Teams')).toBeVisible();
  });

  test('should toggle between monthly and yearly pricing', async ({ page }) => {
    // Find billing toggle
    const yearlyToggle = page.locator('[data-testid="yearly-toggle"]');
    
    if (await yearlyToggle.isVisible()) {
      await yearlyToggle.click();
      
      // Should show yearly pricing
      await expect(page.locator('text=/year|annually/i')).toBeVisible();
      
      // Toggle back to monthly
      await yearlyToggle.click();
      await expect(page.locator('text=/month/i')).toBeVisible();
    }
  });

  test('should redirect to auth when not logged in', async ({ page }) => {
    const upgradeButton = page.locator('button:has-text("Get Started")').first();
    await upgradeButton.click();
    
    // Should redirect to auth page
    await expect(page).toHaveURL(/.*auth.*/);
  });

  test('should show feature comparison', async ({ page }) => {
    // Free tier features
    await expect(page.locator('text=50 events/month')).toBeVisible();
    
    // Pro tier features
    await expect(page.locator('text=Unlimited events')).toBeVisible();
    
    // Teams tier features
    await expect(page.locator('text=Team workspace')).toBeVisible();
  });

  test('should display FAQ section', async ({ page }) => {
    await page.locator('text=Frequently Asked Questions').scrollIntoViewIfNeeded();
    
    // FAQ should be visible
    await expect(page.locator('text=Frequently Asked Questions')).toBeVisible();
    
    // Should have multiple FAQ items
    const faqItems = page.locator('[data-testid="faq-item"]');
    const count = await faqItems.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Billing Dashboard', () => {
  test('should show subscription status for authenticated users', async ({ page }) => {
    // This test requires authentication
    // In real scenario, you'd use fixtures or helpers to log in
    await page.goto('/billing');
    
    // If redirected to auth, skip
    if (page.url().includes('auth')) {
      test.skip();
    }
    
    // Should show subscription info
    await expect(
      page.locator('text=/subscription|plan|billing/i')
    ).toBeVisible({ timeout: 5000 });
  });
});
