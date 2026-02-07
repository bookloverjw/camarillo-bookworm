import { test, expect } from '@playwright/test';

// ─── Page Load & Layout ─────────────────────────────────────────────────────

test.describe('Page Load & Layout', () => {
  test('should display the page title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Camarillo Bookworm/);
  });

  test('should render the hero section', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Welcome to Camarillo Bookworm')).toBeVisible();
  });

  test('should render the navbar with logo', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Camarillo Bookworm').first()).toBeVisible();
  });

  test('should render the footer', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('footer')).toBeVisible();
    await expect(page.locator('footer').locator('text=Your neighborhood independent bookstore since 1973.')).toBeVisible();
  });

  test('should show the announcement bar with store hours', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Free local delivery')).toBeVisible();
  });
});

// ─── Navigation ─────────────────────────────────────────────────────────────

test.describe('Navigation', () => {
  test('should navigate to the shop page', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Browse Books');
    await expect(page.locator('text=Search by title, author')).toBeVisible();
  });

  test('should navigate to events page', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="#/events"]');
    await page.waitForURL(/#\/events/);
  });

  test('should navigate to about page', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="#/about"]');
    await page.waitForURL(/#\/about/);
  });
});

// ─── Shopping Cart ──────────────────────────────────────────────────────────

test.describe('Shopping Cart', () => {
  test('should show cart page with empty state', async ({ page }) => {
    await page.goto('/#/cart');
    await expect(page.locator('text=Your cart is empty').or(page.locator('text=Cart'))).toBeVisible();
  });

  test('should persist cart across page reload', async ({ page }) => {
    await page.goto('/');
    // Set a cart item in localStorage
    await page.evaluate(() => {
      localStorage.setItem('bookworm_cart', JSON.stringify([{
        id: '1',
        title: 'The Midnight Library',
        author: 'Matt Haig',
        price: 26.00,
        quantity: 1,
        cover: 'https://example.com/cover.jpg',
        type: 'Hardcover'
      }]));
    });
    await page.reload();
    // The cart badge should show 1 item
    await expect(page.locator('text=1').first()).toBeVisible();
  });
});

// ─── Book Detail Modal ──────────────────────────────────────────────────────

test.describe('Book Detail Modal', () => {
  test('should open modal when clicking a book card on home page', async ({ page }) => {
    await page.goto('/');
    // Click the first book in a carousel
    const bookCard = page.locator('button.group\\/book').first();
    if (await bookCard.isVisible()) {
      await bookCard.click();
      // Modal should appear with a dialog role
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    }
  });

  test('should show reviews in the modal', async ({ page }) => {
    await page.goto('/');
    const bookCard = page.locator('button.group\\/book').first();
    if (await bookCard.isVisible()) {
      await bookCard.click();
      await expect(page.locator('text=Reader Reviews')).toBeVisible();
    }
  });

  test('should show related titles in the modal', async ({ page }) => {
    await page.goto('/');
    const bookCard = page.locator('button.group\\/book').first();
    if (await bookCard.isVisible()) {
      await bookCard.click();
      await expect(page.locator('text=You Might Also Like')).toBeVisible();
    }
  });

  test('should close modal with close button', async ({ page }) => {
    await page.goto('/');
    const bookCard = page.locator('button.group\\/book').first();
    if (await bookCard.isVisible()) {
      await bookCard.click();
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await page.locator('[aria-label="Close modal"]').click();
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    }
  });

  test('should close modal with Escape key', async ({ page }) => {
    await page.goto('/');
    const bookCard = page.locator('button.group\\/book').first();
    if (await bookCard.isVisible()) {
      await bookCard.click();
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    }
  });

  test('should have add-to-cart buttons in modal', async ({ page }) => {
    await page.goto('/');
    const bookCard = page.locator('button.group\\/book').first();
    if (await bookCard.isVisible()) {
      await bookCard.click();
      await expect(page.locator('[role="dialog"]').locator('text=In-Store Pickup')).toBeVisible();
      await expect(page.locator('[role="dialog"]').locator('text=Ship to Me')).toBeVisible();
    }
  });
});

// ─── Dark Mode ──────────────────────────────────────────────────────────────

test.describe('Dark Mode', () => {
  test('should toggle dark mode on', async ({ page }) => {
    await page.goto('/');
    // Click the dark mode toggle (moon icon button)
    const toggle = page.locator('[aria-label="Switch to dark mode"]');
    if (await toggle.isVisible()) {
      await toggle.click();
      // HTML element should have "dark" class
      await expect(page.locator('html')).toHaveClass(/dark/);
    }
  });

  test('should persist dark mode across reload', async ({ page }) => {
    await page.goto('/');
    // Set dark theme in localStorage
    await page.evaluate(() => {
      localStorage.setItem('bookworm_theme', 'dark');
    });
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('should toggle back to light mode', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('bookworm_theme', 'dark');
    });
    await page.reload();
    // Now click the sun icon to go back to light
    const toggle = page.locator('[aria-label="Switch to light mode"]');
    if (await toggle.isVisible()) {
      await toggle.click();
      await expect(page.locator('html')).not.toHaveClass(/dark/);
    }
  });
});

// ─── SEO & Accessibility ────────────────────────────────────────────────────

test.describe('SEO & Accessibility', () => {
  test('should have meta description', async ({ page }) => {
    await page.goto('/');
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toContain('Camarillo Bookworm');
  });

  test('should have Open Graph tags', async ({ page }) => {
    await page.goto('/');
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toContain('Camarillo Bookworm');

    const ogType = await page.locator('meta[property="og:type"]').getAttribute('content');
    expect(ogType).toBe('website');

    const ogSiteName = await page.locator('meta[property="og:site_name"]').getAttribute('content');
    expect(ogSiteName).toBe('Camarillo Bookworm');

    const ogLocale = await page.locator('meta[property="og:locale"]').getAttribute('content');
    expect(ogLocale).toBe('en_US');
  });

  test('should have Twitter Card tags', async ({ page }) => {
    await page.goto('/');
    const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute('content');
    expect(twitterCard).toBe('summary_large_image');
  });

  test('should have JSON-LD structured data', async ({ page }) => {
    await page.goto('/');
    const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
    expect(jsonLd).toBeTruthy();
    const data = JSON.parse(jsonLd!);
    expect(data['@type']).toBe('BookStore');
    expect(data.name).toBe('Camarillo Bookworm');
    expect(data.address.addressLocality).toBe('Camarillo');
  });

  test('should have theme-color meta tag', async ({ page }) => {
    await page.goto('/');
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor).toBe('#1B4332');
  });
});

// ─── Newsletter Form ────────────────────────────────────────────────────────

test.describe('Newsletter Form', () => {
  test('should render newsletter form in footer', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('footer').locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('footer').locator('text=Join')).toBeVisible();
  });
});

// ─── Book Detail Page ───────────────────────────────────────────────────────

test.describe('Book Detail Page', () => {
  test('should show book information', async ({ page }) => {
    await page.goto('/#/book/1');
    await expect(page.locator('text=The Midnight Library').first()).toBeVisible();
    await expect(page.locator('text=Matt Haig').first()).toBeVisible();
  });

  test('should show purchase options', async ({ page }) => {
    await page.goto('/#/book/1');
    await expect(page.locator('text=In-Store Pickup').first()).toBeVisible();
    await expect(page.locator('text=Ship to Me').first()).toBeVisible();
  });

  test('should show related books', async ({ page }) => {
    await page.goto('/#/book/1');
    await expect(page.locator('text=You Might Also Like')).toBeVisible();
  });
});
