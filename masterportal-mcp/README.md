# Masterportal MCP Server

A Model Context Protocol (MCP) server for generating ready-to-host [Masterportal](https://www.masterportal.org/) geodata portals.

## Features

- **Layer Management**: Add multiple GeoJSON or WFS layers to your portal
- **Map Configuration**: Set title, center, zoom, and basemap
- **Complete Package**: Generates zip files with Masterportal runtime included
- **Ready to Host**: Extract and serve from any web server

## Installation

```bash
npm install
npm run build
```

### Download Masterportal Runtime

The server needs the Masterportal runtime files to bundle into generated portals:

```bash
./scripts/download-runtime.sh
```

This downloads pre-built Masterportal (v3.10.0) from the official website.

## Usage

The server implements the MCP protocol and provides three tools:

### Tools

1. **add_layer**: Add a geodata layer to the portal
   - Supports inline GeoJSON or URL to GeoJSON/WFS endpoint
   - Can be called multiple times for multiple layers
   - Optional styling (color, opacity)

2. **configure_map**: Set portal metadata and map defaults
   - Title, center coordinates, zoom level
   - Custom WMS basemap URL (default: OpenStreetMap)

3. **generate_portal**: Generate downloadable zip package
   - Bundles all layers with Masterportal runtime
   - Returns download URL

### Example Workflow

```
1. add_layer: Add GeoJSON with Berlin districts
2. add_layer: Add WFS layer with public facilities
3. configure_map: Set title "Berlin Infrastructure"
4. generate_portal: Get download URL for complete portal
```

### Running the Server

**Stdio mode** (for Claude Desktop integration):
```bash
npm start
```

**HTTP mode** (for remote access):
```bash
npm run start:http
```

The HTTP server exposes:
- `/mcp` - MCP endpoint (Streamable HTTP transport)
- `/downloads/:filename` - Download generated zip files
- `/health` - Health check endpoint

## Generated Portal Structure

```
portal.zip
├── index.html           # Entry point
├── config.js            # Masterportal config
├── config.json          # Layer and UI config
├── resources/
│   ├── services.json    # Layer service definitions
│   ├── rest-services.json
│   └── style.json       # Layer styling
├── data/
│   └── *.geojson        # Embedded layer data
└── mastercode/          # Masterportal runtime
    ├── js/masterportal.js
    ├── css/
    ├── img/
    └── locales/
```

## Deployment

### Railway

The server is configured for Railway deployment:

```bash
# Railway will use the Dockerfile automatically
# Set PORT environment variable (default: 8080)
```

### Docker

```bash
docker build -t masterportal-mcp .
docker run -p 8080:8080 masterportal-mcp
```

## API Reference

### add_layer

```json
{
  "name": "add_layer",
  "arguments": {
    "id": "districts",
    "name": "Berlin Districts",
    "type": "geojson",
    "data": { "type": "FeatureCollection", "features": [...] },
    "style": { "color": "#ff0000", "opacity": 0.7 }
  }
}
```

Or with URL:
```json
{
  "arguments": {
    "id": "facilities",
    "name": "Public Facilities",
    "type": "wfs",
    "url": "https://example.com/wfs?service=WFS&request=GetFeature&typeName=facilities"
  }
}
```

### configure_map

```json
{
  "name": "configure_map",
  "arguments": {
    "title": "My Berlin Portal",
    "center": [13.4, 52.52],
    "zoom": 11,
    "basemap_url": "https://example.com/wms"
  }
}
```

### generate_portal

```json
{
  "name": "generate_portal",
  "arguments": {
    "filename": "berlin-portal"
  }
}
```

Returns download URL for the generated zip file.

## Development

```bash
npm run dev      # Development mode with tsx
npm run dev:http # HTTP server in development mode
npm run build    # Production build
```

## License

MIT
