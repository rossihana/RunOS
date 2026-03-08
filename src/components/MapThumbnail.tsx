import { useMemo } from 'react';
import { decodePolyline } from '../utils/polyline';

interface MapThumbnailProps {
  polyline: string | null;
  className?: string;
}

export default function MapThumbnail({ polyline, className = '' }: MapThumbnailProps) {
  const path = useMemo(() => {
    if (!polyline) return null;

    try {
      const coords = decodePolyline(polyline);
      if (coords.length === 0) return null;

      // Find bounding box
      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;

      coords.forEach(([lat, lng]) => {
        if (lng < minX) minX = lng;
        if (lng > maxX) maxX = lng;
        if (lat < minY) minY = lat;
        if (lat > maxY) maxY = lat;
      });

      // Normalize coordinates to a 100x100 viewBox with 5px padding
      const width = maxX - minX || 1;
      const height = maxY - minY || 1;
      
      // Preserve aspect ratio inside the viewBox
      const scale = Math.min(90 / width, 90 / height);
      const xOffset = (100 - width * scale) / 2;
      const yOffset = (100 - height * scale) / 2;

      const d = coords.map(([lat, lng], index) => {
        const x = (lng - minX) * scale + xOffset;
        // Invert Y axis because SVG origin is top-left, coordinates origin is bottom-left
        const y = 100 - ((lat - minY) * scale + yOffset);
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      }).join(' ');

      return d;
    } catch (e) {
      console.error('Failed to parse polyline', e);
      return null;
    }
  }, [polyline]);

  if (!path) {
    return (
      <div className={`bg-zinc-100 flex items-center justify-center text-zinc-400 text-xs rounded-xl ${className}`}>
        No Map
      </div>
    );
  }

  return (
    <div className={`bg-zinc-50 rounded-xl overflow-hidden shadow-sm border border-zinc-200 ${className}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full p-1" preserveAspectRatio="xMidYMid meet">
        <path
          d={path}
          fill="none"
          stroke="#FC4C02" // Strava Orange
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="drop-shadow-sm"
        />
      </svg>
    </div>
  );
}
