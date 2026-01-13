// ABOUTME: TypeScript type definitions for Masterportal MCP server
// ABOUTME: Includes interfaces for layers, portal config, and session state

export interface LayerStyle {
  color?: string;
  opacity?: number;
  icon?: string;
}

export interface Layer {
  id: string;
  name: string;
  type: 'geojson' | 'wfs';
  data?: string;  // Inline GeoJSON string
  url?: string;   // URL to GeoJSON or WFS endpoint
  style?: LayerStyle;
  // Resolved data (fetched from URL or parsed from inline)
  resolvedData?: GeoJSON;
}

export interface MapConfig {
  title: string;
  center: [number, number];  // [lon, lat]
  zoom: number;
  basemapUrl?: string;  // Custom WMS basemap URL
}

export interface PortalSession {
  id: string;
  layers: Layer[];
  mapConfig: MapConfig;
  createdAt: Date;
  lastAccessedAt: Date;
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

export interface AddLayerParams {
  id: string;
  name: string;
  type: 'geojson' | 'wfs';
  data?: string;
  url?: string;
  style?: LayerStyle;
}

export interface ConfigureMapParams {
  title: string;
  center?: [number, number];
  zoom?: number;
  basemap_url?: string;
}

export interface GeneratePortalParams {
  filename?: string;
}

export interface GeneratePortalResult {
  download_url: string;
  expires_at: string;
  layers_count: number;
  filename: string;
}

export interface DownloadFile {
  filename: string;
  path: string;
  createdAt: Date;
  expiresAt: Date;
}
