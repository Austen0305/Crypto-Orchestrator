import { chromium, FullConfig } from '@playwright/test';

/**
 * Global setup for E2E tests
 * Runs once before all tests
 */
async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  
  console.log(`Starting global setup for ${baseURL}`);
  
  // Launch browser and create authenticated session if needed
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Navigate to app
    await page.goto(baseURL || 'http://localhost:5173');
    
    // Wait for app to load
    await page.waitForLoadState('networkidle');
    
    // Optionally: Login and save auth state
    // const emailInput = page.locator('input[type="email"]').first();
    // if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    //   await emailInput.fill('test@example.com');
    //   const passwordInput = page.locator('input[type="password"]').first();
    //   await passwordInput.fill('testpassword123');
    //   const submitButton = page.locator('button[type="submit"]').first();
    //   await submitButton.click();
    //   await page.waitForURL(/\/(dashboard|\/)/);
    //   await page.context().storageState({ path: 'tests/e2e/.auth/user.json' });
    // }
    
    console.log('Global setup completed');
  } catch (error) {
    console.warn('Global setup warning:', error);
  } finally {
    await browser.close();
  }
}

export default globalSetup;

