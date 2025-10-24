// ABOUTME: Downloads files from JavaScript-rendered pages using headless browser
// ABOUTME: Handles Single Page Applications that don't support direct file downloads

import puppeteer, { Browser, Page } from 'puppeteer';

export interface BrowserFetchResult {
  success: boolean;
  data?: string;
  error?: string;
}

export class BrowserFetcher {
  private browser: Browser | null = null;
  private readonly DOWNLOAD_TIMEOUT = 60000; // 60 seconds for browser operations

  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
  }

  async fetchWithBrowser(url: string): Promise<BrowserFetchResult> {
    try {
      await this.initialize();

      const page = await this.browser!.newPage();

      // Set up download interception
      const client = await page.target().createCDPSession();
      const downloadPath = '/tmp/berlin-mcp-downloads';
      await client.send('Browser.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath,
      });

      // Navigate to the URL
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: this.DOWNLOAD_TIMEOUT
      });

      // Wait a bit for any JavaScript to execute
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try to get the page content (might be the file content for CSV)
      const content = await page.content();

      await page.close();

      // Check if we got actual data or HTML
      if (content.trim().toLowerCase().startsWith('<!doctype') ||
          content.trim().toLowerCase().startsWith('<html')) {
        return {
          success: false,
          error: 'Page returned HTML - file may require manual download',
        };
      }

      return {
        success: true,
        data: content,
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // Check if Puppeteer is available
  static isAvailable(): boolean {
    try {
      require.resolve('puppeteer');
      return true;
    } catch {
      return false;
    }
  }
}
