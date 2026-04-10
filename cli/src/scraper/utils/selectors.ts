/**
 * Utility functions for working with CSS selectors and XPath expressions
 */

/**
 * Build a robust CSS selector for an element
 */
export function buildSelector(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    // Add ID if present (most specific)
    if (current.id) {
      selector += `#${current.id}`;
      parts.unshift(selector);
      break;
    }

    // Add classes
    if (current.className && typeof current.className === 'string') {
      const classes = current.className
        .split(' ')
        .filter((c) => c && !c.startsWith('ng-') && !c.startsWith('vue-')) // Filter out framework classes
        .slice(0, 2); // Limit to first 2 classes

      if (classes.length > 0) {
        selector += `.${classes.join('.')}`;
      }
    }

    // Add position among siblings
    const siblings = Array.from(current.parentElement?.children ?? []);
    const sameTagSiblings = siblings.filter((s) => s.tagName === current!.tagName);

    if (sameTagSiblings.length > 1) {
      const index = sameTagSiblings.indexOf(current) + 1;
      selector += `:nth-of-type(${index})`;
    }

    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

/**
 * Escape special CSS selector characters
 */
export function escapeSelector(str: string): string {
  return str.replace(/([!"#$%&'()*+,.\/\\:;<=>?@[\]^`{|}~])/g, '\\$1');
}

/**
 * Common selector patterns for extracting data
 */
export const CommonSelectors = {
  // Price patterns
  prices: [
    '[class*="price"]',
    '[class*="cost"]',
    '[class*="amount"]',
    '[data-price]',
    '.price',
    '.amount',
    '[itemprop="price"]',
  ],

  // Product selectors
  product: {
    name: [
      '[class*="product-title"]',
      '[class*="product-name"]',
      'h1[class*="product"]',
      '[itemprop="name"]',
      '[data-product-name]',
    ],
    description: ['[itemprop="description"]', '[class*="description"]', '[class*="about"]'],
    image: ['[itemprop="image"]', '[class*="product-image"]', '[data-product-image]', 'img[alt*="product"]'],
    availability: ['[itemprop="availability"]', '[class*="stock"]', '[class*="available"]'],
  },

  // Article/blog selectors
  article: {
    title: ['article h1', '[class*="article-title"]', '[class*="post-title"]', 'h1.entry-title'],
    content: [
      'article',
      '[class*="article-content"]',
      '[class*="post-content"]',
      '[itemprop="articleBody"]',
    ],
    author: ['[class*="author"]', '[itemprop="author"]', 'a[rel="author"]'],
    date: ['[class*="published"]', '[itemprop="datePublished"]', 'time[datetime]'],
  },

  // Contact information
  contact: {
    email: ['a[href^="mailto:"]', '[class*="email"]', '[itemprop="email"]'],
    phone: ['a[href^="tel:"]', '[class*="phone"]', '[itemprop="telephone"]'],
    address: ['[itemprop="address"]', '[class*="address"]', 'address'],
  },

  // Social links
  social: ['a[href*="twitter.com"]', 'a[href*="facebook.com"]', 'a[href*="linkedin.com"]', 'a[href*="instagram.com"]'],

  // Navigation
  navigation: ['nav', '[role="navigation"]', '[class*="nav"]', '[class*="menu"]'],
  pagination: ['[class*="pagination"]', 'nav[aria-label*="page"]', '[role="navigation"]'],

  // Forms
  form: {
    search: ['form[role="search"]', '[class*="search-form"]', 'input[type="search"]', 'input[name="q"]'],
    inputs: ['input:not([type="hidden"])', 'textarea', 'select'],
    submit: ['button[type="submit"]', 'input[type="submit"]', '[class*="submit"]', '[class*="btn-submit"]'],
  },
};

/**
 * Create a selector with fallback options
 */
export function selectorWithFallback(...selectors: string[]): string {
  return selectors.join(', ');
}

/**
 * Generate a unique data attribute selector
 */
export function dataAttrSelector(name: string, value?: string): string {
  if (value) {
    return `[data-${name}="${escapeSelector(value)}"]`;
  }
  return `[data-${name}]`;
}

/**
 * Extract text content using multiple fallback selectors
 */
export async function extractTextWithFallback<T extends { textContent: () => Promise<string | null>, first?: () => T }>(
  locator: { locator: (s: string) => T },
  selectors: string[]
): Promise<string | null> {
  for (const selector of selectors) {
    try {
      const element = locator.locator(selector);
      // Use first() if available (Playwright Locator), otherwise just use the element itself
      const firstElement = element.first ? element.first() : element;
      const text = await firstElement.textContent();
      if (text?.trim()) return text.trim();
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Validate if a string is a valid CSS selector
 */
export function isValidSelector(selector: string): boolean {
  try {
    document.querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert XPath to CSS selector (basic conversion)
 */
export function xpathToCss(xpath: string): string {
  // Very basic XPath to CSS conversion
  // Handles common cases only
  return (
    xpath
      // Remove leading //
      .replace(/^\/\//, '')
      // Remove [@ for attribute check
      .replace(/\[@/g, '[')
      // Convert @ to nothing for attribute
      .replace(/\[@/g, '[')
      // Handle // to space
      .replace(/\/\//g, ' ')
      // Handle / to >
      .replace(/\//g, ' > ')
      // Handle [n] to :nth-of-type(n)
      .replace(/\[(\d+)\]/g, ':nth-of-type($1)')
      // Handle position()=1 (remove if present, default is first)
      .replace(/\[position\(\)=\d+\]/, '')
  );
}

/**
 * Create a selector builder for complex queries
 */
export class SelectorBuilder {
  private selectors: string[] = [];

  /**
   * Add a tag selector
   */
  tag(name: string): this {
    this.selectors.push(name.toLowerCase());
    return this;
  }

  /**
   * Add an ID selector
   */
  id(value: string): this {
    this.selectors.push(`#${escapeSelector(value)}`);
    return this;
  }

  /**
   * Add a class selector
   */
  className(...names: string[]): this {
    names.forEach((name) => this.selectors.push(`.${escapeSelector(name)}`));
    return this;
  }

  /**
   * Add an attribute selector
   */
  attribute(name: string, value?: string, operator?: '=' | '~=' | '|=' | '^=' | '$=' | '*='): this {
    if (value && operator) {
      this.selectors.push(`[${name}${operator}"${escapeSelector(value)}"]`);
    } else if (value) {
      this.selectors.push(`[${name}="${escapeSelector(value)}"]`);
    } else {
      this.selectors.push(`[${name}]`);
    }
    return this;
  }

  /**
   * Add a data attribute selector
   */
  data(name: string, value?: string): this {
    return this.attribute(`data-${name}`, value);
  }

  /**
   * Add a :contains-like selector (text content)
   * Note: :contains is not valid CSS, but useful for XPath
   */
  contains(text: string): this {
    // This is a pseudo-selector that frameworks like jQuery support
    // In pure CSS, you'd need to use attribute or other selectors
    this.selectors.push(`[data-content*="${escapeSelector(text)}"]`);
    return this;
  }

  /**
   * Add a child combinator
   */
  child(): this {
    this.selectors.push(' > ');
    return this;
  }

  /**
   * Add a descendant combinator
   */
  descendant(): this {
    this.selectors.push(' ');
    return this;
  }

  /**
   * Add a sibling combinator
   */
  sibling(immediate = false): this {
    this.selectors.push(immediate ? ' + ' : ' ~ ');
    return this;
  }

  /**
   * Build the final selector string
   */
  build(): string {
    return this.selectors.join('');
  }

  /**
   * Clear all selectors
   */
  clear(): this {
    this.selectors = [];
    return this;
  }
}

/**
 * Factory function for SelectorBuilder
 */
export function selector(): SelectorBuilder {
  return new SelectorBuilder();
}
