import type { Page } from 'playwright';
import { BaseStrategy, type StrategyResult } from './BaseStrategy.js';
import type { ScrapingConfig, ScrapingRule, ExtractedElement } from '../types/index.js';

/**
 * Strategy for scraping static HTML content.
 * Optimized for server-rendered pages without JavaScript requirements.
 */
export class StaticStrategy extends BaseStrategy<Record<string, unknown>> {
  private rules?: ScrapingRule[];

  constructor(config: ScrapingConfig, rules?: ScrapingRule[]) {
    super(config);
    this.rules = rules;
  }

  async execute(page: Page): Promise<Record<string, unknown>> {
    await this.preProcess(page);

    if (this.rules && this.rules.length > 0) {
      return this.extractWithRules(page, this.rules);
    }

    return this.extractDefault(page);
  }

  async preProcess(page: Page): Promise<void> {
    // For static content, wait for DOM to be loaded
    await page.waitForLoadState('domcontentloaded');
    
    // Short wait for any critical rendering
    await page.waitForTimeout(500);
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
      const key = rule.selector.replace(/[^a-zA-Z0-9]/g, '_');

      try {
        if (rule.type === 'css') {
          const locator = page.locator(rule.selector);
          
          if (rule.multiple) {
            const elements = await locator.all();
            const values = await Promise.all(
              elements.map(el => this.extractValue(el, rule.attribute))
            );
            results[key] = this.applyTransform(values.filter((v): v is string => v !== null), rule.transform);
          } else {
            const element = locator.first();
            const value = await this.extractValue(element, rule.attribute);
            results[key] = this.applyTransform(value, rule.transform);
          }
        }
      } catch (err) {
        results[key] = null;
      }
    }

    return results;
  }

  /**
   * Default extraction for static content
   */
  private async extractDefault(page: Page): Promise<Record<string, unknown>> {
    return page.evaluate(() => {
      const extractMeta = () => {
        const meta: Record<string, string | null> = {};
        document.querySelectorAll('meta').forEach(el => {
          const name = el.getAttribute('name') || el.getAttribute('property');
          const content = el.getAttribute('content');
          if (name && content) {
            meta[name] = content;
          }
        });
        return meta;
      };

      const extractText = (selector: string) => {
        const elements = document.querySelectorAll(selector);
        return Array.from(elements).map(el => ({
          text: el.textContent?.trim() ?? '',
          html: el.innerHTML,
        }));
      };

      return {
        title: document.title,
        url: window.location.href,
        meta: extractMeta(),
        headings: {
          h1: extractText('h1'),
          h2: extractText('h2'),
          h3: extractText('h3'),
        },
        paragraphs: extractText('p').slice(0, 10), // Limit to first 10
        links: Array.from(document.querySelectorAll('a[href]')).map(a => ({
          text: a.textContent?.trim() ?? '',
          href: a.getAttribute('href'),
          isExternal: (a as HTMLAnchorElement).hostname !== window.location.hostname,
        })),
        images: Array.from(document.querySelectorAll('img')).map(img => ({
          src: img.getAttribute('src'),
          alt: img.getAttribute('alt'),
          width: img.naturalWidth,
          height: img.naturalHeight,
        })),
        structuredData: extractText('script[type="application/ld+json"]'),
      };
    });
  }

  /**
   * Extract a value from an element
   */
  private async extractValue(
    element: { getAttribute: (name: string) => Promise<string | null>; textContent: () => Promise<string | null> },
    attribute?: string | null
  ): Promise<string | null> {
    if (attribute) {
      return element.getAttribute(attribute);
    }
    return element.textContent();
  }

  /**
   * Apply transformation to value(s)
   */
  private applyTransform(
    value: string | string[] | null,
    transform?: string
  ): string | number | boolean | string[] | number[] | null {
    if (!transform || value === null) return value;

    const applySingle = (v: string): string | number | boolean => {
      switch (transform) {
        case 'trim':
          return v.trim();
        case 'number':
          return parseFloat(v.replace(/[^0-9.-]/g, '')) || 0;
        case 'boolean':
          return ['true', '1', 'yes', 'on'].includes(v.toLowerCase());
        case 'lowerCase':
          return v.toLowerCase();
        case 'upperCase':
          return v.toUpperCase();
        default:
          return v;
      }
    };

    if (Array.isArray(value)) {
      return value.map(v => applySingle(v)) as string[] | number[];
    }

    return applySingle(value);
  }

  async isApplicable(page: Page): Promise<boolean> {
    // Static strategy works for most pages
    // Can be overridden to check for specific indicators
    const html = await page.content();
    return html.length > 0;
  }

  getName(): string {
    return 'static';
  }

  getDescription(): string {
    return 'Scrapes static server-rendered HTML content';
  }
}

/**
 * Configuration for static scraping
 */
export interface StaticConfig {
  includeMetadata?: boolean;
  includeLinks?: boolean;
  includeImages?: boolean;
  maxParagraphs?: number;
  customSelectors?: ScrapingRule[];
}
