import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BadgeDollarSign,
  Globe2,
  Loader2,
  Map,
  MapPin,
  Radio,
  ShieldAlert,
  Sparkles,
  Waves,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { TacticalMap, TacticalMarker } from './TacticalMap';
import {
  CrisisMarker,
  CrisisOverview,
  GlobalCrisisCard,
  GlobalCrisisOverview,
  IntelSourceStatus,
  LocationIntelReport,
} from '../services/api';

const SeismicGlobe = lazy(() =>
  import('./SeismicGlobe').then((module) => ({ default: module.SeismicGlobe }))
);

interface LiveEarthquakeMonitoringPanelProps {
  title?: string;
  overview: CrisisOverview | null;
  globalOverview?: GlobalCrisisOverview | null;
  loadingOverview: boolean;
  markers: CrisisMarker[];
  selectedMarkerId: string | null;
  onMarkerSelect: (marker: CrisisMarker) => void;
  report: LocationIntelReport | null;
  loadingReport: boolean;
  sourceStatus?: IntelSourceStatus | null;
  mapOverlayControls?: React.ReactNode;
}

const RELATIVE_TIME = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const formatUpdatedAt = (timestamp?: string) => {
  if (!timestamp) {
    return 'Awaiting first sync';
  }

  return new Date(timestamp).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const relativeFromNow = (timestamp?: number) => {
  if (!timestamp) {
    return 'just now';
  }

  const diffMs = timestamp - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  if (Math.abs(diffMinutes) < 60) {
    return RELATIVE_TIME.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return RELATIVE_TIME.format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffHours / 24);
  return RELATIVE_TIME.format(diffDays, 'day');
};

const formatUtcTimestamp = (timestamp?: number) => {
  if (!timestamp) {
    return 'UTC: --';
  }

  return `UTC: ${new Date(timestamp).toUTCString()}`;
};

const sourceBadgeClass = (enabled: boolean) =>
  enabled
    ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'
    : 'border-amber-400/25 bg-amber-500/10 text-amber-100';

const markerTone = (type: CrisisMarker['type']) => {
  if (type === 'critical') {
    return 'border-red-400/30 bg-red-500/12 text-red-200';
  }
  if (type === 'warning') {
    return 'border-amber-400/30 bg-amber-500/12 text-amber-100';
  }
  return 'border-cyan-400/30 bg-cyan-500/12 text-cyan-100';
};

const reportStatusTone = (status: string) => {
  if (status === 'Critical') {
    return 'border-red-400/30 bg-red-500/12 text-red-200';
  }
  if (status === 'Warning') {
    return 'border-amber-400/30 bg-amber-500/12 text-amber-100';
  }
  return 'border-emerald-400/30 bg-emerald-500/12 text-emerald-200';
};

const summaryTone = (label: string) => {
  if (label === 'Critical') {
    return 'border-red-400/24 bg-red-500/10 text-red-100';
  }
  if (label === 'Warning') {
    return 'border-amber-400/24 bg-amber-500/10 text-amber-100';
  }
  return 'border-cyan-300/24 bg-cyan-400/[0.08] text-cyan-50';
};

export function LiveEarthquakeMonitoringPanel({
  title = 'Crisis Map Live Monitoring',
  overview,
  globalOverview,
  loadingOverview,
  markers,
  selectedMarkerId,
  onMarkerSelect,
  report,
  loadingReport,
  mapOverlayControls,
}: LiveEarthquakeMonitoringPanelProps) {
  const [viewMode, setViewMode] = useState<'globe' | 'map'>('globe');
  const [showFaultLines, setShowFaultLines] = useState(true);
  const [speed, setSpeed] = useState(55);

  const feedMarkers = useMemo(() => {
    return [...markers].sort((a, b) => {
      if (a.occurredAt && b.occurredAt) {
        return b.occurredAt - a.occurredAt;
      }

      return (b.magnitude || 0) - (a.magnitude || 0);
    });
  }, [markers]);

  useEffect(() => {
    if (viewMode !== 'map') {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const warmGlobe = () => {
      void import('./SeismicGlobe');
    };

    let timeoutHandle: ReturnType<typeof globalThis.setTimeout> | null = null;
    let idleHandle: number | null = null;

    if ('requestIdleCallback' in window) {
      idleHandle = window.requestIdleCallback(warmGlobe, { timeout: 2500 });
    } else {
      timeoutHandle = globalThis.setTimeout(warmGlobe, 1800);
    }

    return () => {
      if (timeoutHandle !== null) {
        globalThis.clearTimeout(timeoutHandle);
      }
      if (idleHandle !== null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleHandle);
      }
    };
  }, [viewMode]);

  const selectedEvent = useMemo(() => {
    if (!selectedMarkerId) {
      return null;
    }

    return feedMarkers.find((event) => event.id === selectedMarkerId) || null;
  }, [feedMarkers, selectedMarkerId]);

  const summary = useMemo(
    () => [
      {
        label: 'Tracked',
        value: overview?.summary.activeEarthquakes ?? feedMarkers.length,
      },
      {
        label: 'Critical',
        value: feedMarkers.filter((marker) => marker.type === 'critical').length,
      },
      {
        label: 'Warning',
        value: feedMarkers.filter((marker) => marker.type === 'warning').length,
      },
    ],
    [feedMarkers, overview]
  );

  const handleMapSelect = (marker: TacticalMarker) => {
    const resolved = feedMarkers.find((event) => event.id === marker.id);
    if (resolved) {
      onMarkerSelect(resolved);
    }
  };

  const featureHeadline = overview?.headlines?.[0];
  const additionalHeadlines = overview?.headlines?.slice(1, 6) || [];
  const crossCrisisCards = useMemo(
    () =>
      (globalOverview?.cards || []).filter(
        (card) => card.type === 'financial_crisis' || card.type === 'war_conflict'
      ),
    [globalOverview]
  );

  const crisisLaneIcon = (cardType: GlobalCrisisCard['type']) =>
    cardType === 'financial_crisis' ? BadgeDollarSign : ShieldAlert;

  return (
    <div className="relief-page text-white">
      <div className="relief-orb left-[-10%] top-[8%] h-72 w-72 bg-[rgba(255,110,76,0.18)]" />
      <div className="relief-orb right-[4%] top-[14%] h-64 w-64 bg-[rgba(139,0,0,0.22)]" />
      <div className="dashboard-particles absolute inset-0 opacity-35" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1340px] flex-col px-3 py-3 sm:px-4 sm:py-4">
        <div className="flex flex-col gap-4">
          <section className="overflow-hidden">
            <div className="relative px-1 py-3 sm:px-2 sm:py-4">
              <div className="relative flex flex-col items-center gap-5 text-center">
                <div className="relief-kicker inline-flex items-center gap-2 px-2 py-2 text-[11px] uppercase tracking-[0.34em]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Global Seismic Relay
                </div>

                <h1 className="relief-title max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl xl:text-5xl">
                  {title}
                </h1>

                <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
                  <div className="inline-flex items-center gap-2 px-2 py-2 text-[11px] uppercase tracking-[0.26em] text-rose-100">
                    <Radio className="h-3.5 w-3.5 animate-pulse" />
                    Live
                  </div>
                  <div className="inline-flex items-center gap-2 px-2 py-2 text-[11px] uppercase tracking-[0.26em] text-white/58">
                    {formatUpdatedAt(overview?.updatedAt)}
                  </div>
                </div>

                <div className="mt-2 grid w-full max-w-[700px] grid-cols-1 gap-2 sm:grid-cols-3">
                  {summary.map((item) => (
                    <div
                      key={item.label}
                    className={cn(
                        'relief-card rounded-[1.1rem] px-3 py-2.5',
                        summaryTone(item.label).replace(/border-[^ ]+ ?/g, '').replace(/bg-[^ ]+ ?/g, '')
                      )}
                    >
                      <div className="text-[10px] uppercase tracking-[0.22em] text-white/46">{item.label}</div>
                      <div className="mt-2 font-display text-2xl font-semibold tracking-tight text-white">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[280px_minmax(0,1.35fr)_300px] 2xl:grid-cols-[300px_minmax(0,1.5fr)_320px]">
            <aside className="flex min-h-[420px] flex-col gap-3">
              {featureHeadline ? (
                <section className="relief-panel overflow-hidden rounded-[1.5rem]">
                  {featureHeadline.imageUrl ? (
                    <img
                      src={featureHeadline.imageUrl}
                      alt={featureHeadline.title}
                      className="h-32 w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-32 w-full bg-[radial-gradient(circle_at_top,rgba(255,96,62,0.3),rgba(32,12,12,0.4)_60%,rgba(16,10,10,0.82)_100%)]" />
                  )}
                  <div className="space-y-3 p-4">
                    <div className="text-[11px] uppercase tracking-[0.28em] text-white/40">Top Headline</div>
                    <div className="text-sm font-semibold text-white">{featureHeadline.title}</div>
                    <p className="text-[13px] leading-5 text-white/64">
                      {featureHeadline.description}
                    </p>
                    <a
                      href={featureHeadline.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-[var(--color-relief-orange)]"
                    >
                      Open source
                      <ArrowUpRight className="h-4 w-4" />
                    </a>

                    {additionalHeadlines.length > 0 ? (
                      <div className="pt-2">
                        <div className="mb-2 text-[10px] uppercase tracking-[0.24em] text-white/36">More News</div>
                        <div className="max-h-32 space-y-2 overflow-y-auto pr-1">
                          {additionalHeadlines.map((headline) => (
                            <a
                              key={headline.id}
                              href={headline.url}
                              target="_blank"
                              rel="noreferrer"
                              className="relief-card block rounded-[1rem] p-2.5 transition hover:bg-white/[0.06]"
                            >
                              <div className="line-clamp-2 text-[13px] font-medium text-white">{headline.title}</div>
                              <div className="mt-2 text-[11px] text-white/44">{headline.source}</div>
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <section className="relief-panel flex min-h-[200px] flex-col rounded-[1.4rem] p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-white/40">Event Feed</div>
                  <div className="text-xs text-white/50">{loadingOverview ? 'Syncing' : `${feedMarkers.length} tracked`}</div>
                </div>

                <div className="mt-3 h-[220px] overflow-y-auto pr-1">
                  {loadingOverview ? (
                    <div className="flex h-[220px] items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
                    </div>
                  ) : feedMarkers.length === 0 ? (
                    <div className="p-2 text-sm text-white/60">
                      No events available from the live feed yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {feedMarkers.slice(0, 8).map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => onMarkerSelect(event)}
                          className={cn(
                            'group relief-card w-full rounded-[1rem] p-2.5 text-left transition',
                            selectedMarkerId === event.id
                              ? 'text-cyan-50'
                              : 'text-white/90 hover:bg-white/[0.05]'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-medium text-white">{event.label}</div>
                              <div className="mt-1.5 text-[11px] text-white/48">{formatUtcTimestamp(event.occurredAt)}</div>
                              <div className="mt-1 text-[11px] text-cyan-100/60">{relativeFromNow(event.occurredAt)}</div>
                            </div>
                            <span className={cn('rounded-full border px-2 py-1 text-[11px]', markerTone(event.type))}>
                              M{(event.magnitude || 0).toFixed(1)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>

            </aside>

            <div className="flex min-h-[420px] flex-col gap-3">
              <div className="relief-panel relative min-h-[560px] overflow-hidden rounded-[1.6rem]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(91,155,255,0.1),transparent_24%),radial-gradient(circle_at_88%_12%,rgba(67,224,255,0.08),transparent_18%)]" />
                <div className="absolute inset-x-0 top-0 z-[450] flex items-center justify-between px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {(['map', 'globe'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setViewMode(mode)}
                        className={cn(
                          'relief-chip inline-flex h-9 items-center gap-2 rounded-full px-3 text-[13px] font-medium transition',
                          viewMode === mode ? 'text-white' : 'text-white/65 hover:text-white'
                        )}
                      >
                        {mode === 'map' ? <Map className="h-4 w-4" /> : <Globe2 className="h-4 w-4" />}
                        {mode === 'map' ? 'Map' : 'Globe'}
                      </button>
                    ))}

                    <div>
                      <div className="text-[10px] uppercase tracking-[0.26em] text-white/42">
                        {viewMode === 'map' ? 'Map Relay' : 'Global Relay'}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {loadingOverview ? 'Syncing feed...' : `${overview?.summary.activeEarthquakes ?? feedMarkers.length} active events`}
                      </div>
                    </div>
                  </div>

                  <div />
                </div>

                <div className="absolute inset-0 pt-[72px]">
                  {viewMode === 'map' ? (
                    <TacticalMap
                      markers={feedMarkers}
                      selectedMarkerId={selectedMarkerId}
                      onCityClick={handleMapSelect}
                      showFaultLines={showFaultLines}
                    />
                  ) : (
                    <Suspense
                      fallback={
                        <div className="flex h-full items-center justify-center text-cyan-100/80">
                          <div className="flex items-center gap-3 rounded-full border border-cyan-300/20 bg-cyan-500/10 px-4 py-2 text-xs uppercase tracking-[0.22em]">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading Globe
                          </div>
                        </div>
                      }
                    >
                      <SeismicGlobe
                        markers={feedMarkers}
                        selectedMarkerId={selectedMarkerId}
                        onMarkerSelect={onMarkerSelect}
                        speed={speed}
                      />
                    </Suspense>
                  )}
                </div>

                {selectedEvent && (
                  <div className="relief-card absolute bottom-4 left-4 z-[500] max-w-[290px] rounded-[1.1rem] px-3 py-2.5">
                    <div className="text-[13px] font-semibold text-white">{selectedEvent.label}</div>
                    <div className="mt-2 text-[13px] text-white/65">
                      Magnitude {(selectedEvent.magnitude || 0).toFixed(1)} | Depth {Math.round(selectedEvent.depthKm || 0)} km
                    </div>
                  </div>
                )}

                {mapOverlayControls}
              </div>

              <section className="relief-panel rounded-[1.4rem] p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-white/40">Map Details</div>
                  <div className="text-xs text-white/50">
                    {crossCrisisCards.length > 0 ? 'Cross-Crisis + War / Conflict' : 'Syncing'}
                  </div>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {crossCrisisCards.length === 0 ? (
                    <div className="rounded-[1rem] border border-white/10 bg-white/[0.03] p-3 text-sm text-white/58 lg:col-span-2">
                      Financial and war/conflict intelligence will appear here once the universal crisis feed finishes syncing.
                    </div>
                  ) : (
                    crossCrisisCards.map((card) => {
                      const LaneIcon = crisisLaneIcon(card.type);
                      return (
                        <div key={card.type} className="relief-card rounded-[1rem] p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/42">
                                <LaneIcon className="h-3.5 w-3.5 text-cyan-100/76" />
                                {card.label}
                              </div>
                              <div className="mt-2 text-sm font-semibold text-white">{card.executiveSummary}</div>
                            </div>
                            <span className={cn('rounded-full border px-2 py-1 text-[10px]', reportStatusTone(card.severity))}>
                              {card.severity}
                            </span>
                          </div>
                          <div className="mt-3 text-[13px] leading-6 text-white/66">{card.summary}</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {card.metrics.slice(0, 2).map((metric) => (
                              <div
                                key={`${card.type}-${metric.label}`}
                                className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-white/70"
                              >
                                <span className="text-white/42">{metric.label}:</span> {metric.value}
                              </div>
                            ))}
                          </div>
                          {card.topSignals[0] ? (
                            <div className="mt-3 text-[12px] leading-5 text-cyan-100/58">{card.topSignals[0]}</div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </div>

            <aside className="flex min-h-[420px] flex-col gap-3">
              <section className="relief-panel min-h-[190px] flex-1 rounded-[1.4rem] p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-white/40">Location Intel</div>
                  <div className="inline-flex items-center gap-1 text-xs text-cyan-100/54">
                    <Activity className="h-3.5 w-3.5" />
                    Selected Event
                  </div>
                </div>

                <div className="mt-4">
                  {loadingReport ? (
                    <div className="flex h-[150px] items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
                    </div>
                  ) : report ? (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold text-white">{report.city}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.24em] text-white/42">{report.country}</div>
                        </div>
                        <span className={cn('px-2 py-1 text-[11px]', reportStatusTone(report.status).replace(/border-[^ ]+ ?/g, '').replace(/bg-[^ ]+ ?/g, ''))}>
                          {report.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="relief-card rounded-[1rem] p-3">
                          <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">Threat</div>
                          <div className="mt-2 text-lg font-semibold text-white">{report.threatLevel}%</div>
                        </div>
                        <div className="relief-card rounded-[1rem] p-3">
                          <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">AQI</div>
                          <div className="mt-2 text-lg font-semibold text-white">{report.weather.aqi}</div>
                        </div>
                      </div>

                      <div className="relief-card rounded-[1rem] p-3 text-[13px] text-white/68">
                        {report.weather.condition}, {report.weather.temperature}, wind {report.weather.windSpeed}
                      </div>

                      <a
                        href={report.mapUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-[var(--color-relief-orange)]"
                      >
                        <MapPin className="h-4 w-4" />
                        Open map
                      </a>
                    </div>
                  ) : (
                    <div className="flex h-[150px] flex-col items-center justify-center gap-3 text-center text-white/56">
                      <AlertTriangle className="h-5 w-5 text-cyan-200/70" />
                      <div className="max-w-[240px] text-sm">
                        Select an event from the feed or map to load location intel.
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </aside>
          </section>
        </div>
      </div>
    </div>
  );
}
