// ABOUTME: Datawrapper API client for chart creation and management
// ABOUTME: Handles authentication, chart creation, data upload, and publishing

import axios, { AxiosInstance } from 'axios';
import { DatawrapperChart, DatawrapperChartMetadata } from './types.js';

export class DatawrapperClient {
  private client: AxiosInstance;

  constructor(apiToken: string) {
    this.client = axios.create({
      baseURL: 'https://api.datawrapper.de/v3',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Create an empty chart with specified type and metadata
   */
  async createChart(type: string, metadata?: DatawrapperChartMetadata): Promise<DatawrapperChart> {
    try {
      const response = await this.client.post('/charts', {
        type,
        metadata: metadata || {}
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Datawrapper authentication failed. Please check your API token.');
      }
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a few moments.');
      }
      throw new Error(`Failed to create chart: ${error.message}`);
    }
  }

  /**
   * Upload data to an existing chart
   */
  async uploadData(chartId: string, data: string): Promise<void> {
    try {
      await this.client.put(`/charts/${chartId}/data`, data, {
        headers: {
          'Content-Type': 'text/csv'
        }
      });
    } catch (error: any) {
      throw new Error(`Failed to upload data: ${error.message}`);
    }
  }

  /**
   * Update chart metadata
   */
  async updateMetadata(chartId: string, metadata: DatawrapperChartMetadata): Promise<DatawrapperChart> {
    try {
      const response = await this.client.patch(`/charts/${chartId}`, {
        metadata
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to update metadata: ${error.message}`);
    }
  }

  /**
   * Publish a chart publicly
   */
  async publishChart(chartId: string): Promise<DatawrapperChart> {
    try {
      const response = await this.client.post(`/charts/${chartId}/publish`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to publish chart: ${error.message}`);
    }
  }

  /**
   * Get chart information including URLs
   */
  async getChartInfo(chartId: string): Promise<DatawrapperChart> {
    try {
      const response = await this.client.get(`/charts/${chartId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get chart info: ${error.message}`);
    }
  }

  /**
   * Get embed code for a published chart
   */
  getEmbedCode(publicId: string, width: number = 600, height: number = 400): string {
    return `<iframe src="https://datawrapper.dwcdn.net/${publicId}/" scrolling="no" width="${width}" height="${height}" frameborder="0" style="border:none;" allowfullscreen></iframe>`;
  }

  /**
   * Get public URL for a published chart
   */
  getPublicUrl(publicId: string): string {
    return `https://datawrapper.dwcdn.net/${publicId}/`;
  }

  /**
   * Get edit URL for a chart
   */
  getEditUrl(chartId: string): string {
    return `https://app.datawrapper.de/chart/${chartId}/visualize`;
  }
}
