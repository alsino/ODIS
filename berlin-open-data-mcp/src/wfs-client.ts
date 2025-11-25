// ABOUTME: WFS (Web Feature Service) client implementing OGC WFS 2.0.0 protocol
// ABOUTME: Handles GetCapabilities and GetFeature requests for Berlin's gdi.berlin.de services

import fetch from 'node-fetch';
import { DOMParser } from '@xmldom/xmldom';
import type { FeatureCollection } from 'geojson';

export interface WFSCapabilities {
  featureTypes: Array<{
    name: string;
    title: string;
    abstract?: string;
  }>;
  supportedFormats: string[];
}

export interface WFSFeatureOptions {
  count?: number;
  startIndex?: number;
}

export class WFSClient {
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds

  /**
   * Parse WFS URL to extract base service URL
   * Handles both bare URLs and URLs with GetCapabilities parameters
   */
  parseWFSUrl(url: string): { baseUrl: string; hasParams: boolean } {
    try {
      const urlObj = new URL(url);

      // Check if URL has query parameters
      const hasParams = urlObj.search.length > 0;

      // Extract base URL (protocol + host + path, no query params)
      const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;

      return { baseUrl, hasParams };
    } catch (error) {
      throw new Error(`Invalid WFS URL: ${url}`);
    }
  }

  /**
   * Execute GetCapabilities request to discover available feature types
   */
  async getCapabilities(baseUrl: string): Promise<WFSCapabilities> {
    const url = `${baseUrl}?SERVICE=WFS&REQUEST=GetCapabilities`;

    try {
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

      const xml = await response.text();

      return this.parseCapabilities(xml);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw new Error('GetCapabilities request timeout - WFS service may be slow or unavailable');
        }
        throw error;
      }
      throw new Error('Unknown error during GetCapabilities request');
    }
  }

  /**
   * Parse GetCapabilities XML response
   */
  private parseCapabilities(xml: string): WFSCapabilities {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    // Check for XML parsing errors
    const parseError = doc.getElementsByTagName('parsererror');
    if (parseError.length > 0) {
      throw new Error('Invalid XML in GetCapabilities response');
    }

    // Extract feature types
    const featureTypes: WFSCapabilities['featureTypes'] = [];
    const featureTypeElements = doc.getElementsByTagName('FeatureType');

    for (let i = 0; i < featureTypeElements.length; i++) {
      const ft = featureTypeElements[i];
      const name = ft.getElementsByTagName('Name')[0]?.textContent;
      const title = ft.getElementsByTagName('Title')[0]?.textContent;
      const abstract = ft.getElementsByTagName('Abstract')[0]?.textContent;

      if (name && title) {
        featureTypes.push({
          name: name.trim(),
          title: title.trim(),
          abstract: abstract?.trim(),
        });
      }
    }

    if (featureTypes.length === 0) {
      throw new Error('No feature types found in GetCapabilities response');
    }

    // Extract supported formats
    const supportedFormats: string[] = [];
    const formatElements = doc.getElementsByTagName('outputFormat');

    for (let i = 0; i < formatElements.length; i++) {
      const format = formatElements[i].textContent;
      if (format) {
        supportedFormats.push(format.trim());
      }
    }

    return { featureTypes, supportedFormats };
  }

  /**
   * Execute GetFeature request to retrieve actual feature data as GeoJSON
   */
  async getFeatures(
    baseUrl: string,
    typeName: string,
    options: WFSFeatureOptions = {}
  ): Promise<FeatureCollection> {
    const { count = 1000, startIndex = 0 } = options;

    const url = new URL(baseUrl);
    url.searchParams.set('SERVICE', 'WFS');
    url.searchParams.set('REQUEST', 'GetFeature');
    url.searchParams.set('VERSION', '2.0.0');
    url.searchParams.set('TYPENAMES', typeName);
    url.searchParams.set('OUTPUTFORMAT', 'application/json');
    url.searchParams.set('COUNT', count.toString());
    url.searchParams.set('STARTINDEX', startIndex.toString());

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Berlin-Open-Data-MCP-Server/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';

      if (!contentType.includes('json')) {
        throw new Error(`Expected JSON response, got: ${contentType}`);
      }

      const geojson = await response.json() as FeatureCollection;

      // Validate GeoJSON structure
      if (geojson.type !== 'FeatureCollection') {
        throw new Error('Invalid GeoJSON: expected FeatureCollection');
      }

      return geojson;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw new Error('GetFeature request timeout - dataset may be very large or service is slow');
        }
        throw error;
      }
      throw new Error('Unknown error during GetFeature request');
    }
  }

  /**
   * Get total feature count without fetching all features
   */
  async getFeatureCount(baseUrl: string, typeName: string): Promise<number> {
    const url = new URL(baseUrl);
    url.searchParams.set('SERVICE', 'WFS');
    url.searchParams.set('REQUEST', 'GetFeature');
    url.searchParams.set('VERSION', '2.0.0');
    url.searchParams.set('TYPENAMES', typeName);
    url.searchParams.set('RESULTTYPE', 'hits');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Berlin-Open-Data-MCP-Server/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xml = await response.text();

      // Parse numberMatched attribute from XML response
      const match = xml.match(/numberMatched="(\d+)"/);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }

      // Fallback: try to parse as JSON (some servers return JSON even for hits)
      try {
        const json = JSON.parse(xml);
        if (json.numberMatched !== undefined) {
          return json.numberMatched;
        }
      } catch {
        // Not JSON, continue
      }

      return 0;
    } catch (error) {
      // If count fails, return 0 (non-critical - we can still fetch features)
      console.warn('Could not get feature count:', error);
      return 0;
    }
  }

  /**
   * Check if a URL looks like a WFS service URL
   */
  static isWFSUrl(url: string): boolean {
    const lower = url.toLowerCase();
    return (
      lower.includes('gdi.berlin.de/services/wfs') ||
      lower.includes('request=getcapabilities') ||
      lower.includes('service=wfs')
    );
  }
}
