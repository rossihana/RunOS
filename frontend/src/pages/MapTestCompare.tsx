import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline as LeafletPolyline } from 'react-leaflet';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
maplibregl.setWorkerUrl(maplibreWorkerUrl);

/** Diagnosa publik: Leaflet vs MapLibre berdampingan dengan route dummy (tanpa login).
 *  pola sama persis dengan MapCompare.tsx — bedanya hanya data (dummy) & akses (publik). */
const COORDS: [number, number][] = [
  [-7.7916, 110.3617], [-7.7900, 110.3650], [-7.7920, 110.3680], [-7.7910, 110.3710],
  [-7.7930, 110.3740], [-7.7920, 110.3770], [-7.7940, 110.3800], [-7.7930, 110.3830],
  [-7.7950, 110.3860], [-7.7940, 110.3890],
];
const BOUNDS_LEAFLET: [[number, number], [number, number]] = [
  [-7.7950, 110.3617], [-7.7900, 110.3890],   // Leaflet: [lat, lng]
];
const BOUNDS_MAPLIBRE: [[number, number], [number, number]] = [
  [110.3617, -7.7950], [110.3890, -7.7900],   // MapLibre: [lng, lat] — WAJIB urutan ini
];

export default function MapTestCompare() {
  const mlRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const say = (m: string) => setLog((p) => [...p, m]);

  useEffect(() => {
    const onErr = (e: ErrorEvent) => say(`ERROR: ${e.message}`);
    const onRej = (e: PromiseRejectionEvent) => say(`REJECT: ${String(e.reason).slice(0, 120)}`);
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    return () => { window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onRej); };
  }, []);

  useEffect(() => {
    if (!mlRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mlRef.current,
      style: {
        version: 8,
        sources: { esri: { type: 'raster', tileSize: 256, attribution: 'Tiles © Esri',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'] } },
        layers: [{ id: 'esri', type: 'raster', source: 'esri' }],
      },
      bounds: BOUNDS_MAPLIBRE,
      fitBoundsOptions: { padding: 40 },
    });
    mapRef.current = map;
    map.on('load', () => {
      say('maplibre: load ok');
      map.addSource('route', { type: 'geojson', data: {
        type: 'FeatureCollection', features: [{ type: 'Feature', properties: {},
          geometry: { type: 'LineString', coordinates: COORDS.map(([la, lo]) => [lo, la]) } }],
      } });
      map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#f97316', 'line-width': 4 } });
      say('maplibre: route ok');
    });
    map.on('error', (e: any) => say(`maplibre error: ${String(e?.error?.message || e).slice(0, 120)}`));
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">
        Diagnosa publik: Leaflet (kiri) vs MapLibre (kanan) — route dummy
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-bold text-zinc-500 mb-1">LEAFLET</p>
          <div className="h-[55vh] rounded-xl overflow-hidden border border-zinc-300">
            <MapContainer bounds={BOUNDS_LEAFLET} style={{ width: '100%', height: '100%' }} scrollWheelZoom>
              <TileLayer
                attribution='Tiles © Esri'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                maxZoom={16}
              />
              <LeafletPolyline positions={COORDS} pathOptions={{ color: '#f97316', weight: 4 }} />
            </MapContainer>
          </div>
        </div>
        <div>
          <p className="text-xs font-bold text-zinc-500 mb-1">MAPLIBRE</p>
          <div ref={mlRef} className="h-[55vh] rounded-xl overflow-hidden border border-zinc-300" />
        </div>
      </div>
      <pre className="mt-3 p-3 bg-zinc-100 dark:bg-zinc-800 rounded text-[11px] whitespace-pre-wrap" data-testid="cmp-log">
        {log.length ? log.join('\n') : '(log…)'}
      </pre>
    </div>
  );
}
