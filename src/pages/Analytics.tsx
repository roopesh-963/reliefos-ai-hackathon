import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Brain,
  CalendarRange,
  CloudDownload,
  FileDown,
  Filter,
  MapPinned,
  Package,
  Play,
  RefreshCw,
  ShieldAlert,
  Signal,
  TimerReset,
  TrendingUp,
  Users,
  Waves,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bar,
  BarChart,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '../lib/utils';
import { BackToDashboardButton } from '../components/navigation/BackToDashboardButton';
import { GeoIntelligenceMap } from '../components/analytics/GeoIntelligenceMap';
import { AnalyticsHeroScene } from '../components/analytics/AnalyticsHeroScene';
import {
  AnalyticsFilters,
  AnalyticsGroupBy,
  AnalyticsInsight,
  AnalyticsInsights,
  AnalyticsOverview,
  AnalyticsRange,
  IncidentTrendPoint,
  ResourceUsagePoint,
  ResponseTimePoint,
  SeverityPoint,
  getAnalyticsIncidentsTrend,
  getAnalyticsInsights,
  getAnalyticsOverview,
  getAnalyticsResponseTimes,
  getAnalyticsResources,
  getAnalyticsSeverity,
} from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { useSocket } from '../hooks/useSocket';

const CRISIS_TYPES = ['all', 'flood', 'fire', 'medical', 'earthquake', 'food', 'fuel'] as const;
const RANGE_OPTIONS: Array<{ label: string; value: AnalyticsRange }> = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'Custom Date Range', value: 'custom' },
];
const METRIC_COLORS = ['#22d3ee', '#3b82f6', '#f97316', '#facc15', '#ef4444', '#8b5cf6'];
const TREND_COLORS = {
  total: '#22d3ee',
  resolved: '#34d399',
  critical: '#f97316',
  response: '#8b5cf6',
};

const defaultOverview: AnalyticsOverview = {
  period: {
    label: 'Last 7 Days',
    startDate: new Date().toISOString(),
    endDate: new Date().toISOString(),
  },
  metrics: {
    totalIncidents: 0,
    activeEmergencies: 0,
    avgResponseTime: 0,
    resolutionRate: 0,
    livesAssisted: 0,
    resourcesDeployed: 0,
  },
  deltas: {
    totalIncidents: 0,
    activeEmergencies: 0,
    avgResponseTime: 0,
    resolutionRate: 0,
    livesAssisted: 0,
    resourcesDeployed: 0,
  },
  context: {
    activeTeams: 0,
    activeAlerts: 0,
    trackedRegions: 0,
    trackedCrisisTypes: 0,
  },
  geoIntelligence: {
    clusters: [],
    frequentIncidents: [],
    delayedZones: [],
    affectedClusters: [],
  },
  lastUpdated: new Date().toISOString(),
};

const defaultInsights: AnalyticsInsights = {
  generatedAt: new Date().toISOString(),
  period: defaultOverview.period,
  insights: [],
  geoIntelligence: defaultOverview.geoIntelligence,
};

const chartTooltipStyle = {
  backgroundColor: 'rgba(8, 16, 28, 0.96)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '16px',
  boxShadow: '0 24px 80px rgba(0, 0, 0, 0.45)',
};

const formatPercent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

const quoteCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const blobDownload = (content: string, filename: string, type = 'text/plain;charset=utf-8') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const getErrorStatus = (error: unknown) => {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const maybeResponse = (error as { response?: { status?: number } }).response;
  return typeof maybeResponse?.status === 'number' ? maybeResponse.status : null;
};

function AnimatedNumber({
  value,
  formatter,
}: {
  value: number;
  formatter?: (value: number) => string;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    const from = previousValue.current;
    const to = value;
    previousValue.current = value;

    if (from === to) {
      setDisplayValue(to);
      return;
    }

    let frame = 0;
    const duration = 700;
    const start = performance.now();

    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(from + (to - from) * eased);
      if (progress < 1) {
        frame = window.requestAnimationFrame(step);
      }
    };

    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return <>{formatter ? formatter(displayValue) : Math.round(displayValue).toLocaleString()}</>;
}

function AnalyticsCard({
  label,
  value,
  delta,
  icon: Icon,
  accent,
  inverse = false,
}: {
  label: string;
  value: number;
  delta: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  inverse?: boolean;
}) {
  const positive = inverse ? delta <= 0 : delta >= 0;
  const badgeTone = positive
    ? 'text-emerald-100 border-emerald-400/20 bg-emerald-500/10'
    : 'text-amber-100 border-amber-400/20 bg-amber-500/10';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45 }}
      className="relief-panel relative overflow-hidden rounded-[1.5rem] p-5"
    >
      <div className={cn('absolute inset-0 opacity-60 blur-3xl', accent)} />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.28em] text-gray-300">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-300" />
            Live KPI
          </div>
          <div className="text-3xl font-bold tracking-tight text-white">
            <AnimatedNumber
              value={value}
              formatter={(num) => (label.includes('Rate') || label.includes('Time') ? num.toFixed(1) : Math.round(num).toLocaleString())}
            />
            {label.includes('Time') && <span className="ml-2 text-sm font-semibold text-gray-400">min</span>}
            {label.includes('Rate') && <span className="ml-2 text-sm font-semibold text-gray-400">%</span>}
          </div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-gray-400">{label}</div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className={cn('p-3', accent, 'bg-white/5')}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold', badgeTone)}>
            {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {formatPercent(delta)}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Analytics() {
  const { addNotification } = useNotifications();
  const { joinDashboard, on } = useSocket();

  const [overview, setOverview] = useState<AnalyticsOverview>(defaultOverview);
  const [trend, setTrend] = useState<IncidentTrendPoint[]>([]);
  const [responseTimes, setResponseTimes] = useState<ResponseTimePoint[]>([]);
  const [resources, setResources] = useState<ResourceUsagePoint[]>([]);
  const [severity, setSeverity] = useState<SeverityPoint[]>([]);
  const [insights, setInsights] = useState<AnalyticsInsights>(defaultInsights);
  const [loading, setLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState<AnalyticsRange>('7d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedCrisisType, setSelectedCrisisType] = useState<'all' | string>('all');
  const [responseGroupBy, setResponseGroupBy] = useState<AnalyticsGroupBy>('region');
  const [refreshToken, setRefreshToken] = useState(0);
  const [accessDenied, setAccessDenied] = useState(false);
  const [authExpired, setAuthExpired] = useState(false);

  const refreshTimeout = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const filterParams = useMemo<AnalyticsFilters>(
    () => ({
      range: selectedRange,
      startDate: selectedRange === 'custom' ? startDate || undefined : undefined,
      endDate: selectedRange === 'custom' ? endDate || undefined : undefined,
      region: selectedRegion !== 'all' ? selectedRegion : undefined,
      crisisType: selectedCrisisType !== 'all' ? selectedCrisisType : undefined,
    }),
    [selectedRange, startDate, endDate, selectedRegion, selectedCrisisType]
  );

  const regionOptions = useMemo(() => {
    return Array.from(new Set(overview.geoIntelligence.clusters.map((cluster) => cluster.name))).filter(Boolean);
  }, [overview.geoIntelligence.clusters]);

  const loadAnalytics = async () => {
    const requestId = ++requestIdRef.current;

    try {
      if (isMountedRef.current) {
        setLoading(true);
        setAccessDenied(false);
        setAuthExpired(false);
      }

      const [overviewResult, trendResult, responseResult, resourcesResult, severityResult, insightsResult] =
        await Promise.allSettled([
          getAnalyticsOverview(filterParams),
          getAnalyticsIncidentsTrend(filterParams),
          getAnalyticsResponseTimes({ ...filterParams, groupBy: responseGroupBy }),
          getAnalyticsResources(filterParams),
          getAnalyticsSeverity(filterParams),
          getAnalyticsInsights(filterParams),
        ]);

      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      const rejectedReasons = [
        overviewResult,
        trendResult,
        responseResult,
        resourcesResult,
        severityResult,
        insightsResult,
      ]
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => result.reason);

      const hasForbiddenError = rejectedReasons.some((reason) => getErrorStatus(reason) === 403);
      const hasUnauthorizedError = rejectedReasons.some((reason) => getErrorStatus(reason) === 401);

      if (hasForbiddenError) {
        setAccessDenied(true);
      }

      if (hasUnauthorizedError) {
        setAuthExpired(true);
      }

      if (overviewResult.status === 'fulfilled') {
        setOverview(overviewResult.value);
      } else {
        console.error('Overview fetch failed:', overviewResult.reason);
        setOverview(defaultOverview);
      }

      setTrend(trendResult.status === 'fulfilled' ? trendResult.value : []);
      setResponseTimes(responseResult.status === 'fulfilled' ? responseResult.value : []);
      setResources(resourcesResult.status === 'fulfilled' ? resourcesResult.value : []);
      setSeverity(severityResult.status === 'fulfilled' ? severityResult.value : []);
      setInsights(insightsResult.status === 'fulfilled' ? insightsResult.value : defaultInsights);

      const failures = [
        overviewResult.status,
        trendResult.status,
        responseResult.status,
        resourcesResult.status,
        severityResult.status,
        insightsResult.status,
      ].filter((status) => status === 'rejected').length;

      if (failures > 0) {
        addNotification({
          type: hasForbiddenError || hasUnauthorizedError ? 'critical' : 'warning',
          title: hasForbiddenError
            ? 'Analytics access blocked'
            : hasUnauthorizedError
              ? 'Analytics session expired'
              : 'Analytics partially synced',
          message: hasForbiddenError
            ? 'Your account cannot access one or more analytics feeds right now.'
            : hasUnauthorizedError
              ? 'Analytics needs a valid session token. Sign in again to restore protected data feeds.'
              : 'Some live analytics streams are still loading, but the page will keep refreshing automatically.',
        });
      }
    } catch (error) {
      console.error('Analytics load failed:', error);
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      if (getErrorStatus(error) === 403) {
        setAccessDenied(true);
      }

      if (getErrorStatus(error) === 401) {
        setAuthExpired(true);
      }

      addNotification({
        type: 'critical',
        title: 'Analytics feed error',
        message: 'Unable to load analytics right now. The system will retry on the next refresh tick.',
      });
    } finally {
      if (isMountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;

    void loadAnalytics();
    return () => {
      isMountedRef.current = false;
    };
  }, [selectedRange, startDate, endDate, selectedRegion, selectedCrisisType, responseGroupBy, refreshToken]);

  useEffect(() => {
    joinDashboard();

    const events = [
      'new_sos',
      'sos_updated',
      'resource_added',
      'resource_updated',
      'resource_allocated',
      'resource_deployed',
      'new_alert',
    ];

    const unsubscribe = events.map((eventName) =>
      on(eventName, () => {
        if (refreshTimeout.current) {
          window.clearTimeout(refreshTimeout.current);
        }
        refreshTimeout.current = window.setTimeout(() => {
          setRefreshToken((value) => value + 1);
        }, 350);
      })
    );

    return () => {
      unsubscribe.forEach((dispose) => dispose());
      if (refreshTimeout.current) {
        window.clearTimeout(refreshTimeout.current);
      }
    };
  }, [joinDashboard, on]);

  const overviewCards = useMemo(
    () => [
      {
        label: 'Total Incidents',
        value: overview.metrics.totalIncidents,
        delta: overview.deltas.totalIncidents,
        icon: Activity,
        accent: 'bg-cyan-500/10',
        inverse: true,
      },
      {
        label: 'Active Emergencies',
        value: overview.metrics.activeEmergencies,
        delta: overview.deltas.activeEmergencies,
        icon: ShieldAlert,
        accent: 'bg-red-500/10',
        inverse: true,
      },
      {
        label: 'Avg Response Time',
        value: overview.metrics.avgResponseTime,
        delta: overview.deltas.avgResponseTime,
        icon: TimerReset,
        accent: 'bg-violet-500/10',
      },
      {
        label: 'Resolution Rate',
        value: overview.metrics.resolutionRate,
        delta: overview.deltas.resolutionRate,
        icon: TrendingUp,
        accent: 'bg-emerald-500/10',
      },
      {
        label: 'Lives Assisted',
        value: overview.metrics.livesAssisted,
        delta: overview.deltas.livesAssisted,
        icon: Users,
        accent: 'bg-amber-500/10',
      },
      {
        label: 'Resources Deployed',
        value: overview.metrics.resourcesDeployed,
        delta: overview.deltas.resourcesDeployed,
        icon: Package,
        accent: 'bg-blue-500/10',
      },
    ],
    [overview]
  );

  const severityData = severity.length > 0 ? severity : [
    { name: 'Low', value: 0 },
    { name: 'Medium', value: 0 },
    { name: 'Critical', value: 0 },
  ];

  const trendData = trend.length > 0 ? trend : [];
  const responseData = responseTimes.length > 0 ? responseTimes : [];
  const resourceData = resources.length > 0 ? resources : [];
  const funnelData = useMemo(() => {
    const received = overview.metrics.totalIncidents;
    const resolved = Math.round((overview.metrics.resolutionRate / 100) * overview.metrics.totalIncidents);
    const enRoute = Math.max(Math.round(overview.metrics.totalIncidents * 0.55), resolved);
    const assigned = Math.max(Math.round(overview.metrics.totalIncidents * 0.75), enRoute);

    return [
      { name: 'Received', value: received },
      { name: 'Assigned', value: assigned },
      { name: 'En Route', value: enRoute },
      { name: 'Resolved', value: resolved },
    ];
  }, [overview.metrics, responseTimes]);

  const exportPayload = useMemo(() => {
    const rows: Array<Array<string | number>> = [];

    rows.push(['section', 'name', 'value', 'meta']);
    rows.push(['kpi', 'Total Incidents', overview.metrics.totalIncidents, overview.period.label]);
    rows.push(['kpi', 'Active Emergencies', overview.metrics.activeEmergencies, overview.period.label]);
    rows.push(['kpi', 'Avg Response Time', overview.metrics.avgResponseTime, overview.period.label]);
    rows.push(['kpi', 'Resolution Rate', overview.metrics.resolutionRate, overview.period.label]);
    rows.push(['kpi', 'Lives Assisted', overview.metrics.livesAssisted, overview.period.label]);
    rows.push(['kpi', 'Resources Deployed', overview.metrics.resourcesDeployed, overview.period.label]);
    rows.push(['section', 'name', 'value', 'meta']);
    trendData.forEach((row) => rows.push(['trend', row.name, row.total, `resolved:${row.resolved}|critical:${row.critical}`]));
    rows.push(['section', 'name', 'value', 'meta']);
    responseData.forEach((row) => rows.push(['response', row.name, row.avgMinutes, `incidents:${row.incidents}|resolvedRate:${row.resolvedRate}`]));
    rows.push(['section', 'name', 'value', 'meta']);
    resourceData.forEach((row) => rows.push(['resources', row.name, row.value, `allocated:${row.allocated}|deployed:${row.deployed}|stock:${row.stock}`]));
    rows.push(['section', 'name', 'value', 'meta']);
    severityData.forEach((row) => rows.push(['severity', row.name, row.value, '']));
    rows.push(['section', 'name', 'value', 'meta']);
    insights.insights.forEach((item) => rows.push(['insight', item.title, item.tone, item.message]));

    return rows.map((row) => row.map(quoteCsv).join(',')).join('\n');
  }, [overview, trendData, responseData, resourceData, severityData, insights]);

  const handleExportCsv = () => {
    blobDownload(exportPayload, `reliefos-analytics-${selectedRange}.csv`, 'text/csv;charset=utf-8');
  };

  const handleDownloadReport = () => {
    const report = [
      `ReliefOS AI Analytics Report`,
      `Period: ${overview.period.label}`,
      `Generated: ${new Date(overview.lastUpdated).toLocaleString()}`,
      '',
      `KPIs`,
      `- Total Incidents: ${overview.metrics.totalIncidents}`,
      `- Active Emergencies: ${overview.metrics.activeEmergencies}`,
      `- Avg Response Time: ${overview.metrics.avgResponseTime.toFixed(1)} min`,
      `- Resolution Rate: ${overview.metrics.resolutionRate.toFixed(1)}%`,
      `- Lives Assisted: ${overview.metrics.livesAssisted}`,
      `- Resources Deployed: ${overview.metrics.resourcesDeployed}`,
      '',
      `Insights`,
      ...insights.insights.map((item) => `- [${item.tone}] ${item.title}: ${item.message}`),
      '',
      `Geo Intelligence`,
      ...overview.geoIntelligence.frequentIncidents.map(
        (cluster) => `- ${cluster.name}: ${cluster.incidents} incidents, avg response ${cluster.avgResponseMinutes}m`
      ),
    ].join('\n');

    blobDownload(report, `reliefos-analytics-report-${selectedRange}.md`, 'text/markdown;charset=utf-8');
  };

  const handleExportPdf = () => {
    const html = `
      <!doctype html>
      <html>
        <head>
          <title>ReliefOS AI Analytics Report</title>
          <style>
            body { font-family: Inter, Arial, sans-serif; margin: 32px; background: #07111f; color: #e5eefb; }
            h1, h2, h3 { color: #fff; }
            .card { border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 16px; margin-bottom: 16px; background: rgba(12,18,30,0.92); }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            td, th { padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.08); text-align: left; }
          </style>
        </head>
        <body>
          <h1>ReliefOS AI Analytics Report</h1>
          <div class="card">
            <h2>KPIs</h2>
            <table>
              <tr><th>Metric</th><th>Value</th></tr>
              <tr><td>Total Incidents</td><td>${overview.metrics.totalIncidents}</td></tr>
              <tr><td>Active Emergencies</td><td>${overview.metrics.activeEmergencies}</td></tr>
              <tr><td>Avg Response Time</td><td>${overview.metrics.avgResponseTime.toFixed(1)} min</td></tr>
              <tr><td>Resolution Rate</td><td>${overview.metrics.resolutionRate.toFixed(1)}%</td></tr>
              <tr><td>Lives Assisted</td><td>${overview.metrics.livesAssisted}</td></tr>
              <tr><td>Resources Deployed</td><td>${overview.metrics.resourcesDeployed}</td></tr>
            </table>
          </div>
          <div class="card">
            <h2>Insights</h2>
            ${insights.insights.map((item) => `<p><strong>${item.title}</strong><br/>${item.message}</p>`).join('')}
          </div>
          <div class="card">
            <h2>Geo Intelligence</h2>
            <table>
              <tr><th>Zone</th><th>Incidents</th><th>Avg Response</th><th>Type</th></tr>
              ${overview.geoIntelligence.frequentIncidents
                .map(
                  (cluster) =>
                    `<tr><td>${cluster.name}</td><td>${cluster.incidents}</td><td>${cluster.avgResponseMinutes}m</td><td>${cluster.dominantCrisisType}</td></tr>`
                )
                .join('')}
            </table>
          </div>
        </body>
      </html>
    `;

    const popup = window.open('', '_blank', 'width=1280,height=900');
    if (!popup) {
      addNotification({
        type: 'warning',
        title: 'Popup blocked',
        message: 'Enable popups to export the PDF report.',
      });
      return;
    }

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    setTimeout(() => popup.print(), 400);
  };

  return (
    <div className="relief-page pb-8 text-white">
      <div className="relief-orb left-[8%] top-[8%] h-80 w-80 bg-[rgba(255,96,62,0.14)]" />
      <div className="relief-orb right-[6%] top-[14%] h-72 w-72 bg-[rgba(139,0,0,0.18)]" />
      <div className="dashboard-particles absolute inset-0 opacity-22" />

      <div className="relative z-10 space-y-6 px-4 py-5 sm:px-6 sm:py-6">
      <div>
        <BackToDashboardButton />
      </div>
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="relief-panel relative overflow-hidden rounded-[1.9rem] bg-[radial-gradient(circle_at_top_left,rgba(255,118,78,0.16),transparent_35%),radial-gradient(circle_at_top_right,rgba(139,0,0,0.16),transparent_30%),linear-gradient(180deg,rgba(32,16,14,0.72),rgba(16,10,10,0.58))] p-2 sm:p-3"
      >
        <div className="absolute inset-0 pointer-events-none opacity-30 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="relative z-10 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.1fr)_480px] xl:items-center">
          <div className="max-w-4xl space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-cyan-100">
              <Signal className="w-3 h-3" />
              ReliefOS AI Command Center
            </div>
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">Analytics Mission Control</h1>
              <p className="mt-4 max-w-3xl text-sm sm:text-base text-gray-300 leading-relaxed">
                Monitor crisis throughput, response efficiency, resource pressure, and regional clusters from a more cinematic live command view. Telemetry refreshes from backend data and socket events without losing the analytics surface.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusChip label={overview.period.label} tone="cyan" icon={CalendarRange} />
              <StatusChip label={`${overview.context.activeTeams} active teams`} tone="emerald" icon={Users} />
              <StatusChip label={`${overview.context.activeAlerts} active alerts`} tone="amber" icon={ShieldAlert} />
              <StatusChip label={loading ? 'Syncing telemetry' : 'Real-time online'} tone="violet" icon={loading ? RefreshCw : Signal} />
              <StatusChip label={`Updated ${new Date(overview.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`} tone="violet" icon={RefreshCw} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm max-w-[460px]">
              <ActionButton label="Export CSV" icon={CloudDownload} onClick={handleExportCsv} />
              <ActionButton label="Export PDF" icon={FileDown} onClick={handleExportPdf} />
              <ActionButton label="Download Report" icon={Play} onClick={handleDownloadReport} />
              <ActionButton label="Refresh" icon={RefreshCw} onClick={() => setRefreshToken((value) => value + 1)} />
            </div>
          </div>

          <div className="relative h-[300px] overflow-hidden bg-[linear-gradient(180deg,rgba(10,18,31,0.3),rgba(10,18,31,0.08))]">
            <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-white/42">3D Telemetry View</div>
                <div className="mt-1 text-sm font-semibold text-white">Signal mesh and response flow</div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-cyan-100">
                <TrendingUp className="w-3 h-3" />
                Live
              </div>
            </div>
            <AnalyticsHeroScene />
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="p-1 sm:p-2"
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full xl:w-auto">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedRange(option.value)}
                className={cn(
                  'rounded-2xl px-4 py-3 text-left transition-all',
                  selectedRange === option.value
                    ? 'bg-cyan-500/10 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]'
                    : 'bg-white/5 text-gray-300 hover:bg-white/8'
                )}
              >
                <div className="text-[10px] uppercase tracking-[0.25em] font-mono opacity-70">Range</div>
                <div className="mt-1 text-sm font-semibold">{option.label}</div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <FilterPill label="Region" icon={MapPinned}>
              <select
                value={selectedRegion}
                onChange={(event) => setSelectedRegion(event.target.value)}
                className="w-full bg-transparent text-sm text-white outline-none"
              >
                <option value="all">All Regions</option>
                {regionOptions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </FilterPill>

            <FilterPill label="Crisis Type" icon={Waves}>
              <select
                value={selectedCrisisType}
                onChange={(event) => setSelectedCrisisType(event.target.value)}
                className="w-full bg-transparent text-sm text-white outline-none capitalize"
              >
                {CRISIS_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type === 'all' ? 'All Crisis Types' : type}
                  </option>
                ))}
              </select>
            </FilterPill>

            <FilterPill label="Response Lens" icon={BarChart3}>
              <div className="flex gap-1">
                {(['region', 'crisisType'] as AnalyticsGroupBy[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setResponseGroupBy(option)}
                    className={cn(
                      'rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition-all',
                      responseGroupBy === option
                        ? 'bg-cyan-500/15 text-cyan-100'
                        : 'bg-white/5 text-gray-300'
                    )}
                  >
                    {option === 'region' ? 'Zone' : 'Crisis'}
                  </button>
                ))}
              </div>
            </FilterPill>
          </div>
        </div>

        <AnimatePresence>
          {selectedRange === 'custom' && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              <label className="rounded-2xl bg-black/20 px-4 py-3 backdrop-blur-md">
                <span className="block text-[10px] uppercase tracking-[0.25em] text-gray-400 font-mono mb-2">
                  Start Date
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="w-full bg-transparent text-white outline-none"
                />
              </label>
              <label className="rounded-2xl bg-black/20 px-4 py-3 backdrop-blur-md">
                <span className="block text-[10px] uppercase tracking-[0.25em] text-gray-400 font-mono mb-2">
                  End Date
                </span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="w-full bg-transparent text-white outline-none"
                />
              </label>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {authExpired && (
        <section className="bg-amber-500/10 px-5 py-4 text-sm text-amber-50">
          Analytics needs a valid session before protected metrics can load. Sign in again on the landing page, then reopen this dashboard tab.
        </section>
      )}

      {accessDenied && (
        <section className="bg-red-500/10 px-5 py-4 text-sm text-red-50">
          Analytics access is blocked for this account. Sign back in with a role that has analytics visibility, or refresh if your permissions were just updated.
        </section>
      )}

      {!accessDenied && !loading && overview.metrics.totalIncidents === 0 && (
        <section className="bg-cyan-500/10 px-5 py-4 text-sm text-cyan-50">
          Live analytics is connected, but there are no SOS incidents in the current dataset yet. Create or seed incidents to populate the trend, severity, geo-intelligence, and insight panels.
        </section>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {overviewCards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * index }}
          >
            <AnalyticsCard
              label={card.label}
              value={card.value}
              delta={card.delta}
              icon={card.icon}
              accent={card.accent}
              inverse={card.inverse}
            />
          </motion.div>
        ))}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Panel className="xl:col-span-8" title="Incident Trend" subtitle="Reports over time">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-gray-300">
              <Zap className="w-3 h-3 text-cyan-200" />
              {overview.period.label}
            </div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-gray-500 font-mono">
              Total {overview.metrics.totalIncidents} / Resolved {overview.metrics.resolutionRate.toFixed(1)}%
            </div>
          </div>
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <XAxis dataKey="name" stroke="#74809a" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#74809a" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="total" stroke={TREND_COLORS.total} strokeWidth={2.6} dot={false} />
                <Line type="monotone" dataKey="resolved" stroke={TREND_COLORS.resolved} strokeWidth={2.4} dot={false} />
                <Line type="monotone" dataKey="critical" stroke={TREND_COLORS.critical} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="xl:col-span-4" title="Resolution Funnel" subtitle="Received to resolved">
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip contentStyle={chartTooltipStyle} />
                <Funnel dataKey="value" data={funnelData} isAnimationActive>
                  {funnelData.map((entry, index) => (
                    <Cell key={entry.name} fill={METRIC_COLORS[index % METRIC_COLORS.length]} />
                  ))}
                  <LabelList position="right" fill="#fff" stroke="none" dataKey="name" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="xl:col-span-8" title="Response Time by" subtitle={responseGroupBy === 'region' ? 'Zone' : 'Crisis Type'}>
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={responseData}>
                <XAxis dataKey="name" stroke="#74809a" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#74809a" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="avgMinutes" radius={[10, 10, 0, 0]} fill={TREND_COLORS.response} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="xl:col-span-4" title="Severity Distribution" subtitle="Low, medium, critical">
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={severityData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={6}>
                  {severityData.map((entry, index) => (
                    <Cell key={entry.name} fill={METRIC_COLORS[index % METRIC_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="xl:col-span-6" title="Resource Usage" subtitle="Food, water, medicine, fuel">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={resourceData} dataKey="value" nameKey="name" innerRadius={72} outerRadius={108} paddingAngle={4}>
                  {resourceData.map((entry, index) => (
                    <Cell key={entry.name} fill={METRIC_COLORS[index % METRIC_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-300">
            {resourceData.map((item) => (
              <div key={item.name} className="bg-white/5 px-3 py-2">
                <div className="uppercase tracking-[0.25em] text-[9px] text-gray-500">{item.name}</div>
                <div className="mt-1 text-white font-semibold">{item.value.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="xl:col-span-6" title="AI Insights" subtitle="Rule-based intelligence">
          <div className="space-y-3">
            {insights.insights.length > 0 ? (
              insights.insights.map((insight, index) => (
                <InsightCard key={`${insight.title}-${index}`} insight={insight} />
              ))
            ) : (
              <div className="bg-white/5 p-4 text-sm text-gray-300">
                Insights will appear once live data is available.
              </div>
            )}
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-8">
          <Panel title="Geo Intelligence" subtitle="Frequent incidents, delayed zones, and affected clusters">
            <GeoIntelligenceMap clusters={overview.geoIntelligence.clusters} />
          </Panel>
        </div>

        <div className="xl:col-span-4 space-y-4">
          <Panel title="Frequent Incidents" subtitle="Top pressure zones">
            <div className="space-y-2.5">
              {overview.geoIntelligence.frequentIncidents.length > 0 ? (
                overview.geoIntelligence.frequentIncidents.map((cluster) => (
                  <GeoListItem
                    key={cluster.name}
                    name={cluster.name}
                    value={`${cluster.incidents} incidents`}
                    meta={`${cluster.avgResponseMinutes}m avg response | ${cluster.dominantCrisisType}`}
                    tone="cyan"
                  />
                ))
              ) : (
                <EmptyState message="No clusters available yet." />
              )}
            </div>
          </Panel>

          <Panel title="Delayed Zones" subtitle="Zones that need intervention">
            <div className="space-y-2.5">
              {overview.geoIntelligence.delayedZones.length > 0 ? (
                overview.geoIntelligence.delayedZones.map((cluster) => (
                  <GeoListItem
                    key={cluster.name}
                    name={cluster.name}
                    value={`${cluster.avgResponseMinutes}m`}
                    meta={`${cluster.incidents} incidents | ${cluster.dominantCrisisType}`}
                    tone="red"
                  />
                ))
              ) : (
                <EmptyState message="No delayed zones detected." />
              )}
            </div>
          </Panel>
        </div>
      </section>
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  className,
  children,
}: React.PropsWithChildren<{
  title: string;
  subtitle?: string;
  className?: string;
}>) {
  return (
    <div
      className={cn(
        'relief-panel rounded-[1.6rem] p-5',
        className
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold tracking-tight text-white">{title}</div>
          {subtitle && <div className="mt-1 text-[10px] uppercase tracking-[0.28em] text-gray-500">{subtitle}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function StatusChip({
  label,
  tone,
  icon: Icon,
}: {
  label: string;
  tone: 'cyan' | 'emerald' | 'amber' | 'violet';
  icon: React.ComponentType<{ className?: string }>;
}) {
  const tones = {
    cyan: 'border-cyan-300/20 bg-cyan-500/10 text-cyan-100',
    emerald: 'border-emerald-300/20 bg-emerald-500/10 text-emerald-100',
    amber: 'border-amber-300/20 bg-amber-500/10 text-amber-100',
    violet: 'border-violet-300/20 bg-violet-500/10 text-violet-100',
  } as const;

  return (
    <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.25em]', tones[tone])}>
      <Icon className="w-3 h-3" />
      {label}
    </div>
  );
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relief-button-secondary inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all"
    >
      <Icon className="w-4 h-4 text-cyan-200" />
      {label}
    </button>
  );
}

function FilterPill({
  label,
  icon: Icon,
  children,
}: React.PropsWithChildren<{
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}>) {
  return (
    <label className="relief-card min-w-[190px] rounded-2xl px-4 py-3">
      <span className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-gray-400 font-mono">
        <Icon className="w-3 h-3 text-cyan-200" />
        {label}
      </span>
      {children}
    </label>
  );
}

function InsightCard({ insight }: { insight: AnalyticsInsight }) {
  const toneStyles = {
    critical: 'border-red-400/20 bg-red-500/10 text-red-100',
    warning: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
    success: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100',
    info: 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100',
  } as const;

  return (
    <div className={cn('relief-card rounded-[1.25rem] p-4', toneStyles[insight.tone])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] font-mono opacity-75">{insight.tone}</div>
          <div className="mt-1 text-sm font-semibold text-white">{insight.title}</div>
        </div>
        <Brain className="w-4 h-4 shrink-0 opacity-80" />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-white/90">{insight.message}</p>
    </div>
  );
}

function GeoListItem({
  name,
  value,
  meta,
  tone,
}: {
  name: string;
  value: string;
  meta: string;
  tone: 'cyan' | 'red';
}) {
  const tones = {
    cyan: 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100',
    red: 'border-red-400/20 bg-red-500/10 text-red-100',
  } as const;

  return (
    <div className={cn('relief-card rounded-[1rem] px-3 py-3', tones[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{name}</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-white/60">{meta}</div>
        </div>
        <div className="text-sm font-semibold text-white">{value}</div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="relief-card rounded-[1rem] px-3 py-3 text-sm text-gray-400">{message}</div>;
}
