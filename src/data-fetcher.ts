// ABOUTME: Downloads and parses dataset resources from URLs
// ABOUTME: Handles CSV and JSON formats with robust error handling

import fetch from 'node-fetch';
import Papa from 'papaparse';

export interface FetchedData {
  format: string;
  rows: any[];
  totalRows: number;
  columns: string[];
  error?: string;
}

export class DataFetcher {
  private readonly MAX_DOWNLOAD_SIZE = 50 * 1024 * 1024; // 50MB limit
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds

  async fetchResource(url: string, format: string): Promise<FetchedData> {
    try {
      // Download the resource with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Berlin-Open-Data-MCP-Server/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Check content length
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > this.MAX_DOWNLOAD_SIZE) {
        throw new Error(`File too large: ${contentLength} bytes (max: ${this.MAX_DOWNLOAD_SIZE})`);
      }

      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();

      // Parse based on format
      return this.parseData(text, format, contentType);
    } catch (error) {
      let errorMessage = 'Unknown error';

      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorMessage = 'Download timeout - file may be too large or server is slow';
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
          errorMessage = 'Could not connect to server - URL may be invalid';
        } else if (error.message.includes('Too large')) {
          errorMessage = error.message;
        } else {
          errorMessage = error.message;
        }
      }

      return {
        format,
        rows: [],
        totalRows: 0,
        columns: [],
        error: errorMessage,
      };
    }
  }

  private parseData(text: string, format: string, contentType: string): FetchedData {
    const formatLower = format.toLowerCase();

    // Try JSON first if format or content-type suggests it
    if (formatLower.includes('json') || contentType.includes('json')) {
      return this.parseJSON(text, format);
    }

    // Try CSV - use papaparse for robust parsing
    if (formatLower.includes('csv') || contentType.includes('csv') || contentType.includes('text')) {
      return this.parseCSV(text, format);
    }

    // Default to CSV parsing
    return this.parseCSV(text, format);
  }

  private parseJSON(text: string, format: string): FetchedData {
    try {
      const parsed = JSON.parse(text);

      // Handle different JSON structures
      let rows: any[];
      if (Array.isArray(parsed)) {
        rows = parsed;
      } else if (parsed.data && Array.isArray(parsed.data)) {
        rows = parsed.data;
      } else if (parsed.results && Array.isArray(parsed.results)) {
        rows = parsed.results;
      } else if (typeof parsed === 'object') {
        // Single object - wrap in array
        rows = [parsed];
      } else {
        throw new Error('Unexpected JSON structure');
      }

      // Extract columns from first row
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      return {
        format: 'JSON',
        rows,
        totalRows: rows.length,
        columns,
      };
    } catch (error) {
      return {
        format,
        rows: [],
        totalRows: 0,
        columns: [],
        error: `JSON parse error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private parseCSV(text: string, format: string): FetchedData {
    try {
      // Use papaparse for robust CSV parsing
      // Automatically detects delimiters, handles quotes, encoding issues, etc.
      const result = Papa.parse<any>(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false, // Keep all as strings, we'll infer types later
      });

      if (result.errors && result.errors.length > 0) {
        console.warn('CSV parsing warnings:', result.errors);
      }

      const rows = result.data;
      const columns = result.meta?.fields || [];

      return {
        format: 'CSV',
        rows,
        totalRows: rows.length,
        columns,
      };
    } catch (error) {
      return {
        format,
        rows: [],
        totalRows: 0,
        columns: [],
        error: `CSV parse error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
