// ABOUTME: TypeScript type definitions for Datawrapper MCP server
// ABOUTME: Includes interfaces for chart types, API responses, and configuration

export type ChartType = 'bar' | 'line' | 'map';
export type MapType = 'd3-maps-choropleth' | 'd3-maps-symbols';

export interface CreateVisualizationParams {
  data: Array<Record<string, any>> | GeoJSON;
  chart_type: ChartType;
  map_type?: MapType;
  title?: string;
  description?: string;
  source_dataset_id?: string;
}

export interface GeoJSON {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: {
      type: string;
      coordinates: any;
    };
    properties?: Record<string, any>;
  }>;
}

export interface DatawrapperChartMetadata {
  title?: string;
  describe?: {
    intro?: string;
    byline?: string;
  };
  visualize?: Record<string, any>;
  axes?: Record<string, any>;
}

export interface DatawrapperChart {
  id: string;
  type: string;
  title: string;
  metadata: DatawrapperChartMetadata;
  publicUrl?: string;
  publicId?: string;
}

export interface ChartLogEntry {
  chartId: string;
  url: string;
  embedCode: string;
  editUrl: string;
  chartType: ChartType;
  title: string;
  createdAt: string;
  sourceDatasetId?: string;
  sourceDatasetUrl?: string;
  dataRowCount: number;
}

export interface ChartConfig {
  title: string;
  xAxis?: string;
  yAxis?: string[];
  xLabel?: string;
  yLabel?: string;
  series?: string[];
  bbox?: {
    minLon: number;
    maxLon: number;
    minLat: number;
    maxLat: number;
  };
  basemap?: string;
}
