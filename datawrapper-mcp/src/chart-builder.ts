// ABOUTME: Chart builder with smart defaults for Datawrapper visualizations
// ABOUTME: Infers chart configuration from data and generates titles, axes, and labels

import { ChartType, ChartConfig, GeoJSON } from './types.js';

export class ChartBuilder {
  /**
   * Infer chart configuration from data
   */
  inferChartConfig(data: Array<Record<string, any>> | GeoJSON, chartType: ChartType, userTitle?: string): ChartConfig {
    if (chartType === 'map') {
      return this.inferMapConfig(data as GeoJSON, userTitle);
    }

    const dataArray = data as Array<Record<string, any>>;

    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      throw new Error('Data must be a non-empty array');
    }

    const title = userTitle || this.generateTitle(dataArray);

    if (chartType === 'bar' || chartType === 'line') {
      return this.inferBarLineConfig(dataArray, chartType, title);
    }

    throw new Error(`Unsupported chart type: ${chartType}`);
  }

  /**
   * Generate title from data structure
   */
  generateTitle(data: Array<Record<string, any>>): string {
    if (data.length === 0) return 'Data Visualization';

    const firstRow = data[0];
    const columns = Object.keys(firstRow);

    if (columns.length === 0) return 'Data Visualization';

    // Use first column name as title basis
    const firstColumn = columns[0];
    return this.formatLabel(firstColumn) + ' Overview';
  }

  /**
   * Format column name as human-readable label
   */
  formatLabel(columnName: string): string {
    return columnName
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Detect column types in data
   */
  detectColumnTypes(data: Array<Record<string, any>>): Map<string, 'string' | 'number' | 'date'> {
    const types = new Map<string, 'string' | 'number' | 'date'>();

    if (data.length === 0) return types;

    const firstRow = data[0];

    for (const [key, value] of Object.entries(firstRow)) {
      if (typeof value === 'number') {
        types.set(key, 'number');
      } else if (value instanceof Date || this.isDateString(value)) {
        types.set(key, 'date');
      } else {
        types.set(key, 'string');
      }
    }

    return types;
  }

  /**
   * Check if string is a date
   */
  private isDateString(value: any): boolean {
    if (typeof value !== 'string') return false;
    const date = new Date(value);
    return !isNaN(date.getTime());
  }

  /**
   * Infer configuration for bar and line charts
   */
  private inferBarLineConfig(data: Array<Record<string, any>>, chartType: ChartType, title: string): ChartConfig {
    const columnTypes = this.detectColumnTypes(data);

    // Find first string/date column for X-axis
    let xAxis: string | undefined;
    for (const [col, type] of columnTypes.entries()) {
      if (type === 'string' || type === 'date') {
        xAxis = col;
        break;
      }
    }

    // Find all numeric columns for Y-axis
    const yAxis: string[] = [];
    for (const [col, type] of columnTypes.entries()) {
      if (type === 'number') {
        yAxis.push(col);
      }
    }

    if (yAxis.length === 0) {
      throw new Error(`Cannot create ${chartType} chart: No numeric columns found in data. Data must contain at least one numeric column for visualization.`);
    }

    // Warn if too many categories
    if (xAxis && data.length > 20) {
      console.warn(`Warning: ${data.length} categories detected. Consider grouping or filtering for better visualization.`);
    }

    return {
      title,
      xAxis,
      yAxis,
      xLabel: xAxis ? this.formatLabel(xAxis) : undefined,
      yLabel: yAxis.length === 1 ? this.formatLabel(yAxis[0]) : 'Value',
      series: yAxis.map(col => this.formatLabel(col))
    };
  }

  /**
   * Infer configuration for maps
   */
  private inferMapConfig(geojson: GeoJSON, userTitle?: string): ChartConfig {
    // Validate GeoJSON structure
    if (!geojson.type || geojson.type !== 'FeatureCollection') {
      throw new Error('Invalid GeoJSON: Missing \'type\' field or not a FeatureCollection. Maps require GeoJSON FeatureCollection format.');
    }

    if (!geojson.features || !Array.isArray(geojson.features)) {
      throw new Error('Invalid GeoJSON: Missing \'features\' array. Maps require GeoJSON FeatureCollection format.');
    }

    if (geojson.features.length === 0) {
      throw new Error('Cannot create visualization: GeoJSON FeatureCollection is empty. Please provide at least one feature.');
    }

    // Validate that features have geometry
    for (const feature of geojson.features) {
      if (!feature.geometry) {
        throw new Error('Invalid GeoJSON: Feature missing geometry object.');
      }
    }

    const title = userTitle || 'Map Visualization';
    const mapType = this.detectMapType(geojson);
    const bbox = this.calculateBoundingBox(geojson);

    return {
      title,
      mapType,
      bbox
    };
  }

  /**
   * Detect appropriate map type from GeoJSON
   */
  private detectMapType(geojson: GeoJSON): 'd3-maps-choropleth' | 'd3-maps-symbols' | 'locator-map' {
    if (geojson.features.length === 0) {
      return 'locator-map';
    }

    const firstFeature = geojson.features[0];
    const geometryType = firstFeature.geometry.type;
    const hasNumericProperties = firstFeature.properties &&
      Object.values(firstFeature.properties).some(val => typeof val === 'number');

    // Choropleth: Polygon/MultiPolygon with numeric properties
    if ((geometryType === 'Polygon' || geometryType === 'MultiPolygon') && hasNumericProperties) {
      return 'd3-maps-choropleth';
    }

    // Symbol map: Point with numeric properties
    if (geometryType === 'Point' && hasNumericProperties) {
      return 'd3-maps-symbols';
    }

    // Locator map: Points without numeric properties, or any other geometry
    return 'locator-map';
  }

  /**
   * Calculate bounding box from GeoJSON features
   */
  private calculateBoundingBox(geojson: GeoJSON): { minLon: number; maxLon: number; minLat: number; maxLat: number } {
    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    for (const feature of geojson.features) {
      const coords = this.extractCoordinates(feature.geometry);

      for (const [lon, lat] of coords) {
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }

    return { minLon, maxLon, minLat, maxLat };
  }

  /**
   * Extract all coordinates from a geometry object
   */
  private extractCoordinates(geometry: any): Array<[number, number]> {
    const coords: Array<[number, number]> = [];

    const flatten = (arr: any): void => {
      if (Array.isArray(arr)) {
        if (arr.length === 2 && typeof arr[0] === 'number' && typeof arr[1] === 'number') {
          coords.push([arr[0], arr[1]]);
        } else {
          arr.forEach(flatten);
        }
      }
    };

    if (geometry.coordinates) {
      flatten(geometry.coordinates);
    }

    return coords;
  }

  /**
   * Strip unnecessary properties from GeoJSON to reduce token usage
   */
  stripGeoJSONProperties(geojson: GeoJSON, mapType: string): GeoJSON {
    const strippedFeatures = geojson.features.map(feature => {
      if (!feature.properties) {
        return feature;
      }

      let keptProperties: Record<string, any> = {};

      if (mapType === 'locator-map') {
        // Locator map: Keep only name/label properties
        const nameKeys = ['name', 'title', 'label', 'Name', 'Title'];
        for (const key of nameKeys) {
          if (feature.properties[key]) {
            keptProperties.name = feature.properties[key];
            break;
          }
        }
      } else if (mapType === 'd3-maps-symbols' || mapType === 'd3-maps-choropleth') {
        // Symbol/Choropleth: Keep numeric properties + name
        const nameKeys = ['name', 'title', 'label', 'Name', 'Title'];
        for (const key of nameKeys) {
          if (feature.properties[key]) {
            keptProperties.name = feature.properties[key];
            break;
          }
        }

        // Keep all numeric properties
        for (const [key, value] of Object.entries(feature.properties)) {
          if (typeof value === 'number') {
            keptProperties[key] = value;
          }
        }
      }

      return {
        ...feature,
        properties: keptProperties
      };
    });

    return {
      type: 'FeatureCollection',
      features: strippedFeatures
    };
  }

  /**
   * Get a sample feature from GeoJSON for preview
   */
  getSampleFeature(geojson: GeoJSON): any {
    if (geojson.features.length === 0) {
      return null;
    }
    return geojson.features[0];
  }

  /**
   * Convert data to CSV format for Datawrapper
   */
  formatForDatawrapper(data: Array<Record<string, any>>): string {
    if (data.length === 0) return '';

    const columns = Object.keys(data[0]);
    const header = columns.join(',');

    const rows = data.map(row => {
      return columns.map(col => {
        const value = row[col];
        if (value === null || value === undefined) return '';

        // Escape values containing commas or quotes
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',');
    });

    return [header, ...rows].join('\n');
  }

  /**
   * Process GeoJSON for Datawrapper map
   */
  processGeoJSON(geojson: GeoJSON): string {
    // Datawrapper accepts GeoJSON as is
    return JSON.stringify(geojson);
  }

  /**
   * Validate data before creating visualization
   */
  validateData(data: Array<Record<string, any>> | GeoJSON, chartType: ChartType): void {
    // Check for empty data
    if (chartType === 'map') {
      const geojson = data as GeoJSON;
      if (!geojson.features || geojson.features.length === 0) {
        throw new Error('Cannot create visualization: Data array is empty. Please provide at least one row of data.');
      }
      if (geojson.features.length > 10000) {
        throw new Error(`Data exceeds Datawrapper limit of 10,000 rows (provided: ${geojson.features.length}). Please filter or aggregate the data before visualization.`);
      }
    } else {
      const dataArray = data as Array<Record<string, any>>;
      if (!Array.isArray(dataArray) || dataArray.length === 0) {
        throw new Error('Cannot create visualization: Data array is empty. Please provide at least one row of data.');
      }
      if (dataArray.length > 10000) {
        throw new Error(`Data exceeds Datawrapper limit of 10,000 rows (provided: ${dataArray.length}). Please filter or aggregate the data before visualization.`);
      }
    }
  }
}
