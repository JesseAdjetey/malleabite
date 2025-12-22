import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should show auth page for unauthenticated users', async ({ page }) => {
    await page.goto('/');
    
    // Should redirect to auth or show auth UI
    const isAuthPage = page.url().includes('auth') || 
                       await page.locator('text=/sign in|log in/i').isVisible();
    
    expect(isAuthPage).toBe(true);
  });

  test('should have login and signup options', async ({ page }) => {
    await page.goto('/auth');
    
    // Should show auth methods
    const hasGoogleAuth = await page.locator('text=/google/i').isVisible();
    const hasEmailAuth = await page.locator('input[type="email"]').isVisible();
    
    expect(hasGoogleAuth || hasEmailAuth).toBe(true);
  });

  test('should validate email format', async ({ page }) => {
    await page.goto('/auth');
    
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible()) {
      await emailInput.fill('invalid-email');
      await emailInput.blur();
      
      // Should show validation error
      const hasError = await page.locator('text=/invalid|error/i').isVisible();
      expect(hasError).toBe(true);
    }
  });

  test('should show legal links', async ({ page }) => {
    await page.goto('/auth');
    
    // Privacy policy link
    const privacyLink = page.locator('a[href*="privacy"]');
    await expect(privacyLink).toBeVisible();
    
    // Terms of service link
    const termsLink = page.locator('a[href*="terms"]');
    await expect(termsLink).toBeVisible();
  });
});
