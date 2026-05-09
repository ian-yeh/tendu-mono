import type { Page } from 'playwright';
import { BrowserPool } from './BrowserPool.js';
import type { Action, PageContext } from '@tendo/core';
import type { PageInteractorOptions } from './types.js';

export class PageInteractor {
  private constructor(
    private page: Page,
    private releaseFn: () => Promise<void>,
  ) { }

  static async create(
    pool: BrowserPool,
    options: PageInteractorOptions = {},
  ): Promise<PageInteractor> {
    const { page, release } = await pool.acquirePage({
      headless: options.headless ?? true,
      viewport: options.viewport ?? { width: 1280, height: 720 },
    });
    await PageInteractor.blockTrackers(page);
    return new PageInteractor(page, release);
  }

  private static async blockTrackers(page: Page): Promise<void> {
    const blocked = [
      'google-analytics.com', 'googletagmanager.com', 'doubleclick.net',
      'googlesyndication.com', 'facebook.com/tr', 'connect.facebook.net',
      'hotjar.com', 'segment.io', 'mixpanel.com',
    ];
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (blocked.some((domain) => url.includes(domain))) {
        route.abort();
      } else {
        route.continue();
      }
    });
  }

  async navigateTo(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.page.waitForTimeout(1000);
  }

  async screenshot(): Promise<string> {
    const buffer = await this.page.screenshot({
      type: 'jpeg',
      quality: 80,
      fullPage: false,
    });
    return buffer.toString('base64');
  }

  async getPageInfo(): Promise<{ title: string; url: string }> {
    return {
      title: await this.page.title(),
      url: this.page.url(),
    };
  }

  async extractVisibleElements(): Promise<string[]> {
    return this.page.evaluate(() => {
      const elements: string[] = [];
      const seen = new Set<Element>();
      const selectorStr = [
        'button', 'a', 'input', 'textarea',
        'select', '[role="button"]', '[role="link"]', '[role="textbox"]',
        '[role="checkbox"]', '[role="tab"]', '[role="menuitem"]',
        '[data-testid]', '[data-test]', '[class*="btn"]', '[class*="button"]',
      ].join(',');

      const skipTags = new Set(['yt-interaction', 'yt-icon', 'yt-icon-button', 'yt-icon-shape', 'tp-yt-paper-ripple']);

      function collect(root: ParentNode): void {
        root.querySelectorAll(selectorStr).forEach((el) => {
          if (seen.has(el)) return;
          seen.add(el);
          if (skipTags.has(el.tagName.toLowerCase())) return;
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.x >= 0 && rect.top >= 0 && rect.top < window.innerHeight) {
            const text = (
              el.getAttribute('aria-label') ||
              el.textContent?.trim().substring(0, 50) ||
              el.getAttribute('placeholder') ||
              ''
            );
            const tag = el.tagName.toLowerCase();
            const id = el.id ? `#${el.id}` : '';
            const cx = Math.round(rect.x + rect.width / 2);
            const cy = Math.round(rect.y + rect.height / 2);
            elements.push(`[${elements.length}] ${tag}${id} "${text}" @ center=(${cx}, ${cy})`);
          }
        });
        // Pierce shadow roots one level at a time
        root.querySelectorAll('*').forEach((el) => {
          if ((el as HTMLElement & { shadowRoot: ShadowRoot | null }).shadowRoot) {
            collect((el as HTMLElement & { shadowRoot: ShadowRoot }).shadowRoot);
          }
        });
      }

      collect(document);
      return elements.slice(0, 40);
    });
  }

  async captureContext(): Promise<PageContext> {
    const [screenshotBase64, { title, url }, visibleElements] = await Promise.all([
      this.screenshot(),
      this.getPageInfo(),
      this.extractVisibleElements(),
    ]);
    return { screenshotBase64, pageTitle: title, currentUrl: url, visibleElements };
  }

  async executeAction(action: Action): Promise<string | undefined> {
    switch (action.type) {
      case 'click': {
        if (action.x == null || action.y == null) throw new Error('Click requires x,y');
        if (action.x === 0 && action.y === 0) throw new Error('Click coordinates (0, 0) are invalid — likely a schema default, not a real target');
        await this.page.mouse.click(action.x, action.y);
        await this.page.waitForTimeout(1000);
        break;
      }
      case 'type': {
        if (action.x == null || action.y == null || !action.text) throw new Error('Type requires x,y and text');
        if (action.x === 0 && action.y === 0) throw new Error('Type coordinates (0, 0) are invalid — likely a schema default, not a real target');
        await this.page.mouse.click(action.x, action.y);
        await this.page.waitForTimeout(200);
        await this.page.keyboard.type(action.text, { delay: 50 });
        await this.page.waitForTimeout(500);
        break;
      }
      case 'key': {
        if (!action.key) throw new Error('Key requires a key name');
        await this.page.keyboard.press(action.key);
        await this.page.waitForTimeout(1000);
        break;
      }
      case 'scroll': {
        const direction = action.direction || 'down';
        const amount = action.amount || 500;
        await this.page.evaluate(({ dir, amt }) => {
          if (dir === 'down') window.scrollBy(0, amt);
          else if (dir === 'up') window.scrollBy(0, -amt);
          else if (dir === 'right') window.scrollBy(amt, 0);
          else if (dir === 'left') window.scrollBy(-amt, 0);
        }, { dir: direction, amt: amount });
        break;
      }
      case 'wait': {
        await this.page.waitForTimeout(action.amount || 1000);
        break;
      }
      case 'navigate': {
        if (!action.url) throw new Error('Navigate requires URL');
        await this.page.goto(action.url, { waitUntil: 'domcontentloaded' });
        break;
      }
      case 'evaluate': {
        if (!action.script) throw new Error('Evaluate requires a script');
        try {
          const result = await this.page.evaluate(action.script);
          return JSON.stringify(result);
        } catch (e) {
          return JSON.stringify({ error: (e as Error).message });
        }
      }
      default: break;
    }
  }

  currentUrl(): string {
    return this.page.url();
  }

  async release(): Promise<void> {
    await this.releaseFn();
  }
}
