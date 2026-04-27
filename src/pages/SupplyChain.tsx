import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Brain,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Filter,
  MapPinned,
  PackagePlus,
  Search,
  ShieldAlert,
  Trash2,
  Truck,
  Warehouse,
  Waves,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ExplainableOperationsStack } from '../components/ai/ExplainableOperationsStack';
import { BackToDashboardButton } from '../components/navigation/BackToDashboardButton';
import { TacticalMap, TacticalMarker, TacticalRoute } from '../components/TacticalMap';
import { cn } from '../lib/utils';
import {
  createShipment,
  deleteShipment,
  getAssistantContext,
  getCurrentUser,
  getShipments,
  getSupplyAnalytics,
  getWarehouses,
  rerouteShipment,
  Shipment,
  ShipmentDestinationType,
  ShipmentPayload,
  ShipmentPriority,
  ShipmentResourceType,
  ShipmentStatus,
  SupplyAnalytics,
  updateShipment,
  WarehouseSummary,
} from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { useSocket } from '../hooks/useSocket';

const KPI_CARD_STYLES = [
  'from-cyan-500/20 via-cyan-500/5 to-transparent',
  'from-emerald-500/18 via-emerald-500/5 to-transparent',
  'from-orange-500/18 via-orange-500/5 to-transparent',
  'from-blue-500/18 via-blue-500/5 to-transparent',
  'from-red-500/18 via-red-500/5 to-transparent',
  'from-violet-500/18 via-violet-500/5 to-transparent',
];
const STATUS_COLORS = ['#22d3ee', '#34d399', '#f97316', '#8b5cf6', '#3b82f6'];
const PRIORITY_COLORS = ['#ef4444', '#f97316', '#22d3ee', '#9ca3af'];
const RESOURCE_TYPES: ShipmentResourceType[] = ['Medicine', 'Food', 'Water', 'Fuel', 'Equipment', 'Blankets', 'Ambulance'];
const PRIORITIES: ShipmentPriority[] = ['Critical', 'High', 'Medium', 'Low'];
const DESTINATION_TYPES: ShipmentDestinationType[] = ['Shelter', 'Camp', 'Clinic', 'Zone', 'Warehouse'];

const defaultAnalytics: SupplyAnalytics = {
  summary: {
    activeShipments: 0,
    deliveredToday: 0,
    delayedDeliveries: 0,
    avgEtaMinutes: 0,
    avgEtaLabel: '0 min',
    criticalRoutes: 0,
    warehouseCapacity: 0,
  },
  byStatus: [],
  byPriority: [],
  insights: [],
};

const initialForm = (): ShipmentPayload => ({
  resourceType: 'Medicine',
  quantity: 50,
  unit: 'units',
  from: '',
  to: '',
  vehicle: '',
  driver: '',
  etaMinutes: 90,
  priority: 'High',
  destinationType: 'Shelter',
  notes: '',
});

const statusTone = (status: ShipmentStatus) => {
  if (status === 'Delivered') {
    return 'text-emerald-100 border-emerald-400/20 bg-emerald-500/10';
  }
  if (status === 'Delayed') {
    return 'text-orange-100 border-orange-400/20 bg-orange-500/10';
  }
  if (status === 'Rerouted') {
    return 'text-violet-100 border-violet-400/20 bg-violet-500/10';
  }
  if (status === 'In Transit') {
    return 'text-cyan-100 border-cyan-400/20 bg-cyan-500/10';
  }
  return 'text-gray-100 border-white/10 bg-white/5';
};

const priorityTone = (priority: ShipmentPriority) => {
  if (priority === 'Critical') {
    return 'text-red-100 bg-red-500/10';
  }
  if (priority === 'High') {
    return 'text-orange-100 bg-orange-500/10';
  }
  if (priority === 'Medium') {
    return 'text-cyan-100 bg-cyan-500/10';
  }
  return 'text-gray-100 bg-white/10';
};

const formatAgo = (value?: string | null) => {
  if (!value) {
    return '--';
  }
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

const toPriorityRank = (priority: ShipmentPriority) =>
  priority === 'Critical' ? 0 : priority === 'High' ? 1 : priority === 'Medium' ? 2 : 3;

const resolveMarkerType = (value: 'critical' | 'warning' | 'stable'): TacticalMarker['type'] => value;

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="relief-panel relative overflow-hidden rounded-[1.5rem] p-5"
    >
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-90', accent)} />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.28em] text-gray-400">{title}</div>
          <div className="mt-3 text-3xl font-bold tracking-tight text-white">{value}</div>
          <div className="mt-2 text-xs text-gray-300">{detail}</div>
        </div>
        <div className="bg-white/5 p-3">
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </motion.section>
  );
}

function SectionShell({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="relief-panel rounded-[1.6rem] p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-white">{title}</h2>
          <p className="mt-1 text-sm text-gray-400">{subtitle}</p>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export default function SupplyChain() {
  const [searchParams] = useSearchParams();
  const currentUser = getCurrentUser();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([]);
  const [analytics, setAnalytics] = useState<SupplyAnalytics>(defaultAnalytics);
  const [assistantContext, setAssistantContext] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | ShipmentStatus>('All');
  const [priorityFilter, setPriorityFilter] = useState<'All' | ShipmentPriority>('All');
  const [sortMode, setSortMode] = useState<'delay' | 'priority'>('delay');
  const [form, setForm] = useState<ShipmentPayload>(initialForm);

  const { addNotification } = useNotifications();
  const { joinDashboard, on } = useSocket();
  const assistantSessionId = `supply-${currentUser?.id || currentUser?.email || 'operator'}`;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [shipmentResult, warehouseResult, analyticsResult, assistantResult] = await Promise.all([
        getShipments(),
        getWarehouses(),
        getSupplyAnalytics(),
        getAssistantContext({
          sessionId: assistantSessionId,
          role: currentUser?.role || 'admin',
          page: 'supply',
          mode: 'logistics',
        }),
      ]);

      setShipments(shipmentResult);
      setWarehouses(warehouseResult);
      setAnalytics(analyticsResult);
      setAssistantContext(assistantResult.context);
      if (!form.from && warehouseResult.length > 0) {
        setForm((current) => ({ ...current, from: warehouseResult[0].name }));
      }
    } catch (error) {
      console.error('Failed to load supply chain data:', error);
      addNotification({
        type: 'critical',
        title: 'Supply Grid Unavailable',
        message: 'Logistics telemetry could not be loaded. The system will keep retrying.',
      });
    } finally {
      setLoading(false);
    }
  }, [addNotification, assistantSessionId, currentUser?.role, form.from]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    joinDashboard();
    const events = [
      'shipment_created',
      'shipment_updated',
      'shipment_deleted',
      'shipment_rerouted',
      'warehouse_updated',
      'shipment_analytics_updated',
      'resource_updated',
    ];
    const unsubscribers = events.map((eventName) => on(eventName, () => void loadData()));
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [joinDashboard, on, loadData]);

  useEffect(() => {
    const assistantFilter = searchParams.get('assistantFilter');
    if (assistantFilter === 'delayed') {
      setStatusFilter('Delayed');
      setSortMode('delay');
    }
  }, [searchParams]);

  const filteredShipments = useMemo(() => {
    const term = search.trim().toLowerCase();
    const next = shipments.filter((shipment) => {
      const matchesSearch =
        term.length === 0 ||
        [
          shipment.shipmentId,
          shipment.resourceType,
          shipment.from,
          shipment.to,
          shipment.driver,
          shipment.vehicle,
        ].some((value) => value.toLowerCase().includes(term));
      const matchesStatus = statusFilter === 'All' || shipment.status === statusFilter;
      const matchesPriority = priorityFilter === 'All' || shipment.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });

    next.sort((a, b) => {
      if (sortMode === 'delay') {
        const delayScoreA = a.status === 'Delayed' ? 0 : a.routeState === 'Blocked' ? 1 : 2;
        const delayScoreB = b.status === 'Delayed' ? 0 : b.routeState === 'Blocked' ? 1 : 2;
        if (delayScoreA !== delayScoreB) {
          return delayScoreA - delayScoreB;
        }
        return b.etaMinutes - a.etaMinutes;
      }
      return toPriorityRank(a.priority) - toPriorityRank(b.priority);
    });

    return next;
  }, [shipments, search, statusFilter, priorityFilter, sortMode]);

  const mapMarkers = useMemo<TacticalMarker[]>(() => {
    const warehouseMarkers = warehouses.map((warehouse) => ({
      id: warehouse.id,
      position: [warehouse.location.lat, warehouse.location.lng] as [number, number],
      label: warehouse.name,
      type: resolveMarkerType(warehouse.lowStockWarnings.length > 0 ? 'warning' : 'stable'),
      role: 'warehouse' as const,
      meta: `${warehouse.fillPercent}% capacity`,
    }));

    const vehicleMarkers = filteredShipments.map((shipment) => ({
      id: shipment._id,
      position: [shipment.currentCoords.lat, shipment.currentCoords.lng] as [number, number],
      label: shipment.vehicle,
      type: resolveMarkerType(
        shipment.status === 'Delayed'
          ? 'warning'
          : shipment.priority === 'Critical'
            ? 'critical'
            : 'stable'
      ),
      role: 'vehicle' as const,
      meta: `${shipment.shipmentId} | ${shipment.etaLabel}`,
    }));

    const destinationMarkers = filteredShipments.map((shipment) => ({
      id: `${shipment._id}-dest`,
      position: [shipment.toCoords.lat, shipment.toCoords.lng] as [number, number],
      label: shipment.to,
      type: resolveMarkerType(shipment.routeState === 'Blocked' ? 'warning' : 'stable'),
      role:
        shipment.destinationType === 'Camp'
          ? ('camp' as const)
          : shipment.destinationType === 'Warehouse'
            ? ('depot' as const)
            : ('shelter' as const),
      meta: `${shipment.resourceType} drop`,
    }));

    return [...warehouseMarkers, ...destinationMarkers, ...vehicleMarkers];
  }, [filteredShipments, warehouses]);

  const mapRoutes = useMemo<TacticalRoute[]>(() => {
    return filteredShipments.map((shipment) => ({
      id: `${shipment._id}-route`,
      positions: shipment.routePath,
      type:
        shipment.routeState === 'Blocked'
          ? 'critical'
          : shipment.status === 'Delayed'
            ? 'warning'
            : 'stable',
      dashed: shipment.status === 'Rerouted' || shipment.routeState === 'Blocked',
      label: shipment.shipmentId,
    }));
  }, [filteredShipments]);

  const mapCenter = useMemo<[number, number]>(() => {
    const focus = filteredShipments[0]?.currentCoords || warehouses[0]?.location;
    return focus ? [focus.lat, focus.lng] : [20.5937, 78.9629];
  }, [filteredShipments, warehouses]);

  const warehouseOptions = useMemo(() => warehouses.map((warehouse) => warehouse.name), [warehouses]);

  const handleFieldChange = <K extends keyof ShipmentPayload>(key: K, value: ShipmentPayload[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submitShipment = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await createShipment(form);
      addNotification({
        type: 'success',
        title: 'Shipment Dispatched',
        message: `${form.resourceType} convoy assigned to ${form.to}.`,
      });
      setShowModal(false);
      setForm((current) => ({ ...initialForm(), from: current.from || warehouseOptions[0] || '' }));
      await loadData();
    } catch (error: any) {
      console.error('Create shipment failed:', error);
      addNotification({
        type: 'critical',
        title: 'Dispatch Rejected',
        message: error?.response?.data?.message || 'The shipment could not be created.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const markDelivered = async (shipment: Shipment) => {
    try {
      await updateShipment(shipment._id, { status: 'Delivered' });
      addNotification({
        type: 'success',
        title: `${shipment.shipmentId} delivered`,
        message: `${shipment.to} confirmed receipt of ${shipment.resourceType}.`,
      });
      await loadData();
    } catch (error) {
      console.error('Mark delivered failed:', error);
    }
  };

  const flagDelayed = async (shipment: Shipment) => {
    try {
      await updateShipment(shipment._id, {
        status: 'Delayed',
        etaMinutes: shipment.etaMinutes + 25,
        blockedReason: shipment.blockedReason || 'Road obstruction reported by field telemetry',
      });
      addNotification({
        type: 'warning',
        title: `${shipment.shipmentId} delayed`,
        message: 'ETA was extended and route risk is now visible across the logistics grid.',
      });
      await loadData();
    } catch (error) {
      console.error('Delay update failed:', error);
    }
  };

  const approveReroute = async (shipment: Shipment) => {
    try {
      await rerouteShipment(shipment._id, shipment.blockedReason || `Alternate corridor approved for ${shipment.to}`);
      addNotification({
        type: 'info',
        title: 'Reroute approved',
        message: `${shipment.shipmentId} is now moving on the alternate route.`,
      });
      await loadData();
    } catch (error) {
      console.error('Reroute failed:', error);
    }
  };

  const removeShipment = async (shipment: Shipment) => {
    if (!window.confirm(`Remove ${shipment.shipmentId} from the convoy board?`)) {
      return;
    }
    try {
      await deleteShipment(shipment._id);
      addNotification({
        type: 'info',
        title: 'Shipment removed',
        message: `${shipment.shipmentId} has been removed from active operations.`,
      });
      await loadData();
    } catch (error) {
      console.error('Delete shipment failed:', error);
    }
  };

  const kpis = [
    {
      title: 'Active Shipments',
      value: analytics.summary.activeShipments,
      detail: `${shipments.filter((shipment) => shipment.priority === 'Critical').length} critical lanes active`,
      icon: Truck,
    },
    {
      title: 'Delivered Today',
      value: analytics.summary.deliveredToday,
      detail: 'Completed drop-offs within the current command window',
      icon: CheckCircle2,
    },
    {
      title: 'Delayed Deliveries',
      value: analytics.summary.delayedDeliveries,
      detail: 'Convoys requiring intervention or alternate routing',
      icon: AlertTriangle,
    },
    {
      title: 'Avg ETA',
      value: analytics.summary.avgEtaLabel,
      detail: 'Across all non-delivered shipments',
      icon: Clock3,
    },
    {
      title: 'Critical Routes',
      value: analytics.summary.criticalRoutes,
      detail: 'Blocked corridors and critical-priority pressure',
      icon: ShieldAlert,
    },
    {
      title: 'Warehouse Capacity',
      value: `${analytics.summary.warehouseCapacity}%`,
      detail: 'Average utilization across active depots',
      icon: Warehouse,
    },
  ];

  return (
    <div className="relief-page pb-6 text-white">
      <div className="relief-orb left-[7%] top-[8%] h-80 w-80 bg-[rgba(255,98,62,0.14)]" />
      <div className="relief-orb right-[5%] top-[16%] h-72 w-72 bg-[rgba(139,0,0,0.18)]" />
      <div className="dashboard-particles absolute inset-0 opacity-22" />

      <div className="relative z-10 space-y-6 px-4 py-5 sm:px-6 sm:py-6">
      <div>
        <BackToDashboardButton />
      </div>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="relief-chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.3em]">
            <Waves className="h-3.5 w-3.5" />
            Logistics Command
          </div>
          <h1 className="relief-title mt-4 text-3xl font-bold tracking-tight text-white">Supply Chain / Logistics</h1>
          <p className="relief-muted mt-2 max-w-3xl text-sm">
            Track convoy movement, warehouse pressure, route disruptions, and AI dispatch recommendations from one live command layer.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setForm((current) => ({ ...current, from: current.from || warehouseOptions[0] || '' }));
            setShowModal(true);
          }}
          className="relief-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition"
        >
          <PackagePlus className="h-4 w-4" />
          Create Shipment
        </button>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpis.map((card, index) => (
          <MetricCard key={card.title} {...card} accent={KPI_CARD_STYLES[index % KPI_CARD_STYLES.length]} />
        ))}
      </section>

      <div className="space-y-6">
        <SectionShell
          title="Live Logistics Map"
          subtitle="Convoys, depots, shelters, and route exceptions in real time"
          actions={
            <div className="bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-gray-300">
              {filteredShipments.length} visible lanes
            </div>
          }
        >
          <div className="h-[460px] overflow-hidden">
            <TacticalMap center={mapCenter} zoom={4} markers={mapMarkers} routes={mapRoutes} showFaultLines={false} />
          </div>
        </SectionShell>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <SectionShell
              title="AI Optimization"
              subtitle="Live shortage forecast and dispatch recommendations from the logistics backend"
            >
              <div className="space-y-3">
                {assistantContext ? (
                  <>
                    <div className="bg-cyan-500/10 p-4 text-sm text-cyan-50">
                      {assistantContext.aiBriefing.dispatchHeadline}
                    </div>
                    <ExplainableOperationsStack
                      priorities={assistantContext.prioritizedIncidents}
                      shortages={assistantContext.shortagePredictions}
                      dispatches={assistantContext.dispatchRecommendations}
                      className="xl:grid-cols-2"
                    />
                  </>
                ) : analytics.insights.length === 0 ? (
                  <div className="bg-white/5 p-4 text-sm text-gray-400">
                    No optimization alerts are active right now.
                  </div>
                ) : (
                  analytics.insights.map((insight) => (
                    <div
                      key={insight.id}
                      className={cn(
                        'p-4',
                        insight.tone === 'critical'
                          ? 'bg-red-500/10'
                          : insight.tone === 'warning'
                            ? 'bg-orange-500/10'
                            : 'bg-cyan-500/10'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="bg-black/20 p-2">
                          <Brain className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white">{insight.title}</div>
                          <div className="mt-1 text-sm text-gray-300">{insight.message}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SectionShell>
          </div>

          <div className="xl:col-span-4">
            <SectionShell title="Flow Mix" subtitle="Current live status and priority distribution">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <div className="h-48 bg-black/20 p-3 backdrop-blur-md">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.byStatus}>
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        contentStyle={{
                          backgroundColor: 'rgba(8,16,28,0.96)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: '16px',
                        }}
                      />
                      <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                        {analytics.byStatus.map((entry, index) => (
                          <Cell key={entry.name} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-48 bg-black/20 p-3 backdrop-blur-md">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={analytics.byPriority} dataKey="value" nameKey="name" innerRadius={40} outerRadius={72}>
                        {analytics.byPriority.map((entry, index) => (
                          <Cell key={entry.name} fill={PRIORITY_COLORS[index % PRIORITY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(8,16,28,0.96)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: '16px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </SectionShell>
          </div>
        </div>
      </div>

      <SectionShell
        title="Shipment Board"
        subtitle="Search, filter, sort, and act on live convoy operations"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search shipment, vehicle, route..."
                className="w-72 rounded-2xl bg-black/20 py-2.5 pl-10 pr-3 text-sm text-white outline-none placeholder:text-gray-500 backdrop-blur-md"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'All' | ShipmentStatus)}
              className="rounded-2xl bg-black/20 px-3 py-2.5 text-sm text-white outline-none backdrop-blur-md"
            >
              <option value="All">All Status</option>
              <option value="Queued">Queued</option>
              <option value="In Transit">In Transit</option>
              <option value="Delayed">Delayed</option>
              <option value="Rerouted">Rerouted</option>
              <option value="Delivered">Delivered</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value as 'All' | ShipmentPriority)}
              className="rounded-2xl bg-black/20 px-3 py-2.5 text-sm text-white outline-none backdrop-blur-md"
            >
              <option value="All">All Priority</option>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSortMode((current) => (current === 'delay' ? 'priority' : 'delay'))}
              className="inline-flex items-center gap-2 rounded-2xl bg-black/20 px-3 py-2.5 text-sm text-gray-200 transition hover:bg-black/28 backdrop-blur-md"
            >
              <Filter className="h-4 w-4" />
              Sort {sortMode === 'delay' ? 'by delay' : 'by priority'}
            </button>
          </div>
        }
      >
        <div className="relief-card overflow-hidden rounded-[1.5rem]">
          <div className="max-h-[620px] overflow-auto">
            <table className="min-w-full divide-y divide-white/10 text-left">
              <thead className="bg-black/25">
                <tr>
                  {['Shipment ID', 'Resource Type', 'Quantity', 'From', 'To', 'Driver / Vehicle', 'Status', 'ETA', 'Priority', 'Actions'].map((header) => (
                    <th key={header} className="px-4 py-3 text-[10px] uppercase tracking-[0.24em] text-gray-400">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-[#08111d]/70">
                {filteredShipments.map((shipment) => (
                  <tr key={shipment._id} className="align-top transition hover:bg-white/[0.02]">
                    <td className="px-4 py-4 text-sm font-semibold text-white">{shipment.shipmentId}</td>
                    <td className="px-4 py-4 text-sm text-gray-200">{shipment.resourceType}</td>
                    <td className="px-4 py-4 text-sm text-gray-200">
                      {shipment.quantity} {shipment.unit}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-300">{shipment.from}</td>
                    <td className="px-4 py-4 text-sm text-gray-300">{shipment.to}</td>
                    <td className="px-4 py-4 text-sm text-gray-300">
                      <div>{shipment.driver}</div>
                      <div className="mt-1 text-xs text-gray-500">{shipment.vehicle}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-medium', statusTone(shipment.status))}>
                        {shipment.status}
                      </span>
                      {shipment.blockedReason && <div className="mt-2 max-w-[220px] text-xs text-orange-200">{shipment.blockedReason}</div>}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-200">{shipment.etaLabel}</td>
                    <td className="px-4 py-4">
                      <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-medium', priorityTone(shipment.priority))}>
                        {shipment.priority}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {shipment.status !== 'Delivered' && (
                          <button
                            type="button"
                            onClick={() => void markDelivered(shipment)}
                            className="inline-flex items-center gap-1 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-100"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Deliver
                          </button>
                        )}
                        {shipment.status !== 'Delayed' && shipment.status !== 'Delivered' && (
                          <button
                            type="button"
                            onClick={() => void flagDelayed(shipment)}
                            className="inline-flex items-center gap-1 rounded-xl border border-orange-400/20 bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-100"
                          >
                            <CalendarClock className="h-3.5 w-3.5" />
                            Delay
                          </button>
                        )}
                        {shipment.status !== 'Delivered' && (
                          <button
                            type="button"
                            onClick={() => void approveReroute(shipment)}
                            className="inline-flex items-center gap-1 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-100"
                          >
                            <MapPinned className="h-3.5 w-3.5" />
                            Reroute
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void removeShipment(shipment)}
                          className="inline-flex items-center gap-1 rounded-xl bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-200"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filteredShipments.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-400">
                      No shipments match the current search and filter set.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </SectionShell>

      <SectionShell title="Warehouse Network" subtitle="Depot-level stock pressure and capacity monitoring">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {warehouses.map((warehouse) => (
            <div
              key={warehouse.id}
              className="relief-card rounded-[1.35rem] p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white">{warehouse.name}</div>
                  <div className="mt-1 text-xs text-gray-500">Updated {formatAgo(warehouse.lastUpdated)}</div>
                </div>
                <div className="bg-white/5 px-3 py-1 text-xs text-cyan-100">
                  {warehouse.fillPercent}% full
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className={cn(
                    'h-full rounded-full',
                    warehouse.fillPercent >= 85 ? 'bg-red-500' : warehouse.fillPercent >= 65 ? 'bg-orange-500' : 'bg-cyan-500'
                  )}
                  style={{ width: `${warehouse.fillPercent}%` }}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {Object.entries(warehouse.stockLevels).map(([label, value]) => (
                  <div key={label} className="bg-white/5 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-gray-500">{label}</div>
                    <div className="mt-1 text-lg font-semibold text-white">{value}</div>
                  </div>
                ))}
              </div>

              {warehouse.lowStockWarnings.length > 0 && (
                <div className="mt-4 bg-orange-500/10 p-3 text-sm text-orange-100">
                  <div className="mb-2 flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    Low-stock warnings
                  </div>
                  <div className="space-y-1 text-xs text-orange-100/90">
                    {warehouse.lowStockWarnings.map((warning) => (
                      <div key={warning}>{warning}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionShell>

      {showModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm">
          <div className="relief-panel w-full max-w-3xl rounded-[2rem] p-6 shadow-[0_32px_120px_rgba(0,0,0,0.55)]">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-white">Create Shipment</div>
                <div className="mt-1 text-sm text-gray-400">Dispatch inventory from a warehouse to a live destination zone.</div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={submitShipment} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.22em] text-gray-400">Resource Type</span>
                  <select
                    value={form.resourceType}
                    onChange={(event) => handleFieldChange('resourceType', event.target.value as ShipmentResourceType)}
                    className="relief-input w-full rounded-2xl px-3 py-3 text-sm outline-none"
                  >
                    {RESOURCE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.22em] text-gray-400">Quantity</span>
                  <input
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={(event) => handleFieldChange('quantity', Number(event.target.value))}
                    className="relief-input w-full rounded-2xl px-3 py-3 text-sm outline-none"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.22em] text-gray-400">Unit</span>
                  <input
                    value={form.unit}
                    onChange={(event) => handleFieldChange('unit', event.target.value)}
                    className="relief-input w-full rounded-2xl px-3 py-3 text-sm outline-none"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.22em] text-gray-400">Source Warehouse</span>
                  <select
                    value={form.from}
                    onChange={(event) => handleFieldChange('from', event.target.value)}
                    className="relief-input w-full rounded-2xl px-3 py-3 text-sm outline-none"
                  >
                    <option value="">Select warehouse</option>
                    {warehouseOptions.map((warehouse) => (
                      <option key={warehouse} value={warehouse}>
                        {warehouse}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.22em] text-gray-400">Destination Zone</span>
                  <input
                    value={form.to}
                    onChange={(event) => handleFieldChange('to', event.target.value)}
                    placeholder="Zone C Shelter"
                    className="relief-input w-full rounded-2xl px-3 py-3 text-sm outline-none"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.22em] text-gray-400">Destination Type</span>
                  <select
                    value={form.destinationType}
                    onChange={(event) => handleFieldChange('destinationType', event.target.value as ShipmentDestinationType)}
                    className="relief-input w-full rounded-2xl px-3 py-3 text-sm outline-none"
                  >
                    {DESTINATION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.22em] text-gray-400">Priority</span>
                  <select
                    value={form.priority}
                    onChange={(event) => handleFieldChange('priority', event.target.value as ShipmentPriority)}
                    className="relief-input w-full rounded-2xl px-3 py-3 text-sm outline-none"
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.22em] text-gray-400">Vehicle</span>
                  <input
                    value={form.vehicle}
                    onChange={(event) => handleFieldChange('vehicle', event.target.value)}
                    placeholder="SC-204 / Med Truck"
                    className="relief-input w-full rounded-2xl px-3 py-3 text-sm outline-none"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.22em] text-gray-400">Driver</span>
                  <input
                    value={form.driver}
                    onChange={(event) => handleFieldChange('driver', event.target.value)}
                    placeholder="R. Sharma"
                    className="relief-input w-full rounded-2xl px-3 py-3 text-sm outline-none"
                  />
                </label>

                <label className="space-y-2 md:col-span-2 xl:col-span-1">
                  <span className="text-xs uppercase tracking-[0.22em] text-gray-400">ETA Minutes</span>
                  <input
                    type="number"
                    min={0}
                    value={form.etaMinutes}
                    onChange={(event) => handleFieldChange('etaMinutes', Number(event.target.value))}
                    className="relief-input w-full rounded-2xl px-3 py-3 text-sm outline-none"
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.22em] text-gray-400">Dispatch Notes</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => handleFieldChange('notes', event.target.value)}
                  rows={3}
                  className="relief-input w-full rounded-2xl px-3 py-3 text-sm outline-none"
                />
              </label>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="relief-button-primary inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-cyan-50 disabled:opacity-60"
                >
                  <PackagePlus className="h-4 w-4" />
                  {submitting ? 'Dispatching...' : 'Create Shipment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
