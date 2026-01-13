// ABOUTME: Generates Masterportal configuration files from session state
// ABOUTME: Produces config.json, config.js, services.json, and index.html

import { PortalSession } from './types.js';

const MASTERPORTAL_VERSION = '3_12_0';

export class PortalGenerator {
  generateConfigJson(session: PortalSession): string {
    const layerElements = session.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      typ: layer.type === 'geojson' ? 'GeoJSON' : 'WFS',
      visibility: true,
      showInLayerTree: true,
    }));

    const config = {
      portalConfig: {
        mainMenu: {
          title: {
            text: session.mapConfig.title,
          },
        },
        map: {
          mapView: {
            startCenter: this.lonLatToEPSG25832(session.mapConfig.center),
            startZoomLevel: session.mapConfig.zoom,
          },
          controls: {
            zoom: true,
            fullScreen: true,
          },
        },
        tree: {
          type: "auto",
        },
      },
      layerConfig: {
        baselayer: {
          elements: [
            {
              id: "osm_basemap",
              name: "OpenStreetMap",
              typ: "WMS",
              visibility: true,
              showInLayerTree: true,
            },
          ],
        },
        subjectlayer: {
          elements: layerElements,
        },
      },
    };

    return JSON.stringify(config, null, 2);
  }

  generateConfigJs(_session: PortalSession): string {
    return `const Config = {
  layerConf: "./resources/services.json",
  restConf: "./resources/rest-services.json",
  styleConf: "./resources/style.json",
  namedProjections: [
    ["EPSG:25832", "+title=ETRS89/UTM 32N +proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"],
    ["EPSG:4326", "+title=WGS 84 +proj=longlat +datum=WGS84 +no_defs"]
  ],
  footer: {
    urls: [],
    showVersion: true
  },
  portalLanguage: {
    enabled: true,
    debug: false,
    languages: {
      de: "Deutsch",
      en: "English"
    },
    fallbackLanguage: "de",
    changeLanguageOnStartWhen: ["querystring", "localStorage", "navigator", "htmlTag"]
  }
};
`;
  }

  generateServicesJson(session: PortalSession): string {
    const services: any[] = [];

    // Add OSM basemap via WMS
    services.push({
      id: "osm_basemap",
      name: "OpenStreetMap",
      url: "https://ows.terrestris.de/osm/service",
      typ: "WMS",
      layers: "OSM-WMS",
      format: "image/png",
      version: "1.1.1",
      singleTile: false,
      transparent: false,
      tilesize: 256,
      gfiAttributes: "ignore",
      layerAttribution: "© OpenStreetMap contributors",
    });

    // Add each layer
    for (const layer of session.layers) {
      if (layer.type === 'geojson') {
        services.push({
          id: layer.id,
          name: layer.name,
          url: `./data/${layer.id}.geojson`,
          typ: "GeoJSON",
          gfiAttributes: "showAll",
          gfiTheme: "default",
        });
      } else if (layer.type === 'wfs') {
        services.push({
          id: layer.id,
          name: layer.name,
          url: layer.url,
          typ: "WFS",
          gfiAttributes: "showAll",
          gfiTheme: "default",
          version: "2.0.0",
        });
      }
    }

    return JSON.stringify(services, null, 2);
  }

  generateRestServicesJson(): string {
    return JSON.stringify([], null, 2);
  }

  generateStyleJson(): string {
    // Masterportal expects an array of style definitions
    return JSON.stringify([], null, 2);
  }

  generateIndexHtml(session: PortalSession): string {
    return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <title>${session.mapConfig.title}</title>
  <link rel="stylesheet" href="./mastercode/${MASTERPORTAL_VERSION}/css/masterportal.css">
</head>
<body>
  <div id="masterportal-root"></div>
  <script src="./mastercode/${MASTERPORTAL_VERSION}/js/masterportal.js"></script>
</body>
</html>
`;
  }

  // Convert WGS84 (lon, lat) to EPSG:25832 (UTM zone 32N)
  // Simplified conversion for Berlin area
  private lonLatToEPSG25832(lonLat: [number, number]): [number, number] {
    const [lon, lat] = lonLat;
    // Approximate conversion for Berlin area
    // More accurate would use proj4, but this is sufficient for initial centering
    const x = 500000 + (lon - 9) * 111320 * Math.cos(lat * Math.PI / 180);
    const y = lat * 110540;
    return [Math.round(x), Math.round(y)];
  }
}
