// ABOUTME: Generates Masterportal configuration files from session state
// ABOUTME: Produces config.json, config.js, services.json, and index.html for Berlin (EPSG:25833)

import proj4 from 'proj4';
import { PortalSession } from './types.js';

const MASTERPORTAL_VERSION = '3_12_0';

// Define projections - EPSG:25833 is UTM Zone 33N (correct for Berlin)
proj4.defs('EPSG:25833', '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

export class PortalGenerator {
  generateConfigJson(session: PortalSession): string {
    // Convert WGS84 [lon, lat] to EPSG:25833 [x, y]
    const centerUTM = this.lonLatToUTM(session.mapConfig.center);

    // Minimal config matching working example structure
    const config = {
      portalConfig: {
        map: {
          controls: {
            zoom: true,
            orientation: {
              zoomMode: "once"
            }
          },
          mapView: {
            startCenter: centerUTM,
            startZoomLevel: session.mapConfig.zoom
          }
        },
        mainMenu: {
          expanded: true,
          title: {
            text: session.mapConfig.title
          }
        },
        tree: {
          highlightedFeatures: {
            active: true
          }
        }
      },
      layerConfig: {
        baselayer: {
          elements: [
            {
              id: "osm_basemap",
              visibility: true
            }
          ]
        }
      }
    };

    return JSON.stringify(config, null, 2);
  }

  generateConfigJs(_session: PortalSession): string {
    // Match working example structure - only EPSG:25833 for Berlin
    return `const Config = {
  namedProjections: [
    ["EPSG:25833", "+title=ETRS89/UTM 33N +proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"]
  ],
  layerConf: "./resources/services.json",
  restConf: "./resources/rest-services.json",
  styleConf: "./resources/style.json",
  portalLanguage: {
    enabled: true,
    debug: false,
    languages: {
      de: "Deutsch",
      en: "English"
    },
    fallbackLanguage: "de",
    changeLanguageOnStartWhen: ["querystring", "localStorage", "htmlTag"]
  }
};
`;
  }

  generateServicesJson(_session: PortalSession): string {
    // Minimal services - just OSM basemap
    const services = [
      {
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
        layerAttribution: "© OpenStreetMap contributors"
      }
    ];

    return JSON.stringify(services, null, 2);
  }

  generateRestServicesJson(): string {
    return JSON.stringify([], null, 2);
  }

  generateStyleJson(): string {
    return JSON.stringify([], null, 2);
  }

  generateIndexHtml(session: PortalSession): string {
    return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=0">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <title>${session.mapConfig.title}</title>
  <link rel="stylesheet" href="./mastercode/${MASTERPORTAL_VERSION}/css/masterportal.css">
</head>
<body>
  <div id="masterportal-root"></div>
  <script type="text/javascript" src="./mastercode/${MASTERPORTAL_VERSION}/js/masterportal.js"></script>
</body>
</html>
`;
  }

  // Convert WGS84 [lon, lat] to EPSG:25833 (UTM Zone 33N)
  private lonLatToUTM(lonLat: [number, number]): [number, number] {
    const result = proj4('EPSG:4326', 'EPSG:25833', lonLat);
    return [Math.round(result[0]), Math.round(result[1])];
  }
}
