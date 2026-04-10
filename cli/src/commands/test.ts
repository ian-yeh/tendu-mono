import { Command } from 'commander';
import * as p from '@clack/prompts';
import color from 'picocolors';
import { Scraper, BrowserPool } from '../scraper/index.js';
import type { ScrapingRule } from '../scraper/index.js';

export const testCommand = new Command()
  .name('test')
  .description('Run a prompt-driven, one-off test against a URL')
  .argument('<url>', 'The URL to test')
  .action(async (url: string) => {
    p.intro(color.bgCyan(color.black(' Tendu Test Scraper ')));

    // Basic URL validation
    let targetUrl = url;
    try {
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = `https://${targetUrl}`;
      }
      new URL(targetUrl); // Throws if invalid
    } catch (e) {
      p.log.error(`Invalid URL provided: ${color.red(url)}`);
      p.outro('Test aborted.');
      return;
    }

    const s = p.spinner();
    s.start(`Initializing scraper for ${color.cyan(targetUrl)}...`);

    const pool = new BrowserPool({ maxBrowsers: 1, maxPagesPerBrowser: 1 });
    const scraper = new Scraper(pool);

    try {
      s.message('Scraping basic information (title, headings, paragraphs, buttons)...');

      const rules: ScrapingRule[] = [
        {
          selector: 'h1, h2, h3',
          type: 'css',
          multiple: true,
          transform: 'trim',
        },
        {
          selector: 'p',
          type: 'css',
          multiple: true,
          transform: 'trim',
        },
        {
          selector: 'button, a[role="button"], input[type="button"], input[type="submit"]',
          type: 'css',
          multiple: true,
          transform: 'trim',
        }
      ];

      const result = await scraper.scrapeWithRules(
        { url: targetUrl, timeout: 30000, headless: true },
        rules
      );

      s.stop('Scraping completed.');

      if (!result.success) {
        p.log.error(`Scraping failed: ${result.error}`);
      } else {
        const data = result.data as Record<string, string[]>;
        p.log.success('Successfully scraped website information:');
        
        // Print basic info
        p.log.step(`Title: ${color.green(result.pageTitle || 'N/A')}`);
        
        // The rule keys will be extracted_0 (headings), extracted_1 (paragraphs), extracted_2 (buttons)
        const headings = (data['extracted_0'] || []).filter(Boolean).slice(0, 5);
        const paragraphs = (data['extracted_1'] || []).filter(Boolean).slice(0, 3);
        const buttons = (data['extracted_2'] || []).filter(Boolean).slice(0, 5);

        if (headings.length > 0) {
          p.log.info(color.bold('Top Headings:'));
          headings.forEach(h => p.log.message(`- ${h}`));
        }

        if (paragraphs.length > 0) {
          p.log.info(color.bold('Sample Paragraphs:'));
          paragraphs.forEach(paragraph => p.log.message(`- ${paragraph.length > 100 ? paragraph.substring(0, 100) + '...' : paragraph}`));
        }

        if (buttons.length > 0) {
          p.log.info(color.bold('Buttons/Actions:'));
          buttons.forEach(b => p.log.message(`- [${b}]`));
        }

        p.log.info(`Duration: ${color.yellow(`${result.duration}ms`)}`);
      }
    } catch (error) {
      s.stop('Scraping failed.');
      p.log.error(`An unexpected error occurred: ${(error as Error).message}`);
    } finally {
      await scraper.dispose();
      p.outro('Test complete.');
    }
  });
