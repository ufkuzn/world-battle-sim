import https from 'https';
import fs from 'fs';

const url = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json';

function pointInPolygon(point, vs) {
    const x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i][0], yi = vs[i][1];
        const xj = vs[j][0], yj = vs[j][1];
        const intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function pointInFeature(pt, feature) {
    if (feature.geometry.type === 'Polygon') {
        // geojson polygon: first ring is exterior, others are holes
        if (pointInPolygon(pt, feature.geometry.coordinates[0])) {
            let inHole = false;
            for (let i = 1; i < feature.geometry.coordinates.length; i++) {
                if (pointInPolygon(pt, feature.geometry.coordinates[i])) {
                    inHole = true;
                    break;
                }
            }
            if (!inHole) return true;
        }
    } else if (feature.geometry.type === 'MultiPolygon') {
        for (let p = 0; p < feature.geometry.coordinates.length; p++) {
            if (pointInPolygon(pt, feature.geometry.coordinates[p][0])) {
                let inHole = false;
                for (let i = 1; i < feature.geometry.coordinates[p].length; i++) {
                    if (pointInPolygon(pt, feature.geometry.coordinates[p][i])) {
                        inHole = true;
                        break;
                    }
                }
                if (!inHole) return true;
            }
        }
    }
    return false;
}

https.get(url, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log("Downloaded geojson");
        const geojson = JSON.parse(body);
        
        const cols = 200;
        const rows = 100;
        let lines = [];
        
        // Build an index for performance: bounding box for each feature
        const features = geojson.features.map(f => {
            let minX = 180, maxX = -180, minY = 90, maxY = -90;
            const updateBBox = (ring) => {
                for(let pt of ring) {
                    if(pt[0] < minX) minX = pt[0];
                    if(pt[0] > maxX) maxX = pt[0];
                    if(pt[1] < minY) minY = pt[1];
                    if(pt[1] > maxY) maxY = pt[1];
                }
            };
            if (f.geometry.type === 'Polygon') {
                updateBBox(f.geometry.coordinates[0]);
            } else if (f.geometry.type === 'MultiPolygon') {
                for (let p of f.geometry.coordinates) updateBBox(p[0]);
            }
            return { feature: f, bbox: [minX, minY, maxX, maxY] };
        });

        for (let y = 0; y < rows; y++) {
            let line = '';
            // Equirectangular projection
            const lat = 90 - (y / rows) * 180; 
            for (let x = 0; x < cols; x++) {
                const lon = (x / cols) * 360 - 180;
                
                let isLand = false;
                for (let f of features) {
                    // Check bbox
                    if (lon >= f.bbox[0] && lon <= f.bbox[2] && lat >= f.bbox[1] && lat <= f.bbox[3]) {
                        if (pointInFeature([lon, lat], f.feature)) {
                            isLand = true;
                            break;
                        }
                    }
                }
                line += isLand ? 'L' : 'W';
            }
            lines.push(line);
        }
        
        fs.writeFileSync('src/earth_data.ts', 'export const EARTH_ASCII = [\n' + lines.map(l => '  "' + l + '",').join('\n') + '\n];\n');
        console.log("Map generated successfully!");
    });
}).on('error', (e) => {
    console.error(e);
});
