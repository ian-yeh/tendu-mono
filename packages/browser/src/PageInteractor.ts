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
      viewport: options.viewport ?? { width: 1920, height: 1080 },
    });
    return new PageInteractor(page, release);
  }

  async navigateTo(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
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
      const selectors = [
        'button', 'a', 'input[type="text"]', 'input[type="email"]',
        'input[type="password"]', 'input[type="search"]', 'textarea',
        'select', '[role="button"]', '[role="link"]', '[role="textbox"]',
        '[data-testid]', '[data-test]', '[class*="btn"]', '[class*="button"]',
      ];

      document.querySelectorAll(selectors.join(',')).forEach((el, idx) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight) {
          const text = el.textContent?.trim().substring(0, 50) || el.getAttribute('placeholder') || '';
          const type = el.tagName.toLowerCase();
          const id = el.id ? `#${el.id}` : '';
          const cls = el.className && typeof el.className === 'string' ? el.className.split(' ').slice(0, 2).join('.') : '';
          elements.push(`[${idx}] ${type}${id} ${cls}: "${text}"`);
        }
      });
      return elements.slice(0, 30);
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

  async executeAction(action: Action): Promise<void> {
    switch (action.type) {
      case 'click': {
        if (action.x == null || action.y == null) throw new Error('Click requires x,y');
        await this.page.mouse.click(action.x, action.y);
        await this.page.waitForTimeout(1000);
        break;
      }
      case 'type': {
        if (action.x == null || action.y == null || !action.text) throw new Error('Type requires x,y and text');
        await this.page.mouse.click(action.x, action.y);
        await this.page.waitForTimeout(200);
        await this.page.keyboard.type(action.text, { delay: 50 });
        await this.page.keyboard.press('Enter');
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
        await this.page.goto(action.url, { waitUntil: 'networkidle' });
        break;
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
