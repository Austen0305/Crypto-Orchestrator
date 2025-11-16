# Testing Guide

Complete guide to running and writing tests for CryptoOrchestrator.

## 📋 Test Overview

### Frontend Tests (Vitest)
- **Location**: `client/src/**/*.test.tsx`, `client/src/**/*.spec.tsx`
- **Framework**: Vitest + React Testing Library
- **Coverage Target**: 70%+

### E2E Tests (Playwright)
- **Location**: `tests/e2e/**/*.spec.ts`
- **Framework**: Playwright
- **Browsers**: Chrome, Firefox, Safari, Mobile

### Backend Tests (Pytest)
- **Location**: `server_fastapi/tests/**/*.py`
- **Framework**: Pytest
- **Coverage Target**: 80%+

---

## 🚀 Running Tests

### Frontend Tests

```bash
# Run all frontend tests
npm run test:frontend

# Run with UI
npm run test:frontend:ui

# Run with coverage
npm run test:frontend:coverage

# Run in watch mode
npm run test:frontend -- --watch

# Run specific test file
npm run test:frontend -- Button.test.tsx
```

### E2E Tests

```bash
# Install Playwright browsers (first time only)
npx playwright install

# Run all E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run specific test file
npx playwright test tests/e2e/auth.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed

# Run on specific browser
npx playwright test --project=chromium
```

### Backend Tests

```bash
# Run all backend tests
npm test

# Run with coverage
pytest server_fastapi/tests/ -v --cov=server_fastapi --cov-report=html

# Run specific test file
pytest server_fastapi/tests/test_auth.py -v

# Run with watch mode
pytest-watch server_fastapi/tests/
```

---

## ✍️ Writing Tests

### Frontend Component Test

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/testUtils';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    renderWithProviders(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    
    renderWithProviders(<MyComponent onClick={handleClick} />);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### E2E Test

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/');
    
    // Interact with page
    await page.click('button:has-text("Click")');
    
    // Assert
    await expect(page.locator('text="Success"')).toBeVisible();
  });
});
```

### Backend Test

```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_endpoint(client: AsyncClient):
    response = await client.get("/api/endpoint")
    assert response.status_code == 200
    assert response.json()["success"] is True
```

---

## 🛠️ Test Utilities

### Frontend Test Utils

Located in `client/src/test/testUtils.tsx`:

- `renderWithProviders()` - Render component with all providers
- `createTestQueryClient()` - Create test QueryClient
- `mockApiResponse()` - Mock API responses
- `mockApiError()` - Mock API errors
- `mockData` - Common mock data

### Usage

```typescript
import { renderWithProviders, mockData } from '@/test/testUtils';

test('should render with providers', () => {
  const { queryClient } = renderWithProviders(<MyComponent />);
  // Component is wrapped with QueryClient, ThemeProvider, etc.
});
```

---

## 📊 Coverage Reports

### Frontend Coverage

```bash
npm run test:frontend:coverage
```

View report: `client/coverage/index.html`

### Backend Coverage

```bash
pytest server_fastapi/tests/ -v --cov=server_fastapi --cov-report=html
```

View report: `htmlcov/index.html`

---

## 🎯 Best Practices

### 1. Test Structure
- Group related tests in `describe` blocks
- Use descriptive test names
- Test one thing per test

### 2. Test Data
- Use mock data from `testUtils.tsx`
- Keep tests independent
- Clean up after tests

### 3. Assertions
- Use specific assertions
- Test user-facing behavior
- Avoid testing implementation details

### 4. E2E Tests
- Test critical user flows
- Use data-testid for selectors
- Wait for async operations
- Use Page Object Model for complex pages

### 5. Coverage
- Aim for 70%+ coverage
- Focus on critical paths
- Don't obsess over 100% coverage

---

## 🐛 Debugging Tests

### Frontend Tests

```bash
# Run with debug output
npm run test:frontend -- --reporter=verbose

# Debug in browser
npm run test:frontend:ui
```

### E2E Tests

```bash
# Run in headed mode
npx playwright test --headed

# Debug mode
npx playwright test --debug

# Trace viewer
npx playwright show-trace trace.zip
```

### Backend Tests

```bash
# Run with verbose output
pytest -vv

# Run with print statements
pytest -s

# Debug with pdb
pytest --pdb
```

---

## 📝 CI/CD Integration

Tests run automatically in GitHub Actions:

- **Frontend**: Type checking, linting, unit tests
- **E2E**: Playwright tests (on merge to main)
- **Backend**: Pytest with coverage

View workflows: `.github/workflows/ci.yml`

---

## 🎓 Resources

- [Vitest Docs](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Docs](https://playwright.dev/)
- [Pytest Docs](https://docs.pytest.org/)

---

## ✅ Test Checklist

Before committing:

- [ ] All tests pass locally
- [ ] New features have tests
- [ ] Coverage meets thresholds
- [ ] E2E tests pass
- [ ] No flaky tests

---

Happy Testing! 🧪

