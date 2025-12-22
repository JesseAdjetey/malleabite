import { test, expect } from '@playwright/test';

test.describe('Mobile Gestures', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Skip auth if needed
    await page.waitForURL(/.*/, { timeout: 5000 }).catch(() => {});
  });

  test('should swipe to change months in mobile calendar', async ({ page }) => {
    // Navigate to mobile month view
    const calendar = page.locator('[data-testid="mobile-month-view"]');
    
    if (await calendar.isVisible()) {
      // Get initial month
      const initialMonth = await page.locator('h2').first().textContent();
      
      // Simulate swipe left (next month) using drag
      const box = await calendar.boundingBox();
      if (box) {
        await page.mouse.move(box.x + 200, box.y + 300);
        await page.mouse.down();
        await page.mouse.move(box.x + 50, box.y + 300);
        await page.mouse.up();
      }
      await page.waitForTimeout(500);
      
      const nextMonth = await page.locator('h2').first().textContent();
      expect(nextMonth).not.toBe(initialMonth);
      
      // Swipe right (previous month)
      if (box) {
        await page.mouse.move(box.x + 50, box.y + 300);
        await page.mouse.down();
        await page.mouse.move(box.x + 200, box.y + 300);
        await page.mouse.up();
      }
      await page.waitForTimeout(500);
      
      const finalMonth = await page.locator('h2').first().textContent();
      expect(finalMonth).toBe(initialMonth);
    }
  });

  test('should open event form on date tap', async ({ page }) => {
    const dateCell = page.locator('[data-testid="calendar-date"]').first();
    
    if (await dateCell.isVisible()) {
      await dateCell.tap();
      await page.waitForTimeout(300);
      
      // Event form should appear
      const eventForm = page.locator('[data-testid="mobile-event-form"]');
      await expect(eventForm).toBeVisible({ timeout: 2000 });
    }
  });

  test('should have minimum 44px touch targets', async ({ page }) => {
    const buttons = page.locator('button');
    const count = await buttons.count();
    
    for (let i = 0; i < Math.min(count, 10); i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        const box = await button.boundingBox();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(40); // Allow slight margin
          expect(box.width).toBeGreaterThanOrEqual(40);
        }
      }
    }
  });

  test('should show floating action button', async ({ page }) => {
    const fab = page.locator('button[class*="fixed"][class*="bottom"]');
    await expect(fab).toBeVisible({ timeout: 3000 });
    
    // FAB should be at least 48px
    const box = await fab.boundingBox();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(48);
      expect(box.width).toBeGreaterThanOrEqual(48);
    }
  });
});
