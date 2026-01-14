// ABOUTME: Generates Masterportal configuration files from session state
// ABOUTME: Produces config.json, config.js, services.json, and index.html

import proj4 from 'proj4';
import { PortalSession } from './types.js';

const MASTERPORTAL_VERSION = '3_12_0';

// Define projections
proj4.defs('EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

export class PortalGenerator {
  generateConfigJson(session: PortalSession): string {
    // Convert WGS84 [lon, lat] to EPSG:25832 [x, y]
    const centerEPSG25832 = this.lonLatToEPSG25832(session.mapConfig.center);

    // Layer elements only need id and visibility - all other info is in services.json
    const layerElements = session.layers.map((layer) => ({
      id: layer.id,
      visibility: true,
    }));

    const config = {
      portalConfig: {
        mainMenu: {
          expanded: true,
          title: {
            text: session.mapConfig.title,
          },
        },
        map: {
          mapView: {
            startCenter: centerEPSG25832,
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
              visibility: true,
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

    // Add OSM basemap via WMS (matching working example structure)
    services.push({
      id: "osm_basemap",
      name: "OpenStreetMap",
      url: "https://ows.terrestris.de/osm/service",
      typ: "WMS",
      layers: "OSM-WMS",
      format: "image/png",
      version: "1.3.0",
      singleTile: false,
      transparent: true,
      transparency: 0,
      tilesize: 512,
      gutter: 0,
      gfiAttributes: "ignore",
      layerAttribution: "© OpenStreetMap contributors",
    });

    // Add each layer with styleId for vector layers
    for (const layer of session.layers) {
      if (layer.type === 'geojson') {
        services.push({
          id: layer.id,
          name: layer.name,
          url: `./data/${layer.id}.geojson`,
          typ: "GeoJSON",
          epsg: "EPSG:4326",
          styleId: layer.id,
          gfiAttributes: "showAll",
          gfiTheme: "default",
        });
      } else if (layer.type === 'wfs') {
        services.push({
          id: layer.id,
          name: layer.name,
          url: layer.url,
          typ: "WFS",
          styleId: layer.id,
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

  generateStyleJson(session: PortalSession): string {
    // Generate style definitions for each layer
    const styles = session.layers.map((layer, index) => {
      // Use different colors for different layers
      const colors = [
        [228, 26, 28, 1],    // red
        [55, 126, 184, 1],   // blue
        [77, 175, 74, 1],    // green
        [152, 78, 163, 1],   // purple
        [255, 127, 0, 1],    // orange
      ];
      const color = colors[index % colors.length];

      return {
        styleId: layer.id,
        rules: [
          {
            style: {
              type: "circle",
              circleFillColor: color,
              circleRadius: 8,
              circleStrokeColor: [255, 255, 255, 1],
              circleStrokeWidth: 2,
            },
          },
        ],
      };
    });

    return JSON.stringify(styles, null, 2);
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

  // Convert WGS84 [lon, lat] to EPSG:25832 using proj4
  private lonLatToEPSG25832(lonLat: [number, number]): [number, number] {
    const result = proj4('EPSG:4326', 'EPSG:25832', lonLat);
    return [Math.round(result[0]), Math.round(result[1])];
  }
}
