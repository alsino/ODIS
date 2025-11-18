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
    let page: Page | null = null;

    try {
      await this.initialize();

      page = await this.browser!.newPage();

      // Strategy: Capture the download URL from network traffic, then fetch it directly
      let downloadUrl: string | null = null;
      const downloadUrlPromise = new Promise<string | null>((resolve) => {
        let resolved = false;

        page!.on('response', async (response) => {
          if (resolved) return;

          const responseUrl = response.url();

          // Look for the actual CSV download URL from the download subdomain
          if (responseUrl.includes('download.statistik-berlin-brandenburg.de') &&
              responseUrl.endsWith('.csv') &&
              response.status() === 200) {
            resolved = true;
            resolve(responseUrl);
          }
        });

        // Timeout after waiting period
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve(null);
          }
        }, 20000);
      });

      // Navigate to the URL to trigger the SPA
      try {
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: this.DOWNLOAD_TIMEOUT
        });
      } catch (navError) {
        // Navigation might timeout, but we may have captured the download URL
      }

      // Wait for download URL to be captured
      downloadUrl = await downloadUrlPromise;

      await page.close();
      page = null;

      // If we found the download URL, fetch it directly
      if (downloadUrl) {
        try {
          const fetch = (await import('node-fetch')).default;
          const response = await fetch(downloadUrl);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const text = await response.text();

          // Verify it's CSV data
          const trimmed = text.trim();
          if (!trimmed.toLowerCase().startsWith('<!doctype') &&
              !trimmed.toLowerCase().startsWith('<html') &&
              trimmed.length > 0 &&
              (trimmed.includes(',') || trimmed.includes(';'))) {
            return {
              success: true,
              data: text,
            };
          }
        } catch (fetchError) {
          return {
            success: false,
            error: `Found download URL but could not fetch: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
          };
        }
      }

      return {
        success: false,
        error: 'Could not capture download URL from JavaScript-rendered page.',
      };

    } catch (error) {
      if (page) {
        try {
          await page.close();
        } catch (closeError) {
          // Ignore close errors
        }
      }

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
      // In ES module context, try importing to check availability
      // We check if the module can be resolved without actually importing
      import.meta.resolve?.('puppeteer');
      return true;
    } catch {
      // Fallback: puppeteer is a dependency, so if we got here, it's available
      // The import at the top of this file would have failed if puppeteer wasn't installed
      return true;
    }
  }
}
