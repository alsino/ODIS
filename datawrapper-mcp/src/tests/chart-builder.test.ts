// ABOUTME: Tests for chart-builder functionality
// ABOUTME: Tests data validation, type mapping, and config inference for all chart types

import { describe, it, expect } from 'vitest';
import { ChartBuilder } from '../chart-builder.js';

describe('ChartBuilder', () => {
  const builder = new ChartBuilder();

  describe('getDatawrapperType', () => {
    it('maps bar + basic to d3-bars', () => {
      expect(builder.getDatawrapperType('bar', 'basic')).toBe('d3-bars');
    });

    it('maps bar + stacked to d3-bars-stacked', () => {
      expect(builder.getDatawrapperType('bar', 'stacked')).toBe('d3-bars-stacked');
    });

    it('maps bar + split to d3-bars-split', () => {
      expect(builder.getDatawrapperType('bar', 'split')).toBe('d3-bars-split');
    });

    it('maps column + basic to column-chart', () => {
      expect(builder.getDatawrapperType('column', 'basic')).toBe('column-chart');
    });

    it('maps column + grouped to grouped-column-chart', () => {
      expect(builder.getDatawrapperType('column', 'grouped')).toBe('grouped-column-chart');
    });

    it('maps column + stacked to stacked-column-chart', () => {
      expect(builder.getDatawrapperType('column', 'stacked')).toBe('stacked-column-chart');
    });

    it('maps line to d3-lines', () => {
      expect(builder.getDatawrapperType('line')).toBe('d3-lines');
    });

    it('maps area to d3-area', () => {
      expect(builder.getDatawrapperType('area')).toBe('d3-area');
    });

    it('maps scatter to d3-scatter-plot', () => {
      expect(builder.getDatawrapperType('scatter')).toBe('d3-scatter-plot');
    });

    it('maps dot to d3-dot-plot', () => {
      expect(builder.getDatawrapperType('dot')).toBe('d3-dot-plot');
    });

    it('maps range to d3-range-plot', () => {
      expect(builder.getDatawrapperType('range')).toBe('d3-range-plot');
    });

    it('maps arrow to d3-arrow-plot', () => {
      expect(builder.getDatawrapperType('arrow')).toBe('d3-arrow-plot');
    });

    it('maps pie to d3-pies', () => {
      expect(builder.getDatawrapperType('pie')).toBe('d3-pies');
    });

    it('maps donut to d3-donuts', () => {
      expect(builder.getDatawrapperType('donut')).toBe('d3-donuts');
    });

    it('maps election-donut to election-donut-chart', () => {
      expect(builder.getDatawrapperType('election-donut')).toBe('election-donut-chart');
    });

    it('maps table to tables', () => {
      expect(builder.getDatawrapperType('table')).toBe('tables');
    });

    it('defaults to basic variant when not specified', () => {
      expect(builder.getDatawrapperType('bar')).toBe('d3-bars');
    });

    it('throws for invalid variant', () => {
      expect(() => builder.getDatawrapperType('bar', 'invalid' as any)).toThrow();
    });
  });

  describe('validateDataForChartType', () => {
    describe('scatter plot', () => {
      it('requires at least 2 numeric columns', () => {
        const data = [{ name: 'A', value: 10 }];
        const result = builder.validateDataForChartType(data, 'scatter');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('scatter plot');
        expect(result.error).toContain('2 numeric columns');
      });

      it('passes with 2 numeric columns', () => {
        const data = [{ x: 10, y: 20 }];
        const result = builder.validateDataForChartType(data, 'scatter');
        expect(result.valid).toBe(true);
      });
    });

    describe('stacked bar', () => {
      it('requires 2+ numeric columns', () => {
        const data = [{ category: 'A', value: 10 }];
        const result = builder.validateDataForChartType(data, 'bar', 'stacked');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('stacked');
        expect(result.error).toContain('2+ numeric columns');
      });

      it('passes with 2 numeric columns', () => {
        const data = [{ category: 'A', val1: 10, val2: 20 }];
        const result = builder.validateDataForChartType(data, 'bar', 'stacked');
        expect(result.valid).toBe(true);
      });
    });

    describe('split bar', () => {
      it('requires exactly 2 numeric columns', () => {
        const data = [{ category: 'A', value: 10 }];
        const result = builder.validateDataForChartType(data, 'bar', 'split');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('split');
        expect(result.error).toContain('2 numeric columns');
      });

      it('fails with 3 numeric columns', () => {
        const data = [{ category: 'A', val1: 10, val2: 20, val3: 30 }];
        const result = builder.validateDataForChartType(data, 'bar', 'split');
        expect(result.valid).toBe(false);
      });

      it('passes with exactly 2 numeric columns', () => {
        const data = [{ category: 'A', left: 10, right: 20 }];
        const result = builder.validateDataForChartType(data, 'bar', 'split');
        expect(result.valid).toBe(true);
      });
    });

    describe('range plot', () => {
      it('requires at least 2 numeric columns', () => {
        const data = [{ category: 'A', value: 10 }];
        const result = builder.validateDataForChartType(data, 'range');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('range plot');
      });

      it('passes with 2 numeric columns', () => {
        const data = [{ category: 'A', start: 10, end: 20 }];
        const result = builder.validateDataForChartType(data, 'range');
        expect(result.valid).toBe(true);
      });
    });

    describe('arrow plot', () => {
      it('requires at least 2 numeric columns', () => {
        const data = [{ category: 'A', value: 10 }];
        const result = builder.validateDataForChartType(data, 'arrow');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('arrow plot');
      });

      it('passes with 2 numeric columns', () => {
        const data = [{ category: 'A', from: 10, to: 20 }];
        const result = builder.validateDataForChartType(data, 'arrow');
        expect(result.valid).toBe(true);
      });
    });

    describe('pie/donut', () => {
      it('requires at least 1 numeric column', () => {
        const data = [{ name: 'A', label: 'Label' }];
        const result = builder.validateDataForChartType(data, 'pie');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('pie');
      });

      it('requires at least 1 categorical column', () => {
        const data = [{ val1: 10, val2: 20 }];
        const result = builder.validateDataForChartType(data, 'pie');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('categorical');
      });

      it('passes with 1 categorical + 1 numeric', () => {
        const data = [{ party: 'SPD', votes: 100 }];
        const result = builder.validateDataForChartType(data, 'pie');
        expect(result.valid).toBe(true);
      });
    });

    describe('table', () => {
      it('accepts any data structure', () => {
        const data = [{ anything: 'goes', here: 123 }];
        const result = builder.validateDataForChartType(data, 'table');
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('analyzeColumns', () => {
    it('identifies numeric columns', () => {
      const data = [{ name: 'A', value: 10, count: 5 }];
      const result = builder.analyzeColumns(data);
      expect(result.numeric).toContain('value');
      expect(result.numeric).toContain('count');
    });

    it('identifies categorical columns', () => {
      const data = [{ name: 'A', category: 'B', value: 10 }];
      const result = builder.analyzeColumns(data);
      expect(result.categorical).toContain('name');
      expect(result.categorical).toContain('category');
    });

    it('identifies date columns', () => {
      const data = [{ date: '2024-01-15', value: 10 }];
      const result = builder.analyzeColumns(data);
      expect(result.date).toContain('date');
    });
  });
});
