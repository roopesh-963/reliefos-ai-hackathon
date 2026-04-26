import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Radar } from 'lucide-react';
import { BackToDashboardButton } from '../components/navigation/BackToDashboardButton';
import { LiveEarthquakeMonitoringPanel } from '../components/LiveEarthquakeMonitoringPanel';
import { cn } from '../lib/utils';
import { generateCityReport, CityReport } from '../services/geminiService';
import {
  CrisisMarker,
  CrisisOverview,
  fetchCrisisOverview,
  fetchIntelSourceStatus,
  IntelSourceStatus,
} from '../services/api';
import { useNotifications } from '../hooks/useNotifications';

export default function CrisisMap() {
  const [feedMode, setFeedMode] = useState<'all' | 'critical'>('all');
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [overview, setOverview] = useState<CrisisOverview | null>(null);
  const [sourceStatus, setSourceStatus] = useState<IntelSourceStatus | null>(null);
  const [report, setReport] = useState<CityReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const previousCriticalCount = useRef<number | null>(null);
  const { addNotification } = useNotifications();

  useEffect(() => {
    let isMounted = true;

    const loadOverview = async () => {
      try {
        setLoadingOverview(true);

        const [overviewData, sourceData] = await Promise.all([
          fetchCrisisOverview(),
          fetchIntelSourceStatus(),
        ]);

        if (!isMounted) {
          return;
        }

        setOverview(overviewData);
        setSourceStatus(sourceData);

        if (
          previousCriticalCount.current !== null &&
          previousCriticalCount.current !== overviewData.summary.criticalEarthquakes
        ) {
          addNotification({
            type:
              overviewData.summary.criticalEarthquakes > previousCriticalCount.current
                ? 'critical'
                : 'info',
            title: 'Global Seismic Feed Updated',
            message: `${overviewData.summary.criticalEarthquakes} critical earthquakes are active in the 24-hour feed.`,
          });
        } else if (previousCriticalCount.current === null) {
          addNotification({
            type: 'info',
            title: 'Live Feed Connected',
            message: `USGS feed synced with ${overviewData.summary.activeEarthquakes} tracked events.`,
          });
        }

        previousCriticalCount.current = overviewData.summary.criticalEarthquakes;
      } catch (error) {
        console.error('Failed to load crisis overview:', error);
        if (isMounted) {
          addNotification({
            type: 'warning',
            title: 'Telemetry Delay',
            message: 'Live APIs are temporarily unavailable. Auto-retrying in the background.',
          });
        }
      } finally {
        if (isMounted) {
          setLoadingOverview(false);
        }
      }
    };

    void loadOverview();
    const interval = window.setInterval(loadOverview, 3 * 60 * 1000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [addNotification]);

  const visibleMarkers = useMemo(() => {
    const markers = overview?.markers || [];
    if (feedMode === 'critical') {
      return markers.filter((marker) => marker.type === 'critical' || marker.type === 'warning');
    }
    return markers;
  }, [feedMode, overview]);

  const handleMarkerSelect = async (marker: CrisisMarker) => {
    setSelectedMarkerId(marker.id);
    setLoadingReport(true);
    try {
      const data = await generateCityReport(marker.label, marker.position);
      setReport(data);
    } catch (error) {
      console.error('Failed to fetch marker report:', error);
    } finally {
      setLoadingReport(false);
    }
  };

  const mapOverlayControls = (
    <div className="absolute top-3 right-3 z-[520] rounded-xl border border-white/15 bg-[#071225]/90 backdrop-blur-md p-2 flex flex-col gap-2">
      {[
        { id: 'all', label: 'All Events', icon: Radar },
        { id: 'critical', label: 'Critical Focus', icon: AlertTriangle },
      ].map((layer) => (
        <button
          key={layer.id}
          type="button"
          onClick={() => {
            setFeedMode(layer.id as 'all' | 'critical');
            setSelectedMarkerId(null);
            setReport(null);
          }}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-1.5 text-[10px] uppercase tracking-widest font-semibold transition-colors',
            feedMode === layer.id
              ? 'bg-cyan-500/15 border-cyan-300/30 text-cyan-100'
              : 'bg-black/20 border-white/10 text-gray-200 hover:border-cyan-300/25'
          )}
        >
          <layer.icon className="w-3 h-3" />
          {layer.label}
        </button>
      ))}
      <div className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-[10px] text-cyan-100/80 uppercase tracking-widest font-mono">
        {feedMode === 'critical' ? 'Critical + Warning' : 'Full seismic feed'}
      </div>
    </div>
  );

  return (
    <>
      <div className="fixed left-4 top-4 z-[650] sm:left-6 sm:top-6">
        <BackToDashboardButton />
      </div>
      <LiveEarthquakeMonitoringPanel
        title="Crisis Map Live Monitoring"
        overview={overview}
        loadingOverview={loadingOverview}
        markers={visibleMarkers}
        selectedMarkerId={selectedMarkerId}
        onMarkerSelect={handleMarkerSelect}
        report={report}
        loadingReport={loadingReport}
        sourceStatus={sourceStatus}
        mapOverlayControls={mapOverlayControls}
      />
    </>
  );
}
