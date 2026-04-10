import { chromium, firefox, webkit, Browser, BrowserContext, Page } from 'playwright';
import type { BrowserPoolConfig, ProxyConfig, ViewportConfig } from '../types/index.js';

interface PooledBrowser {
  browser: Browser;
  contexts: Map<string, BrowserContext>;
  pages: Map<string, Page>;
  lastUsed: Date;
}

/**
 * Manages a pool of browser instances for concurrent scraping operations.
 * Implements connection pooling and resource management.
 */
export class BrowserPool {
  private browsers: Map<string, PooledBrowser> = new Map();
  private config: Required<BrowserPoolConfig>;
  private usageCount = 0;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: BrowserPoolConfig = {}) {
    this.config = {
      maxBrowsers: config.maxBrowsers ?? 5,
      maxPagesPerBrowser: config.maxPagesPerBrowser ?? 10,
      launchOptions: config.launchOptions ?? {},
      persistent: config.persistent ?? false,
    };

    this.startCleanupInterval();
  }

  /**
   * Initialize the pool with a minimum number of browsers
   */
  async initialize(minBrowsers = 1): Promise<void> {
    for (let i = 0; i < Math.min(minBrowsers, this.config.maxBrowsers); i++) {
      await this.createBrowser();
    }
  }

  /**
   * Acquire a page from the pool
   */
  async acquirePage(options: {
    headless?: boolean;
    proxy?: ProxyConfig;
    viewport?: ViewportConfig;
    userAgent?: string;
  } = {}): Promise<{ page: Page; release: () => Promise<void> }> {
    const { headless = true, proxy, viewport, userAgent } = options;

    // Find or create browser with available capacity
    let pooledBrowser = this.findAvailableBrowser();
    
    if (!pooledBrowser) {
      if (this.browsers.size >= this.config.maxBrowsers) {
        throw new Error('Browser pool exhausted: max browsers reached');
      }
      pooledBrowser = await this.createBrowser({ headless, proxy });
    }

    // Create context with options
    const contextId = `ctx_${++this.usageCount}`;
    const context = await pooledBrowser.browser.newContext({
      viewport: viewport ?? { width: 1920, height: 1080 },
      userAgent,
      proxy: proxy ? {
        server: proxy.server,
        username: proxy.username,
        password: proxy.password,
      } : undefined,
    });

    pooledBrowser.contexts.set(contextId, context);

    // Create page
    const pageId = `page_${++this.usageCount}`;
    const page = await context.newPage();
    pooledBrowser.pages.set(pageId, page);

    // Setup error handling
    page.on('close', () => {
      // Handle close
    });

    page.on('pageerror', (err: Error) => {
      console.error(`Page error event: ${err.message}`);
    });

    // Release function
    const release = async () => {
      try {
        await page.close();
        pooledBrowser!.pages.delete(pageId);
        
        await context.close();
        pooledBrowser!.contexts.delete(contextId);
      } catch (err) {
        console.error('Error releasing page:', err);
      }
    };

    pooledBrowser.lastUsed = new Date();
    return { page, release };
  }

  /**
   * Create a new browser instance
   */
  private async createBrowser(options: { headless?: boolean; proxy?: ProxyConfig } = {}): Promise<PooledBrowser> {
    const browserId = `browser_${++this.usageCount}`;
    
    const browser = await chromium.launch({
      headless: options.headless ?? true,
      ...this.config.launchOptions,
    });

    const pooledBrowser: PooledBrowser = {
      browser,
      contexts: new Map(),
      pages: new Map(),
      lastUsed: new Date(),
    };

    this.browsers.set(browserId, pooledBrowser);
    return pooledBrowser;
  }

  /**
   * Find a browser with available page capacity
   */
  private findAvailableBrowser(): PooledBrowser | undefined {
    for (const [, pooledBrowser] of this.browsers) {
      if (pooledBrowser.pages.size < this.config.maxPagesPerBrowser) {
        return pooledBrowser;
      }
    }
    return undefined;
  }

  /**
   * Get current pool statistics
   */
  getStats(): { browsers: number; contexts: number; pages: number } {
    let contexts = 0;
    let pages = 0;
    
    for (const [, pooledBrowser] of this.browsers) {
      contexts += pooledBrowser.contexts.size;
      pages += pooledBrowser.pages.size;
    }

    return { browsers: this.browsers.size, contexts, pages };
  }

  /**
   * Start cleanup interval for idle browsers
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleBrowsers();
    }, 60000); // Check every minute
  }

  /**
   * Remove idle browsers
   */
  private cleanupIdleBrowsers(maxIdleMs = 300000): void {
    const now = Date.now();
    
    for (const [id, pooledBrowser] of this.browsers) {
      if (pooledBrowser.pages.size === 0 && now - pooledBrowser.lastUsed.getTime() > maxIdleMs) {
        pooledBrowser.browser.close().catch(console.error);
        this.browsers.delete(id);
      }
    }
  }

  /**
   * Close all browsers and cleanup
   */
  async dispose(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    const closePromises: Promise<void>[] = [];
    
    for (const [, pooledBrowser] of this.browsers) {
      // Close all pages
      for (const [, page] of pooledBrowser.pages) {
        closePromises.push(page.close());
      }
      
      // Close all contexts
      for (const [, context] of pooledBrowser.contexts) {
        closePromises.push(context.close());
      }
      
      // Close browser
      closePromises.push(pooledBrowser.browser.close());
    }

    await Promise.allSettled(closePromises);
    this.browsers.clear();
  }
}
