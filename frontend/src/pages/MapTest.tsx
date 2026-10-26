import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// Vite: worker maplibre v6 tidak ter-emit otomatis → arahkan eksplisit (?worker&url = file hashed di /assets)
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
maplibregl.setWorkerUrl(maplibreWorkerUrl);

/** Halaman diagnose publik: peta MapLibre + route dummy + kolektor error on-screen. */
export default function MapTest() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const log = (m: string) => setLogs((p) => [...p, `${new Date().toISOString().slice(11, 19)} ${m}`]);

  useEffect(() => {
    const onErr = (e: ErrorEvent) => log(`ERROR: ${e.message}`);
    const onRej = (e: PromiseRejectionEvent) => log(`REJECT: ${String(e.reason).slice(0, 150)}`);
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    return () => { window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onRej); };
  }, []);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    log('membuat map…');
    try {
      const map = new maplibregl.Map({
        container: container.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [110.36, -7.79],
        zoom: 11,
      });
      mapRef.current = map;
      map.on('error', (e: any) => log(`map.error: ${String(e?.error?.message || e).slice(0, 150)}`));
      map.on('load', () => {
        log('map: LOAD ok');
        map.addSource('route', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [{
            type: 'Feature', properties: {},
            geometry: { type: 'LineString', coordinates: [
              [110.3617, -7.7916], [110.365, -7.79], [110.368, -7.792], [110.371, -7.791],
              [110.374, -7.793], [110.377, -7.792], [110.38, -7.794], [110.383, -7.793],
            ] },
          }] },
        });
        map.addLayer({ id: 'route-outline', type: 'line', source: 'route', paint: { 'line-color': '#fff', 'line-width': 7 } });
        map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#f97316', 'line-width': 4 } });
        log('route ditambahkan ✓');
      });
    } catch (e: any) {
      log(`EXCEPTION: ${e?.message}`);
    }
  }, []);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-lg font-bold mb-2">MapLibre diagnose (publik)</h1>
      <div ref={container} style={{ width: '100%', height: '60vh', border: '2px solid red' }} />
      <pre className="mt-3 p-3 bg-zinc-100 rounded text-[11px] whitespace-pre-wrap" data-testid="logs">
        {logs.length ? logs.join('\n') : '(belum ada log)'}
      </pre>
    </div>
  );
}
