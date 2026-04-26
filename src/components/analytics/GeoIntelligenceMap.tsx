import React from 'react';
import { CircleMarker, MapContainer, Popup, ScaleControl, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '../../lib/utils';

export interface GeoCluster {
  name: string;
  incidents: number;
  critical: number;
  avgResponseMinutes: number;
  dominantCrisisType: string;
  position: [number, number];
}

interface GeoIntelligenceMapProps {
  clusters: GeoCluster[];
}

const getFill = (cluster: GeoCluster) => {
  if (cluster.avgResponseMinutes >= 45 || cluster.critical >= 3) {
    return '#ef4444';
  }
  if (cluster.avgResponseMinutes >= 25 || cluster.critical >= 1) {
    return '#f97316';
  }
  return '#22d3ee';
};

const isValidPosition = (position: [number, number]) => {
  return Number.isFinite(position[0]) && Number.isFinite(position[1]) && !(position[0] === 0 && position[1] === 0);
};

export function GeoIntelligenceMap({ clusters }: GeoIntelligenceMapProps) {
  const visibleClusters = clusters.filter((cluster) => isValidPosition(cluster.position));

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-3xl border border-white/10 bg-[#07111f]/80 backdrop-blur-xl">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_55%),linear-gradient(180deg,rgba(7,17,31,0.12),rgba(7,17,31,0.82))]" />
      <MapContainer
        center={[20, 0]}
        zoom={2}
        scrollWheelZoom={true}
        zoomControl={false}
        className="relative z-10 h-full min-h-[420px] w-full"
        style={{ background: '#07111f' }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={20}
        />

        <ScaleControl position="bottomleft" />

        {visibleClusters.map((cluster) => {
          const radius = Math.max(12, Math.min(34, 10 + cluster.incidents * 2.4));
          const fillColor = getFill(cluster);

          return (
            <CircleMarker
              key={cluster.name}
              center={cluster.position}
              radius={radius}
              pathOptions={{
                color: fillColor,
                fillColor,
                fillOpacity: 0.3,
                opacity: 0.85,
                weight: 2,
              }}
            >
              <Popup className="tactical-popup">
                <div className="p-3 bg-[#101a29] text-white border border-white/10 rounded-xl min-w-[220px]">
                  <div className="text-[9px] uppercase font-mono tracking-[0.3em] text-cyan-200/70 mb-1">
                    Geo Cluster
                  </div>
                  <div className="text-base font-bold text-white">{cluster.name}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-300">
                    <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                      <span className="block uppercase tracking-widest text-[9px] text-gray-500">Incidents</span>
                      <span className="text-white font-semibold">{cluster.incidents}</span>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                      <span className="block uppercase tracking-widest text-[9px] text-gray-500">Critical</span>
                      <span className="text-white font-semibold">{cluster.critical}</span>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                      <span className="block uppercase tracking-widest text-[9px] text-gray-500">Response</span>
                      <span className="text-white font-semibold">{cluster.avgResponseMinutes}m</span>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                      <span className="block uppercase tracking-widest text-[9px] text-gray-500">Type</span>
                      <span className="text-white font-semibold capitalize">{cluster.dominantCrisisType}</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <div className="absolute left-4 top-4 z-20 rounded-2xl border border-white/10 bg-[#08111d]/80 backdrop-blur-md px-3 py-2 shadow-2xl">
        <div className="text-[9px] uppercase tracking-[0.3em] text-cyan-100/60 font-mono">Heat Legend</div>
        <div className="mt-2 space-y-1.5 text-[10px] text-gray-300">
          <div className="flex items-center gap-2">
            <span className={cn('inline-block w-2.5 h-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.65)]')} />
            Fast response
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('inline-block w-2.5 h-2.5 rounded-full bg-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.65)]')} />
            Delayed zone
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('inline-block w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.75)]')} />
            Critical cluster
          </div>
        </div>
      </div>
    </div>
  );
}
