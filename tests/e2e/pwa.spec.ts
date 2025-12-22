import { test, expect } from '@playwright/test';

test.describe('PWA Features', () => {
  test('should register service worker', async ({ page }) => {
    await page.goto('/');
    
    // Wait for service worker registration
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          return !!registration;
        } catch {
          return false;
        }
      }
      return false;
    });
    
    expect(swRegistered).toBe(true);
  });

  test('should have valid manifest', async ({ page }) => {
    const response = await page.goto('/manifest.json');
    expect(response?.status()).toBe(200);
    
    const manifest = await response?.json();
    expect(manifest).toBeDefined();
    expect(manifest.name).toBe('Malleabite');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test('should cache static assets', async ({ page, context }) => {
    await page.goto('/');
    
    // Wait for SW to activate and cache
    await page.waitForTimeout(2000);
    
    // Check if resources are cached
    const cacheNames = await page.evaluate(async () => {
      return await caches.keys();
    });
    
    expect(cacheNames.length).toBeGreaterThan(0);
    expect(cacheNames.some((name: string) => name.includes('malleabite'))).toBe(true);
  });

  test('should work offline', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Go offline
    await context.setOffline(true);
    
    // Reload page
    await page.reload();
    
    // Should still show content (from cache)
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(0);
    
    // Go back online
    await context.setOffline(false);
  });

  test('should show install prompt on desktop', async ({ page, browserName }) => {
    // Skip on webkit (Safari doesn't support beforeinstallprompt)
    test.skip(browserName === 'webkit', 'Safari does not support install prompt');
    
    await page.goto('/');
    
    // Install prompt should appear after delay
    const installPrompt = page.locator('[data-testid="install-prompt"]');
    await expect(installPrompt).toBeVisible({ timeout: 10000 });
  });
});
