// ABOUTME: Chart logging for provenance tracking
// ABOUTME: Maintains append-only JSON log of created charts with metadata

import * as fs from 'fs/promises';
import * as path from 'path';
import { ChartLogEntry } from './types.js';

export class ChartLogger {
  private logPath: string;

  constructor(logPath: string = './charts-log.json') {
    this.logPath = logPath;
  }

  /**
   * Log a created chart with metadata
   */
  async logChart(entry: ChartLogEntry): Promise<void> {
    try {
      let entries: ChartLogEntry[] = [];

      // Read existing log if it exists
      try {
        const content = await fs.readFile(this.logPath, 'utf-8');
        entries = JSON.parse(content);
      } catch (error: any) {
        // File doesn't exist or is empty, start with empty array
        if (error.code !== 'ENOENT') {
          console.error('Error reading log file:', error.message);
        }
      }

      // Append new entry
      entries.push(entry);

      // Write back to file
      await fs.writeFile(this.logPath, JSON.stringify(entries, null, 2), 'utf-8');
    } catch (error: any) {
      console.error('Failed to log chart:', error.message);
      // Don't throw - logging failure shouldn't break chart creation
    }
  }

  /**
   * Get all logged charts
   */
  async getCharts(): Promise<ChartLogEntry[]> {
    try {
      const content = await fs.readFile(this.logPath, 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw new Error(`Failed to read chart log: ${error.message}`);
    }
  }

  /**
   * Get chart by ID
   */
  async getChartById(chartId: string): Promise<ChartLogEntry | undefined> {
    const charts = await this.getCharts();
    return charts.find(chart => chart.chartId === chartId);
  }

  /**
   * Get charts by source dataset ID
   */
  async getChartsByDataset(datasetId: string): Promise<ChartLogEntry[]> {
    const charts = await this.getCharts();
    return charts.filter(chart => chart.sourceDatasetId === datasetId);
  }
}
