// ABOUTME: Generates smart samples and statistics from dataset rows
// ABOUTME: Prevents context overflow by limiting data size

export interface ColumnStats {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'date' | 'unknown';
  uniqueCount: number;
  nullCount: number;
  sampleValues: any[];
  min?: number;
  max?: number;
}

export interface DataSample {
  sampleRows: any[];
  totalRows: number;
  isTruncated: boolean;
  columns: ColumnStats[];
  summary: string;
}

export class DataSampler {
  private readonly DEFAULT_SAMPLE_SIZE = 100;

  generateSample(rows: any[], columns: string[], sampleSize?: number): DataSample {
    const size = sampleSize || this.DEFAULT_SAMPLE_SIZE;
    const isTruncated = rows.length > size;
    const sampleRows = rows.slice(0, size);

    // Generate column statistics
    const columnStats = columns.map(colName => this.analyzeColumn(colName, rows));

    // Generate summary text
    const summary = this.generateSummary(rows.length, columns.length, isTruncated, columnStats);

    return {
      sampleRows,
      totalRows: rows.length,
      isTruncated,
      columns: columnStats,
      summary,
    };
  }

  private analyzeColumn(columnName: string, rows: any[]): ColumnStats {
    const values = rows.map(row => row[columnName]);
    const nonNullValues = values.filter(v => v != null && v !== '');

    // Infer type
    const type = this.inferType(nonNullValues);

    // Count unique values (limit to first 1000 rows for performance)
    const uniqueValues = new Set(nonNullValues.slice(0, 1000));

    // Get sample values (first 5 unique)
    const sampleValues = Array.from(uniqueValues).slice(0, 5);

    const stats: ColumnStats = {
      name: columnName,
      type,
      uniqueCount: uniqueValues.size,
      nullCount: values.length - nonNullValues.length,
      sampleValues,
    };

    // For numeric columns, calculate min/max
    if (type === 'number') {
      const numbers = nonNullValues.map(v => parseFloat(v)).filter(n => !isNaN(n));
      if (numbers.length > 0) {
        stats.min = Math.min(...numbers);
        stats.max = Math.max(...numbers);
      }
    }

    return stats;
  }

  private inferType(values: any[]): 'number' | 'string' | 'boolean' | 'date' | 'unknown' {
    if (values.length === 0) return 'unknown';

    // Sample first 100 non-null values
    const sample = values.slice(0, 100);

    // Check if all are numbers
    const numericCount = sample.filter(v => !isNaN(parseFloat(v)) && isFinite(v)).length;
    if (numericCount / sample.length > 0.8) return 'number';

    // Check if all are booleans
    const boolCount = sample.filter(v =>
      v === true || v === false || v === 'true' || v === 'false' || v === '0' || v === '1'
    ).length;
    if (boolCount / sample.length > 0.8) return 'boolean';

    // Check if looks like dates
    const dateCount = sample.filter(v => {
      const str = String(v);
      return /^\d{4}-\d{2}-\d{2}/.test(str) || /^\d{2}\/\d{2}\/\d{4}/.test(str);
    }).length;
    if (dateCount / sample.length > 0.8) return 'date';

    return 'string';
  }

  private generateSummary(totalRows: number, totalColumns: number, isTruncated: boolean, columns: ColumnStats[]): string {
    let summary = `Dataset contains ${totalRows} rows and ${totalColumns} columns.\n\n`;

    if (isTruncated) {
      summary += `⚠️ Sample limited to first ${this.DEFAULT_SAMPLE_SIZE} rows to prevent context overflow.\n\n`;
    }

    summary += '**Columns:**\n';
    columns.forEach(col => {
      summary += `- **${col.name}** (${col.type})`;
      if (col.type === 'number' && col.min !== undefined && col.max !== undefined) {
        summary += ` - Range: ${col.min} to ${col.max}`;
      }
      if (col.uniqueCount > 0) {
        summary += ` - ${col.uniqueCount} unique values`;
      }
      if (col.nullCount > 0) {
        summary += ` - ${col.nullCount} nulls`;
      }
      summary += '\n';
    });

    return summary;
  }
}
