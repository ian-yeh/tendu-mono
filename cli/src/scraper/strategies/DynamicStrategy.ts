import type { Page } from 'playwright';
import { BaseStrategy } from './BaseStrategy.js';
import type { ScrapingConfig, ScrapingRule } from '../types/index.js';

interface WaitCondition {
  type: 'selector' | 'function' | 'timeout' | 'response';
  value: string | number | (() => boolean | Promise<boolean>);
  timeout?: number;
}

interface DynamicConfig {
  /** Wait conditions before extraction */
  waitFor?: WaitCondition[];
  /** Actions to perform before extraction */
  actions?: PageAction[];
  /** Enable JavaScript evaluation */
  evaluateScripts?: boolean;
  /** Wait for specific XHR/fetch calls to complete */
  interceptApi?: string[];
  /** Scroll to bottom to trigger lazy loading */
  scrollToBottom?: boolean;
  /** Number of times to scroll for infinite scroll */
  scrollIterations?: number;
  /** Delay between scrolls in ms */
  scrollDelay?: number;
}

type PageAction =
  | { type: 'click'; selector: string; waitFor?: WaitCondition }
  | { type: 'fill'; selector: string; value: string }
  | { type: 'select'; selector: string; value: string }
  | { type: 'hover'; selector: string }
  | { type: 'scroll'; x?: number; y?: number; selector?: string }
  | { type: 'wait'; duration: number }
  | { type: 'keypress'; key: string };

/**
 * Strategy for scraping dynamic JavaScript-heavy content.
 * Handles SPAs, infinite scroll, pagination, and async data loading.
 */
export class DynamicStrategy extends BaseStrategy<Record<string, unknown>> {
  private dynamicConfig: DynamicConfig;
  private rules?: ScrapingRule[];

  constructor(
    scrapingConfig: ScrapingConfig,
    dynamicConfig: DynamicConfig = {},
    rules?: ScrapingRule[]
  ) {
    super(scrapingConfig);
    this.dynamicConfig = dynamicConfig;
    this.rules = rules;
  }

  async execute(page: Page): Promise<Record<string, unknown>> {
    await this.preProcess(page);

    // Execute pre-extraction actions
    if (this.dynamicConfig.actions) {
      await this.executeActions(page, this.dynamicConfig.actions);
    }

    // Handle infinite scroll
    if (this.dynamicConfig.scrollToBottom || this.dynamicConfig.scrollIterations) {
      await this.handleInfiniteScroll(page);
    }

    // Extract data
    let data: Record<string, unknown>;
    if (this.rules && this.rules.length > 0) {
      data = await this.extractWithRules(page, this.rules);
    } else {
      data = await this.extractDefault(page);
    }

    return this.postProcess(data);
  }

  async preProcess(page: Page): Promise<void> {
    // Wait for network to be idle first
    await page.waitForLoadState('networkidle');

    // Apply custom wait conditions
    if (this.dynamicConfig.waitFor) {
      await this.waitForConditions(page, this.dynamicConfig.waitFor);
    }

    // Enable API interception if configured
    if (this.dynamicConfig.interceptApi && this.dynamicConfig.interceptApi.length > 0) {
      await this.setupApiInterception(page, this.dynamicConfig.interceptApi);
    }
  }

  /**
   * Execute page actions
   */
  private async executeActions(page: Page, actions: PageAction[]): Promise<void> {
    for (const action of actions) {
      switch (action.type) {
        case 'click':
          await page.locator(action.selector).click();
          if (action.waitFor) {
            await this.waitForCondition(page, action.waitFor);
          }
          break;
        case 'fill':
          await page.locator(action.selector).fill(action.value);
          break;
        case 'select':
          await page.locator(action.selector).selectOption(action.value);
          break;
        case 'hover':
          await page.locator(action.selector).hover();
          break;
        case 'scroll':
          if (action.selector) {
            await page.locator(action.selector).scrollIntoViewIfNeeded();
          } else {
            await page.evaluate(({ x, y }) => window.scrollTo(x ?? 0, y ?? 0), {
              x: action.x,
              y: action.y,
            });
          }
          break;
        case 'wait':
          await page.waitForTimeout(action.duration);
          break;
        case 'keypress':
          await page.keyboard.press(action.key);
          break;
      }
    }
  }

  /**
   * Handle infinite scroll patterns
   */
  private async handleInfiniteScroll(page: Page): Promise<void> {
    const iterations = this.dynamicConfig.scrollIterations ?? 3;
    const delay = this.dynamicConfig.scrollDelay ?? 1000;

    let previousHeight = await page.evaluate(() => document.body.scrollHeight);

    for (let i = 0; i < iterations; i++) {
      // Scroll to bottom
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Wait for content to load
      await page.waitForTimeout(delay);

      // Check if new content was loaded
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);

      if (currentHeight === previousHeight) {
        // No new content, stop scrolling
        break;
      }

      previousHeight = currentHeight;

      // Wait for network to stabilize
      await page.waitForLoadState('networkidle').catch(() => {
        // Ignore timeout - some pages constantly poll
      });
    }
  }

  /**
   * Setup API interception for capturing XHR/fetch responses
   */
  private async setupApiInterception(page: Page, patterns: string[]): Promise<void> {
    const responses: Record<string, unknown>[] = [];

    await page.route('**/*', (route, request) => {
      const url = request.url();
      const matches = patterns.some(pattern => url.includes(pattern));

      if (matches) {
        route.continue().then(async () => {
          const response = await request.response();
          if (response) {
            try {
              const body = await response.json();
              responses.push({ url, body, status: response.status() });
            } catch {
              // Not JSON, store text
              const text = await response.text();
              responses.push({ url, text: text.substring(0, 1000), status: response.status() });
            }
          }
        });
      } else {
        route.continue();
      }
    });

    // Store responses on page for later extraction
    await page.evaluate((data) => {
      (window as unknown as { __scrapedApiResponses: unknown }).__scrapedApiResponses = data;
    }, responses);
  }

  /**
   * Wait for multiple conditions
   */
  private async waitForConditions(page: Page, conditions: WaitCondition[]): Promise<void> {
    for (const condition of conditions) {
      await this.waitForCondition(page, condition);
    }
  }

  /**
   * Wait for a specific condition
   */
  private async waitForCondition(
    page: Page,
    condition: WaitCondition | string
  ): Promise<void> {
    const timeout = typeof condition === 'object' ? condition.timeout ?? 5000 : 5000;

    if (typeof condition === 'string') {
      // Simple selector wait
      await page.waitForSelector(condition, { timeout });
      return;
    }

    switch (condition.type) {
      case 'selector':
        await page.waitForSelector(condition.value as string, { timeout });
        break;
      case 'function':
        await page.waitForFunction(condition.value as () => boolean | Promise<boolean>, { timeout });
        break;
      case 'timeout':
        await page.waitForTimeout(condition.value as number);
        break;
      case 'response':
        await page.waitForResponse(condition.value as string, { timeout });
        break;
    }
  }

  /**
   * Extract data using defined rules
   */
  private async extractWithRules(
    page: Page,
    rules: ScrapingRule[]
  ): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const key = `field_${i}`;

      try {
        if (rule.type === 'css') {
          const locator = page.locator(rule.selector);

          if (rule.multiple) {
            const elements = await locator.all();
            const values = await Promise.all(
              elements.map(async (el) => {
                if (rule.attribute) {
                  return el.getAttribute(rule.attribute);
                }
                return el.textContent();
              })
            );
            results[key] = values.filter(Boolean);
          } else {
            const element = locator.first();
            if (rule.attribute) {
              results[key] = await element.getAttribute(rule.attribute);
            } else {
              results[key] = await element.textContent();
            }
          }
        }
      } catch (err) {
        results[key] = null;
      }
    }

    return results;
  }

  /**
   * Default extraction for dynamic content
   */
  private async extractDefault(page: Page): Promise<Record<string, unknown>> {
    return page.evaluate(() => {
      // Access intercepted API responses if available
      const apiResponses =
        (window as unknown as { __scrapedApiResponses?: unknown[] }).__scrapedApiResponses ?? [];

      // Collect React/Vue/Angular component data if available
      const frameworkData: Record<string, unknown> = {};

      // Check for React
      const reactRoot = (document.querySelector('[data-reactroot], [data-reactid]') ??
        (document.getElementById('__next') || document.getElementById('root'))) as
        | (HTMLElement & { _reactRootContainer?: unknown })
        | undefined;

      if (reactRoot?._reactRootContainer) {
        frameworkData.react = 'Detected';
      }

      // Check for Vue
      const vueRoot = document.querySelector('[data-v-app], #app') as
        | (HTMLElement & { __vue_app__?: unknown })
        | undefined;

      if (vueRoot?.__vue_app__) {
        frameworkData.vue = 'Detected';
      }

      return {
        title: document.title,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        scrollPosition: { x: window.scrollX, y: window.scrollY },
        apiResponses: apiResponses,
        framework: frameworkData,
        scripts: Array.from(document.scripts)
          .map((s) => s.src)
          .filter(Boolean),
        state: {
          // Try to capture common state containers
          redux: (window as unknown as { __REDUX_STATE__?: unknown }).__REDUX_STATE__,
          apollo: (window as unknown as { __APOLLO_STATE__?: unknown }).__APOLLO_STATE__,
          next: (window as unknown as { __NEXT_DATA__?: unknown }).__NEXT_DATA__,
          nuxt: (window as unknown as { __NUXT__?: unknown }).__NUXT__,
        },
      };
    });
  }

  async isApplicable(page: Page): Promise<boolean> {
    // Check if page uses JavaScript frameworks
    const hasFramework = await page.evaluate(() => {
      const w = window as any;
      return !!(
        w.React ||
        w.Vue ||
        w.Angular ||
        document.querySelector('[data-reactroot], [data-reactid], [data-v-app]') ||
        document.getElementById('__next') ||
        document.getElementById('app')
      );
    });

    return hasFramework;
  }

  getName(): string {
    return 'dynamic';
  }

  getDescription(): string {
    return 'Scrapes JavaScript-heavy SPAs and dynamic content';
  }
}
