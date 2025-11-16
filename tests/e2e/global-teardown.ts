/**
 * Global teardown for E2E tests
 * Runs once after all tests
 */
async function globalTeardown() {
  console.log('Running global teardown...');
  
  // Cleanup tasks:
  // - Close any remaining browser instances
  // - Clean up test data
  // - Close database connections
  
  console.log('Global teardown completed');
}

export default globalTeardown;

