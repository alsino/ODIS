// ABOUTME: Tests for MCP tool schema and handler integration
// ABOUTME: Verifies create_visualization tool accepts all chart types and variants

import { describe, it, expect } from 'vitest';
import { ChartBuilder } from '../chart-builder.js';
import { ChartType, ChartVariant } from '../types.js';

// Test the expected chart types and variants
const ALL_CHART_TYPES: ChartType[] = [
  'bar', 'column', 'line', 'area', 'scatter', 'dot',
  'range', 'arrow', 'pie', 'donut', 'election-donut',
  'table', 'map'
];

const ALL_VARIANTS: ChartVariant[] = ['basic', 'stacked', 'grouped', 'split'];

describe('MCP Tool Schema Requirements', () => {
  const builder = new ChartBuilder();

  describe('chart_type coverage', () => {
    it.each(ALL_CHART_TYPES)('supports chart_type "%s"', (chartType) => {
      // Each chart type should map to a valid Datawrapper type
      // Skip 'map' as it uses map_type instead
      if (chartType === 'map') return;

      const dwType = builder.getDatawrapperType(chartType);
      expect(dwType).toBeTruthy();
      expect(typeof dwType).toBe('string');
    });
  });

  describe('variant support', () => {
    it('bar supports basic, stacked, and split variants', () => {
      expect(builder.getDatawrapperType('bar', 'basic')).toBe('d3-bars');
      expect(builder.getDatawrapperType('bar', 'stacked')).toBe('d3-bars-stacked');
      expect(builder.getDatawrapperType('bar', 'split')).toBe('d3-bars-split');
    });

    it('column supports basic, grouped, and stacked variants', () => {
      expect(builder.getDatawrapperType('column', 'basic')).toBe('column-chart');
      expect(builder.getDatawrapperType('column', 'grouped')).toBe('grouped-column-chart');
      expect(builder.getDatawrapperType('column', 'stacked')).toBe('stacked-column-chart');
    });

    it('other chart types only support basic variant', () => {
      const singleVariantTypes: ChartType[] = [
        'line', 'area', 'scatter', 'dot', 'range', 'arrow',
        'pie', 'donut', 'election-donut', 'table'
      ];

      for (const chartType of singleVariantTypes) {
        // Should work with basic or no variant
        expect(builder.getDatawrapperType(chartType)).toBeTruthy();
        expect(builder.getDatawrapperType(chartType, 'basic')).toBeTruthy();

        // Should throw for non-basic variants
        expect(() => builder.getDatawrapperType(chartType, 'stacked')).toThrow();
      }
    });
  });
});

describe('Handler Validation Integration', () => {
  const builder = new ChartBuilder();

  describe('validates data before chart creation', () => {
    it('rejects scatter plot with insufficient numeric columns', () => {
      const data = [{ name: 'A', value: 10 }];
      const result = builder.validateDataForChartType(data, 'scatter');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('2 numeric columns');
    });

    it('accepts scatter plot with 2+ numeric columns', () => {
      const data = [{ x: 10, y: 20, label: 'Point A' }];
      const result = builder.validateDataForChartType(data, 'scatter');
      expect(result.valid).toBe(true);
    });

    it('rejects stacked bar with insufficient numeric columns', () => {
      const data = [{ category: 'A', value: 10 }];
      const result = builder.validateDataForChartType(data, 'bar', 'stacked');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('2+ numeric columns');
    });

    it('accepts stacked bar with 2+ numeric columns', () => {
      const data = [{ category: 'A', val1: 10, val2: 20 }];
      const result = builder.validateDataForChartType(data, 'bar', 'stacked');
      expect(result.valid).toBe(true);
    });

    it('rejects split bar without exactly 2 numeric columns', () => {
      const data = [{ category: 'A', value: 10 }];
      const result = builder.validateDataForChartType(data, 'bar', 'split');
      expect(result.valid).toBe(false);
    });

    it('rejects pie chart without categorical column', () => {
      const data = [{ val1: 10, val2: 20 }];
      const result = builder.validateDataForChartType(data, 'pie');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('categorical');
    });

    it('accepts pie chart with categorical and numeric columns', () => {
      const data = [{ party: 'SPD', votes: 100 }];
      const result = builder.validateDataForChartType(data, 'pie');
      expect(result.valid).toBe(true);
    });

    it('accepts any data for table', () => {
      const data = [{ anything: 'goes' }];
      const result = builder.validateDataForChartType(data, 'table');
      expect(result.valid).toBe(true);
    });
  });
});
