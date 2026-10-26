import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import api from '../services/api';
import { decodePolyline } from '../utils/polyline';

/**
 * PROTOTIPE Fase B: peta aktivitas dengan MapLibre GL (vector, GPU) — pembanding Leaflet.
 * Akses: /map-proto/:activityId · data read-only, tanpa perubahan backend.
 * Style gratis tanpa key: OpenFreeMap (liberty/positron/bright).
 */
const STYLES = [
  { id: 'liberty', label: 'Liberty (detail warna)' },
  { id: 'positron', label: 'Positron (minimal terang)' },
  { id: 'bright', label: 'Bright (kontras)' },
];

export default function MapPrototype() {
  const { id } = useParams();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [styleId, setStyleId] = useState('liberty');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');

  // data rute
  useEffect(() => {
    api.get(`/activities/${id}`)
      .then((r) => {
        setName(r.data?.name || 'Aktivitas');
        const coords = decodePolyline(r.data?.map_polyline || '');
        const map = mapRef.current;
        if (!map || coords.length < 2) return;
        const geojson = {
          type: 'FeatureCollection' as const,
          features: [{
            type: 'Feature' as const,
            properties: {},
            geometry: { type: 'LineString' as const, coordinates: coords.map(([la, lo]) => [lo, la]) },
          }],
        };
        const src = map.getSource('route') as maplibregl.GeoJSONSource | undefined;
        if (src) src.setData(geojson);
        else map.addSource('route', { type: 'geojson', data: geojson });
        if (!map.getLayer('route-outline')) {
          map.addLayer({
            id: 'route-outline', type: 'line', source: 'route',
            paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.9 },
          });
          map.addLayer({
            id: 'route-line', type: 'line', source: 'route',
            paint: { 'line-color': '#f97316', 'line-width': 4 },
          });
        }
        const lons = coords.map(([, lo]) => lo);
        const las = coords.map(([la]) => la);
        map.fitBounds(
          [[Math.min(...lons), Math.min(...las)], [Math.max(...lons), Math.max(...las)]],
          { padding: 48, duration: 800 },
        );
      })
      .catch((e: any) => setErr(
        e?.response?.status === 401
          ? 'Belum login / sesi habis — buka halaman ini di tab yang sama dengan saat kamu memakai Dashboard.'
          : e?.response?.status === 404
            ? 'Aktivitas tidak ditemukan untuk akun ini.'
            : `Gagal memuat aktivitas (HTTP ${e?.response?.status || '??'}).`
      ));
  }, [id]);

  // buat peta sekali
  useEffect(() => {
    if (!container.current || mapRef.current) return;
    mapRef.current = new maplibregl.Map({
      container: container.current,
      style: `https://tiles.openfreemap.org/styles/${styleId}`,
      center: [110.36, -7.79],
      zoom: 11,
      attributionControl: { compact: true },
    });
    mapRef.current.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right');
    mapRef.current.addControl(new maplibregl.ScaleControl(), 'bottom-left');
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  // ganti style tanpa kehilangan rute
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded?.()) return;
    map.setStyle(`https://tiles.openfreemap.org/styles/${styleId}`, { diff: false });
    // rute ditambahkan ulang oleh effect data saat style selesai load (source hilang)
    map.once('styledata', () => {
      if (map.getSource('route')) return;
      const evt = new CustomEvent('proto-restyle', { detail: id });
      window.dispatchEvent(evt);
    });
  }, [styleId, id]);

  // restyle: re-inject rute setelah setStyle
  useEffect(() => {
    const onRestyle = () => {
      // trigger ulang effect data dengan meng-dispatch fetch ringan
      api.get(`/activities/${id}`).then((r) => {
        const map = mapRef.current;
        const coords = decodePolyline(r.data?.map_polyline || '');
        if (!map || coords.length < 2) return;
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [{
              type: 'Feature', properties: {},
              geometry: { type: 'LineString', coordinates: coords.map(([la, lo]) => [lo, la]) },
            }],
          },
        });
        map.addLayer({ id: 'route-outline', type: 'line', source: 'route', paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.9 } });
        map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#f97316', 'line-width': 4 } });
      }).catch(() => {});
    };
    window.addEventListener('proto-restyle', onRestyle);
    return () => window.removeEventListener('proto-restyle', onRestyle);
  }, [id]);

  return (
    <div className="max-w-5xl mx-auto pb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
            Prototipe Peta: MapLibre GL <span className="text-[10px] font-bold text-orange-600">VECTOR · GPU</span>
          </h1>
          <p className="text-sm text-zinc-500">{name || '…'} — bandingkan dengan peta Leaflet di halaman aktivitas.</p>
        </div>
        <Link to={`/activities/${id}`} className="text-xs text-zinc-500 hover:text-orange-500 underline">← Leaflet</Link>
      </div>

      <div className="flex gap-2 mb-3">
        {STYLES.map((s) => (
          <button
            key={s.id}
            onClick={() => setStyleId(s.id)}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors ${
              styleId === s.id
                ? 'bg-orange-600 text-white border-orange-600'
                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-orange-400'
            }`}
          >{s.label}</button>
        ))}
        <span className="ml-auto self-center text-[10px] text-zinc-400">Coba: zoom mulus, drag-rotate dengan klik-kanan + geser</span>
      </div>

      <div ref={container} className="w-full h-[70vh] rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800" />

      {err && <p className="mt-3 text-xs text-red-500">{err}</p>}
      <p className="mt-3 text-[11px] text-zinc-400">
        Vector tiles gratis dari OpenFreeMap (tanpa key/kartu). Catatan: teks & simbol peta ikut mulus saat zoom —
        di Leaflet raster, tile pecah saat perbesar.
      </p>
    </div>
  );
}
