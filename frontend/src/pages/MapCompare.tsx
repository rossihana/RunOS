import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline as LeafletPolyline } from 'react-leaflet';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
maplibregl.setWorkerUrl(maplibreWorkerUrl);
import api from '../services/api';
import { decodePolyline } from '../utils/polyline';

/** Diagnosa Fase map: Leaflet vs MapLibre, DATA & BASEMAP identik (Esri raster).
 *  Kalau garis kiri tepat & kanan melenceng → bug rendering MapLibre.
 *  Kalau dua-duanya sama-sama melenceng → GPS/basemap (bukan kode). */
export default function MapCompare() {
  const { id } = useParams();
  const mlRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [coords, setCoords] = useState<[number, number][]>([]);
  const [err, setErr] = useState('');
  const [ready, setReady] = useState({ leaflet: false, maplibre: false });

  useEffect(() => {
    api.get(`/activities/${id}`)
      .then((r) => {
        const c = decodePolyline(r.data?.map_polyline || '');
        if (c.length < 2) throw new Error('rute < 2 titik');
        setCoords(c);
      })
      .catch((e: any) => setErr(e?.response?.status
        ? `HTTP ${e.response.status}`
        : String(e?.message || e)));
  }, [id]);

  const lons = coords.map(([, lo]) => lo);
  const las = coords.map(([la]) => la);
  const bounds: [[number, number], [number, number]] | null = coords.length >= 2
    ? [[Math.min(...lons), Math.min(...las)], [Math.max(...lons), Math.max(...las)]]
    : null;

  // MapLibre: buat sekali, gambar rute saat data & style siap
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
      center: [110.36, -7.79],
      zoom: 13,
    });
    mapRef.current = map;
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || coords.length < 2) return;
    const inject = () => {
      const geojson = {
        type: 'FeatureCollection' as const,
        features: [{ type: 'Feature' as const, properties: {},
          geometry: { type: 'LineString' as const, coordinates: coords.map(([la, lo]) => [lo, la]) } }],
      };
      if (map.getSource('route')) (map.getSource('route') as maplibregl.GeoJSONSource).setData(geojson);
      else {
        map.addSource('route', { type: 'geojson', data: geojson });
        map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#f97316', 'line-width': 4 } });
      }
      map.fitBounds(bounds!, { padding: 40, duration: 0 });
      setReady((p) => ({ ...p, maplibre: true }));
    };
    if (map.isStyleLoaded()) inject();
    else map.once('load', inject);
  }, [coords]);

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">
        Diagnosa: Leaflet (kiri) vs MapLibre (kanan) — data & basemap identik
      </h1>
      <p className="text-xs text-zinc-500 mb-3">
        {err ? <span className="text-red-500">{err}</span> : `Aktivitas ${id} · ${coords.length} titik GPS · basemap Esri raster sama`}
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-bold text-zinc-500 mb-1">LEAFLET (raster SVG)</p>
          <div className="h-[60vh] rounded-xl overflow-hidden border border-zinc-300 dark:border-zinc-700">
            {bounds && (
              <MapContainer bounds={bounds} style={{ width: '100%', height: '100%' }} scrollWheelZoom>
                <TileLayer
                  attribution='Tiles © Esri'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={16}
                />
                <LeafletPolyline positions={coords} pathOptions={{ color: '#f97316', weight: 4 }} />
              </MapContainer>
            )}
          </div>
          <p className="text-[10px] text-zinc-400 mt-1">ready: {ready.leaflet ? 'y' : 'n'}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-zinc-500 mb-1">MAPLIBRE (vector GPU engine, raster Esri)</p>
          <div ref={mlRef} className="h-[60vh] rounded-xl overflow-hidden border border-zinc-300 dark:border-zinc-700" />
          <p className="text-[10px] text-zinc-400 mt-1">ready: {ready.maplibre ? 'y' : 'n'}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Zoom-in ke titik yang sama di kedua peta (pakai tombol zoom, sama-sama fit bounds):
        garis kanan meleset relatif jalan sementara kiri tepat = bug rendering MapLibre.
        Dua-duanya meleset sama = GPS/basemap, bukan kode.
      </p>
    </div>
  );
}
