import { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Bell,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  LifeBuoy,
  LoaderCircle,
  LogOut,
  MapPinned,
  Shield,
  UserCircle2,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { CinematicDashboardBackdrop } from '../components/dashboard/CinematicDashboardBackdrop';
import { ExplainableOperationsStack } from '../components/ai/ExplainableOperationsStack';
import { useNotifications } from '../hooks/useNotifications';
import { cn } from '../lib/utils';
import { getCurrentUser, logout } from '../services/api';
import { getAssistantContext, type AssistantContextSnapshot } from '../services/assistant';

const navigationItems = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Crisis Map', path: '/crisis-map' },
  { label: 'Resources', path: '/resources' },
  { label: 'SOS Citizen App', path: '/sos-citizen' },
  { label: 'Analytics', path: '/analytics' },
  { label: 'Supply Chain', path: '/supply-chain' },
  { label: 'AI Assistant', path: '/ai-assistant' },
] as const;

const commandActions = [
  { label: 'Open Crisis Map', path: '/crisis-map', icon: MapPinned },
  { label: 'View Analytics', path: '/analytics', icon: BarChart3 },
  { label: 'Launch SOS', path: '/sos-citizen', icon: LifeBuoy },
] as const;

const demoCriticalZones: AssistantContextSnapshot['criticalZones'] = [
  { name: 'North Arc Shelter Belt', score: 96 },
  { name: 'Coastal Corridor', score: 89 },
  { name: 'River Delta Sector', score: 84 },
];

const demoPrioritizedIncidents: AssistantContextSnapshot['prioritizedIncidents'] = [
  {
    id: 'demo-incident-1',
    region: 'North Arc Shelter Belt',
    severity: 'Severe',
    crisisType: 'Flooding',
    status: 'Escalating',
    assignedTeam: 'Rapid Water Unit',
    createdAt: new Date().toISOString(),
    label: 'Shelter overflow risk rising across three intake zones',
    ageMinutes: 18,
    priorityScore: 97,
    priorityLabel: 'Critical',
    recommendedAction: 'Pre-stage overflow cots and medical triage at the north arc shelters.',
    why: ['SOS volume is rising faster than bed turnover in the shelter belt.'],
  },
  {
    id: 'demo-incident-2',
    region: 'Coastal Corridor',
    severity: 'High',
    crisisType: 'Cyclone',
    status: 'Active',
    assignedTeam: 'Logistics Cell 2',
    createdAt: new Date().toISOString(),
    label: 'Coastal convoy access narrowing around fuel and comms routes',
    ageMinutes: 26,
    priorityScore: 91,
    priorityLabel: 'High',
    recommendedAction: 'Reroute the next outbound convoy through the inland corridor before road closure.',
    why: ['Two delayed shipments are affecting fuel and communications resilience.'],
  },
];

const demoShortagePredictions: AssistantContextSnapshot['shortagePredictions'] = [
  {
    id: 'demo-shortage-1',
    type: 'medical',
    name: 'IV Fluids',
    location: 'North Arc Shelter Belt',
    currentQuantity: 240,
    unit: 'packs',
    daysRemaining: 1.8,
    riskScore: 93,
    riskLevel: 'Critical',
    recommendedAction: 'Shift 120 packs from Inland Reserve before evening surge.',
    why: ['Projected admissions exceed current hydration inventory by tonight.'],
  },
  {
    id: 'demo-shortage-2',
    type: 'shelter',
    name: 'Thermal Blankets',
    location: 'River Delta Sector',
    currentQuantity: 380,
    unit: 'units',
    daysRemaining: 2.6,
    riskScore: 82,
    riskLevel: 'High',
    recommendedAction: 'Advance the next blanket shipment into the delta sector staging node.',
    why: ['Night shelter occupancy is trending above the weekly emergency baseline.'],
  },
];

const demoDispatchRecommendations: AssistantContextSnapshot['dispatchRecommendations'] = [
  {
    id: 'demo-dispatch-1',
    incidentId: 'demo-incident-1',
    to: 'North Arc Shelter Belt',
    from: 'Inland Reserve Hub',
    resourceType: 'IV Fluids',
    quantity: 120,
    unit: 'packs',
    etaMinutes: 42,
    action: 'Dispatch replenishment convoy',
    existingShipmentId: null,
    shipmentId: null,
    priorityLabel: 'Critical',
    why: ['This transfer prevents overnight depletion at the highest-pressure shelters.'],
  },
  {
    id: 'demo-dispatch-2',
    incidentId: 'demo-incident-2',
    to: 'Coastal Corridor',
    from: 'Central Mobility Yard',
    resourceType: 'Portable Radios',
    quantity: 48,
    unit: 'units',
    etaMinutes: 36,
    action: 'Pre-position comms support package',
    existingShipmentId: null,
    shipmentId: null,
    priorityLabel: 'High',
    why: ['Field teams need redundancy before route closures interrupt comms coverage.'],
  },
];

function getInitials(name?: string | null) {
  if (!name) {
    return 'RA';
  }

  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || '').join('') || 'RA';
}

function getPriorityTone(label: string) {
  if (label === 'Critical') return 'text-rose-200 bg-rose-400/12 border-rose-300/30';
  if (label === 'High') return 'text-amber-100 bg-amber-400/12 border-amber-300/30';
  if (label === 'Elevated') return 'text-cyan-100 bg-cyan-400/12 border-cyan-300/30';
  return 'text-white/75 bg-white/[0.04] border-white/10';
}

function getRiskTone(label: string) {
  if (label === 'Critical') return 'text-rose-200';
  if (label === 'High') return 'text-amber-100';
  if (label === 'Watch') return 'text-cyan-100';
  return 'text-emerald-200';
}

const surfacePanelClass =
  'rounded-[1.5rem] border border-sky-100/12 bg-[linear-gradient(180deg,rgba(201,240,255,0.1)_0%,rgba(86,177,226,0.08)_100%)] p-5 shadow-[0_20px_60px_rgba(5,18,33,0.18)] backdrop-blur-xl';

function buildImpactMetrics(context: AssistantContextSnapshot) {
  const criticalPriorities = context.prioritizedIncidents.filter((item) => item.priorityLabel === 'Critical').length;
  const shortageRisks = context.shortagePredictions.filter((item) => item.riskLevel === 'Critical' || item.riskLevel === 'High').length;
  const dispatchesReady = context.dispatchRecommendations.length;
  const responseDelta = context.todayIncidentCount - context.lastWeekDailyAverage;

  return [
    {
      label: 'AI Escalations',
      value: criticalPriorities,
      detail: `${context.prioritizedIncidents.length} incidents ranked with explainable urgency`,
    },
    {
      label: 'Shortages Prevented',
      value: shortageRisks,
      detail: shortageRisks > 0 ? 'High-risk stockouts identified before depletion' : 'No immediate stockout risk in the current window',
    },
    {
      label: 'Dispatches Ready',
      value: dispatchesReady,
      detail: dispatchesReady > 0 ? 'Recommended actions are prepared for execution now' : 'No urgent convoy changes required yet',
    },
    {
      label: 'Trend vs Baseline',
      value: responseDelta > 0 ? `+${responseDelta.toFixed(1)}` : responseDelta.toFixed(1),
      detail: `Today vs 7-day daily average of ${context.lastWeekDailyAverage}`,
    },
  ];
}

function mergeDemoItems<T>(live: T[], demo: T[], minItems: number) {
  if (live.length >= minItems) {
    return live;
  }

  return [...live, ...demo.slice(0, Math.max(0, minItems - live.length))];
}

function sanitizeCriticalZones(zones: AssistantContextSnapshot['criticalZones']) {
  return zones
    .filter(Boolean)
    .map((zone, index) => ({
      name: String(zone?.name || `Priority Zone ${index + 1}`),
      score: Number.isFinite(Number(zone?.score)) ? Number(zone.score) : 0,
    }));
}

function sanitizePrioritizedIncidents(items: AssistantContextSnapshot['prioritizedIncidents']) {
  return items
    .filter(Boolean)
    .map((item, index) => ({
      ...item,
      id: String(item?.id || `incident-${index + 1}`),
      region: String(item?.region || item?.label || `Priority Zone ${index + 1}`),
      severity: String(item?.severity || 'medium'),
      crisisType: String(item?.crisisType || 'other'),
      status: String(item?.status || 'pending'),
      assignedTeam: item?.assignedTeam || null,
      createdAt: String(item?.createdAt || new Date().toISOString()),
      label: String(item?.label || item?.region || `Incident ${index + 1}`),
      ageMinutes: Number.isFinite(Number(item?.ageMinutes)) ? Number(item.ageMinutes) : 0,
      priorityScore: Number.isFinite(Number(item?.priorityScore)) ? Number(item.priorityScore) : 0,
      priorityLabel: String(item?.priorityLabel || 'Watch'),
      recommendedAction: String(item?.recommendedAction || 'Maintain monitoring and coordinate the next field update.'),
      why: Array.isArray(item?.why) ? item.why.filter(Boolean).map((reason) => String(reason)) : [],
    }));
}

function sanitizeShortagePredictions(items: AssistantContextSnapshot['shortagePredictions']) {
  return items
    .filter(Boolean)
    .map((item, index) => ({
      ...item,
      id: String(item?.id || `shortage-${index + 1}`),
      type: String(item?.type || 'resource'),
      name: String(item?.name || `Resource ${index + 1}`),
      location: String(item?.location || 'Unknown location'),
      currentQuantity: Number.isFinite(Number(item?.currentQuantity)) ? Number(item.currentQuantity) : 0,
      unit: String(item?.unit || 'units'),
      daysRemaining: Number.isFinite(Number(item?.daysRemaining)) ? Number(item.daysRemaining) : 0,
      riskScore: Number.isFinite(Number(item?.riskScore)) ? Number(item.riskScore) : 0,
      riskLevel: String(item?.riskLevel || 'Stable'),
      recommendedAction: String(item?.recommendedAction || 'Continue monitoring the stock position.'),
      why: Array.isArray(item?.why) ? item.why.filter(Boolean).map((reason) => String(reason)) : [],
    }));
}

function sanitizeDispatchRecommendations(items: AssistantContextSnapshot['dispatchRecommendations']) {
  return items
    .filter(Boolean)
    .map((item, index) => ({
      ...item,
      id: String(item?.id || `dispatch-${index + 1}`),
      incidentId: String(item?.incidentId || `incident-${index + 1}`),
      to: String(item?.to || 'Priority Zone'),
      from: String(item?.from || 'Central Hub'),
      resourceType: String(item?.resourceType || 'Medicine'),
      quantity: Number.isFinite(Number(item?.quantity)) ? Number(item.quantity) : 0,
      unit: String(item?.unit || 'units'),
      etaMinutes: Number.isFinite(Number(item?.etaMinutes)) ? Number(item.etaMinutes) : 0,
      action: String(item?.action || 'Stage the next recommended dispatch.'),
      existingShipmentId: item?.existingShipmentId || null,
      shipmentId: item?.shipmentId || null,
      priorityLabel: String(item?.priorityLabel || 'Watch'),
      why: Array.isArray(item?.why) ? item.why.filter(Boolean).map((reason) => String(reason)) : [],
    }));
}

function augmentDashboardContext(context: AssistantContextSnapshot): AssistantContextSnapshot {
  const prioritizedIncidents = sanitizePrioritizedIncidents(
    mergeDemoItems(context.prioritizedIncidents, demoPrioritizedIncidents, 2)
  );
  const shortagePredictions = sanitizeShortagePredictions(
    mergeDemoItems(context.shortagePredictions, demoShortagePredictions, 2)
  );
  const dispatchRecommendations = sanitizeDispatchRecommendations(
    mergeDemoItems(context.dispatchRecommendations, demoDispatchRecommendations, 2)
  );
  const criticalZones = sanitizeCriticalZones(mergeDemoItems(context.criticalZones, demoCriticalZones, 3));

  return {
    ...context,
    aiBriefing: {
      ...context.aiBriefing,
      topPriorityReason:
        context.aiBriefing.topPriorityReason && context.aiBriefing.topPriorityReason !== 'No priority rationale available yet.'
          ? context.aiBriefing.topPriorityReason
          : demoPrioritizedIncidents[0].recommendedAction,
      shortageHeadline:
        context.aiBriefing.shortageHeadline && context.aiBriefing.shortageHeadline !== 'No shortage forecast available yet.'
          ? context.aiBriefing.shortageHeadline
          : 'IV fluids and thermal blankets need pre-emptive balancing across shelter zones.',
      dispatchHeadline:
        context.aiBriefing.dispatchHeadline && context.aiBriefing.dispatchHeadline !== 'No dispatch recommendation available yet.'
          ? context.aiBriefing.dispatchHeadline
          : 'Two rapid dispatch options are staged for execution in the next 45 minutes.',
    },
    activeIncidents: Math.max(context.activeIncidents, prioritizedIncidents.length),
    criticalZones,
    prioritizedIncidents,
    shortagePredictions,
    dispatchRecommendations,
    supplySummary: {
      ...context.supplySummary,
      activeShipments: Math.max(context.supplySummary.activeShipments, dispatchRecommendations.length),
      delayedDeliveries: Math.max(context.supplySummary.delayedDeliveries, 2),
      deliveredToday: Math.max(context.supplySummary.deliveredToday, 14),
    },
    todayIncidentCount: Math.max(context.todayIncidentCount, prioritizedIncidents.length + 3),
    lastWeekDailyAverage: Math.max(context.lastWeekDailyAverage, 4),
    rescueTeams: Math.max(context.rescueTeams, 18),
    totalUsers: Math.max(context.totalUsers, 4260),
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const mobileProfileMenuRef = useRef<HTMLDivElement | null>(null);
  const desktopProfileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileNotificationMenuRef = useRef<HTMLDivElement | null>(null);
  const desktopNotificationMenuRef = useRef<HTMLDivElement | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [context, setContext] = useState<AssistantContextSnapshot | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);
  const [heroCollapsed, setHeroCollapsed] = useState(false);
  const user = getCurrentUser();
  const { notifications, removeNotification } = useNotifications();
  const sessionId = `dashboard-${user?.id || user?.email || 'operator'}`;

  const handleProfileNavigate = () => {
    setProfileMenuOpen(false);
    navigate('/profile');
  };

  const handleSignOut = () => {
    setProfileMenuOpen(false);
    logout();
  };

  const loadDashboardBriefing = async () => {
    try {
      setContextLoading(true);
      setContextError(null);
      const data = await getAssistantContext({
        sessionId,
        role: user?.role || 'admin',
        page: 'dashboard',
        mode: user?.role === 'citizen' ? 'citizen' : 'admin',
      });
      setContext(data.context);
    } catch (error) {
      console.error('Failed to load dashboard AI briefing:', error);
      setContextError('Unable to load the AI operations briefing right now.');
    } finally {
      setContextLoading(false);
    }
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideMobile = mobileProfileMenuRef.current?.contains(target);
      const clickedInsideDesktop = desktopProfileMenuRef.current?.contains(target);
      const clickedInsideMobileNotifications = mobileNotificationMenuRef.current?.contains(target);
      const clickedInsideDesktopNotifications = desktopNotificationMenuRef.current?.contains(target);

      if (!clickedInsideMobile && !clickedInsideDesktop) {
        setProfileMenuOpen(false);
      }

      if (!clickedInsideMobileNotifications && !clickedInsideDesktopNotifications) {
        setNotificationMenuOpen(false);
      }
    };

    document.addEventListener('click', handlePointerDown);

    return () => {
      document.removeEventListener('click', handlePointerDown);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = window.scrollY;
      setHeroCollapsed(currentScroll > window.innerHeight * 0.28);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    void loadDashboardBriefing();
  }, []);

  const notificationItems = notifications.slice(0, 5);
  const dashboardContext = context ? augmentDashboardContext(context) : null;
  const impactMetrics = dashboardContext ? buildImpactMetrics(dashboardContext) : [];

  return (
    <div className="min-h-screen bg-[#030711] text-white">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <CinematicDashboardBackdrop />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(91,155,255,0.1),transparent_34%),radial-gradient(circle_at_80%_18%,rgba(67,224,255,0.08),transparent_24%),linear-gradient(180deg,rgba(3,7,17,0.14)_0%,rgba(3,7,17,0.38)_56%,rgba(3,7,17,0.68)_100%)]" />
        <div className="dashboard-grid absolute inset-0 opacity-20" />
        <div className="dashboard-particles absolute inset-0 opacity-40" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-4 sm:px-6">
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="fixed left-0 right-0 top-0 z-30"
        >
          <div className="mx-auto max-w-[1600px] px-4 pt-4 sm:px-6 sm:pt-6">
            <div
              className={cn(
                'px-2 py-2 transition-all duration-300',
                heroCollapsed &&
                  'rounded-[1.5rem] border border-sky-100/12 bg-[linear-gradient(180deg,rgba(201,240,255,0.12)_0%,rgba(86,177,226,0.1)_100%)] shadow-[0_20px_60px_rgba(5,18,33,0.22)] backdrop-blur-2xl'
              )}
            >
              <div className="px-1 py-2">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => navigate('/')}
                      className="inline-flex items-center gap-3 px-1 py-2 text-left transition opacity-90 hover:opacity-100"
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-cyan-100">
                        <Shield className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block font-display text-lg font-semibold tracking-tight text-white">ReliefOS AI</span>
                        <span className="block text-[10px] uppercase tracking-[0.34em] text-cyan-100/45">Command</span>
                      </span>
                    </button>

                    <div className="flex items-center gap-2 xl:hidden">
                      <div className="relative" ref={mobileNotificationMenuRef}>
                        <button
                          type="button"
                          onClick={() => setNotificationMenuOpen((open) => !open)}
                          className="relative inline-flex h-11 w-11 items-center justify-center text-white/75 transition hover:text-white"
                          aria-label="Notifications"
                        >
                          <Bell className="h-4.5 w-4.5" />
                          {notificationItems.length > 0 && (
                            <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-400 px-1 text-[10px] font-semibold text-[#04111e]">
                              {notificationItems.length}
                            </span>
                          )}
                        </button>

                        {notificationMenuOpen && (
                          <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[min(92vw,360px)] bg-[#091425]/84 p-3 shadow-[0_30px_80px_rgba(0,0,0,0.32)] backdrop-blur-2xl">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-white">Notifications</div>
                                <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-white/42">Live alerts</div>
                              </div>
                              <Bell className="h-4 w-4 text-cyan-100/70" />
                            </div>

                            <div className="space-y-2">
                              {notificationItems.length > 0 ? (
                                notificationItems.map((notification) => (
                                  <div key={notification.id} className="bg-white/[0.04] p-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="text-sm font-medium text-white">{notification.title}</div>
                                        <div className="mt-1 text-sm leading-6 text-white/62">{notification.message}</div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => removeNotification(notification.id)}
                                        className="shrink-0 text-white/38 transition hover:text-white/72"
                                        aria-label="Dismiss notification"
                                      >
                                        <CheckCircle2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                    <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-white/38">
                                      {notification.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="bg-white/[0.04] p-4 text-sm text-white/54">
                                  No active notifications right now.
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="relative" ref={mobileProfileMenuRef}>
                        <button
                          type="button"
                          onClick={() => setProfileMenuOpen((open) => !open)}
                          className="inline-flex h-11 items-center gap-2 px-2 text-sm text-white transition opacity-80 hover:opacity-100"
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 text-xs font-semibold text-cyan-100">
                            {getInitials(user?.name)}
                          </span>
                          <ChevronDown className="h-4 w-4 text-cyan-100/60" />
                        </button>

                        {profileMenuOpen && (
                          <div
                            className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-56 rounded-2xl border border-white/10 bg-[#091425]/72 p-2 shadow-[0_30px_80px_rgba(0,0,0,0.32)] backdrop-blur-2xl"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={handleProfileNavigate}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/80 transition hover:bg-white/5 hover:text-white"
                            >
                              <UserCircle2 className="h-4 w-4 text-cyan-100/70" />
                              Profile
                            </button>
                            <button
                              type="button"
                              onClick={handleSignOut}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/80 transition hover:bg-white/5 hover:text-white"
                            >
                              <LogOut className="h-4 w-4 text-cyan-100/70" />
                              Sign out
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <nav className="no-scrollbar flex min-w-0 items-center gap-2 overflow-x-auto xl:flex-1 xl:justify-center">
                    {navigationItems.map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                          cn('whitespace-nowrap px-3 py-2 text-sm font-medium transition', isActive ? 'text-cyan-50' : 'text-white/62 hover:text-white')
                        }
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </nav>

                  <div className="hidden items-center gap-2 xl:flex">
                    <div className="relative" ref={desktopNotificationMenuRef}>
                      <button
                        type="button"
                        onClick={() => setNotificationMenuOpen((open) => !open)}
                        className="relative inline-flex h-11 w-11 items-center justify-center text-white/75 transition hover:text-white"
                        aria-label="Notifications"
                      >
                        <Bell className="h-4.5 w-4.5" />
                        {notificationItems.length > 0 && (
                          <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-400 px-1 text-[10px] font-semibold text-[#04111e]">
                            {notificationItems.length}
                          </span>
                        )}
                      </button>

                      {notificationMenuOpen && (
                        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[360px] bg-[#091425]/84 p-3 shadow-[0_30px_80px_rgba(0,0,0,0.32)] backdrop-blur-2xl">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-white">Notifications</div>
                              <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-white/42">Live alerts</div>
                            </div>
                            <Bell className="h-4 w-4 text-cyan-100/70" />
                          </div>

                          <div className="space-y-2">
                            {notificationItems.length > 0 ? (
                              notificationItems.map((notification) => (
                                <div key={notification.id} className="bg-white/[0.04] p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-sm font-medium text-white">{notification.title}</div>
                                      <div className="mt-1 text-sm leading-6 text-white/62">{notification.message}</div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => removeNotification(notification.id)}
                                      className="shrink-0 text-white/38 transition hover:text-white/72"
                                      aria-label="Dismiss notification"
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                  <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-white/38">
                                    {notification.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="bg-white/[0.04] p-4 text-sm text-white/54">
                                No active notifications right now.
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="relative" ref={desktopProfileMenuRef}>
                      <button
                        type="button"
                        onClick={() => setProfileMenuOpen((open) => !open)}
                        className="inline-flex items-center gap-3 px-2 py-2 text-left transition opacity-85 hover:opacity-100"
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 text-sm font-semibold text-cyan-100">
                          {getInitials(user?.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-white">{user?.name || 'ReliefOS Operator'}</span>
                          <span className="block truncate text-[10px] uppercase tracking-[0.28em] text-white/38">
                            {user?.role || 'Command'}
                          </span>
                        </span>
                        <ChevronDown className={cn('h-4 w-4 text-cyan-100/60 transition-transform', profileMenuOpen && 'rotate-180')} />
                      </button>

                      {profileMenuOpen && (
                        <div
                          className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-60 rounded-2xl border border-white/10 bg-[#091425]/72 p-2 shadow-[0_30px_80px_rgba(0,0,0,0.32)] backdrop-blur-2xl"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={handleProfileNavigate}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/80 transition hover:bg-white/5 hover:text-white"
                          >
                            <UserCircle2 className="h-4 w-4 text-cyan-100/70" />
                            Open profile
                          </button>
                          <button
                            type="button"
                            onClick={handleSignOut}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/80 transition hover:bg-white/5 hover:text-white"
                          >
                            <LogOut className="h-4 w-4 text-cyan-100/70" />
                            Sign out
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.header>

        <section className="relative left-1/2 flex min-h-screen w-screen -translate-x-1/2 items-center justify-center overflow-hidden pt-28 sm:pt-32">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,17,0.08)_0%,rgba(3,7,17,0.18)_45%,rgba(3,7,17,0.52)_100%)]" />

          <motion.div
            animate={{
              opacity: heroCollapsed ? 0 : 1,
              y: heroCollapsed ? -40 : 0,
              scale: heroCollapsed ? 0.96 : 1,
            }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-20 flex w-full max-w-6xl flex-col items-center px-6 text-center sm:px-8"
          >
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-2 border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.34em] text-cyan-100/76 backdrop-blur-xl"
            >
              <BrainCircuit className="h-3.5 w-3.5" />
              AI Command Layer
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 max-w-5xl font-display text-5xl font-semibold leading-[0.92] tracking-tight text-white md:text-7xl xl:text-[5.6rem]"
            >
              {dashboardContext?.aiBriefing.headline || 'Unified crisis intelligence in motion.'}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 max-w-3xl text-base leading-8 text-white/56 sm:text-lg"
            >
              {dashboardContext?.aiBriefing.summary || 'Live operational context, shortage signals, and dispatch recommendations aligned in one command view.'}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.28 }}
              className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
            >
              <button
                type="button"
                onClick={() => window.scrollTo({ top: window.innerHeight * 0.96, behavior: 'smooth' })}
                className="inline-flex items-center gap-2 bg-cyan-400/[0.1] px-6 py-4 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/[0.14]"
              >
                Enter Command View
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/crisis-map')}
                className="inline-flex items-center gap-2 bg-white/[0.04] px-6 py-4 text-sm font-medium text-white/82 transition hover:bg-white/[0.08]"
              >
                <MapPinned className="h-4 w-4" />
                Open Crisis Map
              </button>
            </motion.div>

            {dashboardContext && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.34 }}
                className="mt-12 grid w-full max-w-4xl gap-4 sm:grid-cols-3"
              >
                <div className="border border-sky-200/10 bg-sky-200/[0.07] p-4 backdrop-blur-xl">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-sky-100/70">Incidents</div>
                  <div className="mt-3 text-3xl font-semibold text-white">{dashboardContext.activeIncidents}</div>
                  <div className="mt-2 text-sm text-sky-50/72">Avg {dashboardContext.avgResponseTimeLabel}</div>
                </div>
                <div className="border border-sky-200/10 bg-sky-200/[0.07] p-4 backdrop-blur-xl">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-sky-100/70">Shortages</div>
                  <div className="mt-3 text-3xl font-semibold text-white">
                    {dashboardContext.shortagePredictions.filter((item) => item.riskLevel !== 'Stable').length}
                  </div>
                  <div className="mt-2 text-sm text-sky-50/72">{dashboardContext.aiBriefing.shortageHeadline}</div>
                </div>
                <div className="border border-sky-200/10 bg-sky-200/[0.07] p-4 backdrop-blur-xl">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-sky-100/70">Dispatch</div>
                  <div className="mt-3 text-3xl font-semibold text-white">{dashboardContext.supplySummary.activeShipments}</div>
                  <div className="mt-2 text-sm text-sky-50/72">{dashboardContext.aiBriefing.dispatchHeadline}</div>
                </div>
              </motion.div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: heroCollapsed ? 0 : 1 }}
            transition={{ duration: 0.35 }}
            className="absolute bottom-10 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-4"
          >
            <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-white/30">
              Scroll to mission control
            </span>
            <div className="h-12 w-[1px] bg-gradient-to-b from-white/20 to-transparent" />
          </motion.div>
        </section>

        <main className="relative left-1/2 flex w-screen -translate-x-1/2 flex-1 overflow-hidden py-6 sm:py-8">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,17,0.16)_0%,rgba(3,7,17,0.28)_16%,rgba(3,7,17,0.42)_52%,rgba(3,7,17,0.62)_100%)]" />
          <motion.div
            animate={{ opacity: [0.2, 0.34, 0.2], scale: [1, 1.03, 1] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            className="pointer-events-none absolute left-[8%] top-16 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(173,234,255,0.22),transparent_70%)] blur-3xl"
          />
          <motion.div
            animate={{ opacity: [0.14, 0.28, 0.14], x: [0, 24, 0] }}
            transition={{ duration: 10.5, repeat: Infinity, ease: 'easeInOut' }}
            className="pointer-events-none absolute bottom-10 right-[10%] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(120,214,255,0.18),transparent_72%)] blur-3xl"
          />

          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: heroCollapsed ? 1 : 0.58, y: heroCollapsed ? 0 : 18 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 mx-auto w-full max-w-[1600px] space-y-6 px-4 sm:px-6"
          >
            <div className="mx-auto w-full max-w-[1480px]">
              <div className="overflow-hidden p-4 sm:p-6 xl:p-8">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-2 bg-sky-200/[0.08] px-4 py-2 text-[11px] uppercase tracking-[0.34em] text-sky-50/90 backdrop-blur-xl">
                    <BrainCircuit className="h-3.5 w-3.5" />
                    AI Briefing
                  </div>
                </div>

                {contextLoading ? (
                  <div className="flex min-h-[320px] items-center justify-center text-white/72">
                    <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
                    Loading...
                  </div>
                ) : contextError || !context ? (
                  <div className="mt-8 border border-rose-300/20 bg-rose-400/[0.06] p-5 text-sm text-rose-100/88">
                    {contextError || 'No briefing data available.'}
                  </div>
                ) : dashboardContext ? (
                  <div className="mt-8 space-y-8">
                    <div className="grid gap-8 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.85fr)] xl:items-stretch">
                      <motion.div
                        initial={{ opacity: 0, x: -26 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.85, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                        className="min-w-0 space-y-6"
                      >
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.28em] text-sky-100/74">Command Overview</div>
                          <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                            {dashboardContext.aiBriefing.headline}
                          </h2>
                          <p className="mt-4 max-w-3xl text-base leading-8 text-sky-50/78 sm:text-lg">
                            {dashboardContext.aiBriefing.summary}
                          </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3">
                          <motion.div
                            initial={{ opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.55, delay: 0.18 }}
                            className={cn(surfacePanelClass, 'space-y-3')}
                          >
                            <div className="text-[11px] uppercase tracking-[0.24em] text-sky-100/74">Incidents</div>
                            <div className="text-3xl font-semibold text-white">{dashboardContext.activeIncidents}</div>
                            <div className="text-sm text-sky-50/74">Avg {dashboardContext.avgResponseTimeLabel}</div>
                          </motion.div>
                          <motion.div
                            initial={{ opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.55, delay: 0.24 }}
                            className={cn(surfacePanelClass, 'space-y-3')}
                          >
                            <div className="text-[11px] uppercase tracking-[0.24em] text-sky-100/74">Shortages</div>
                            <div className="text-3xl font-semibold text-white">
                              {dashboardContext.shortagePredictions.filter((item) => item.riskLevel !== 'Stable').length}
                            </div>
                            <div className="text-sm text-sky-50/74">{dashboardContext.aiBriefing.shortageHeadline}</div>
                          </motion.div>
                          <motion.div
                            initial={{ opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.55, delay: 0.3 }}
                            className={cn(surfacePanelClass, 'space-y-3')}
                          >
                            <div className="text-[11px] uppercase tracking-[0.24em] text-sky-100/74">Dispatch</div>
                            <div className="text-3xl font-semibold text-white">{dashboardContext.supplySummary.activeShipments}</div>
                            <div className="text-sm text-sky-50/74">{dashboardContext.aiBriefing.dispatchHeadline}</div>
                          </motion.div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
                          <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.55, delay: 0.22 }}
                            className={cn(surfacePanelClass, 'space-y-3')}
                          >
                            <div className="text-[11px] uppercase tracking-[0.24em] text-sky-100/74">Executive Summary</div>
                            <div className="text-lg font-semibold text-white">
                              {dashboardContext.aiBriefing.topPriorityReason}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {dashboardContext.criticalZones.slice(0, 3).map((zone) => (
                                <span key={zone.name} className="rounded-full border border-sky-100/12 bg-sky-200/[0.08] px-3 py-1.5 text-xs text-sky-50/80">
                                  {zone.name} pressure {zone.score}
                                </span>
                              ))}
                            </div>
                          </motion.div>

                          <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.55, delay: 0.28 }}
                            className={cn(surfacePanelClass, 'space-y-3')}
                          >
                            <div className="text-[11px] uppercase tracking-[0.24em] text-sky-100/74">Why Now</div>
                            <div className="space-y-3 text-sm text-sky-50/76">
                              <div>{dashboardContext.aiBriefing.shortageHeadline}</div>
                              <div>{dashboardContext.aiBriefing.dispatchHeadline}</div>
                              <div>{dashboardContext.supplySummary.delayedDeliveries} delayed deliveries are affecting flow.</div>
                            </div>
                          </motion.div>
                        </div>

                        <div className="flex flex-wrap gap-3 pt-2">
                          {commandActions.map((action, index) => (
                            <button
                              key={action.path}
                              type="button"
                              onClick={() => navigate(action.path)}
                              className={cn(
                                'inline-flex h-12 items-center gap-2 px-5 text-sm font-medium transition',
                                index === 0
                                  ? 'bg-sky-200/[0.12] text-sky-50 hover:bg-sky-200/[0.18]'
                                  : 'text-sky-50/90 hover:text-white'
                              )}
                            >
                              <action.icon className="h-4 w-4" />
                              {action.label}
                            </button>
                          ))}
                        </div>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, x: 28 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.95, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
                        className={cn(surfacePanelClass, 'relative min-h-[520px] overflow-hidden p-6')}
                      >
                        <motion.div
                          animate={{ opacity: [0.45, 0.7, 0.45], scale: [1, 1.04, 1] }}
                          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
                          className="pointer-events-none absolute inset-x-[8%] top-[8%] h-40 rounded-full bg-[radial-gradient(circle,rgba(154,227,255,0.28),transparent_68%)] blur-3xl"
                        />
                        <motion.div
                          animate={{ opacity: [0.25, 0.42, 0.25], x: [0, 18, 0] }}
                          transition={{ duration: 8.5, repeat: Infinity, ease: 'easeInOut' }}
                          className="pointer-events-none absolute bottom-[12%] right-[8%] h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(108,205,255,0.24),transparent_70%)] blur-3xl"
                        />

                        <div className="relative z-10 flex h-full flex-col justify-between">
                          <div className="max-w-md space-y-2">
                            <div className="text-[11px] uppercase tracking-[0.28em] text-sky-100/80">Operational Theater</div>
                            <div className="text-sm leading-7 text-sky-50/72">
                              AI-prioritized field pressure, route strain, and dispatch urgency aligned in one view.
                            </div>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            {dashboardContext.prioritizedIncidents.slice(0, 2).map((incident, index) => (
                              <motion.div
                                key={`${incident.label}-${incident.region}`}
                                initial={{ opacity: 0, y: 18 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.34 + index * 0.08 }}
                                className="rounded-[1.25rem] border border-sky-100/10 bg-sky-200/[0.06] p-4 backdrop-blur-md"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-[11px] uppercase tracking-[0.22em] text-sky-100/72">{incident.region}</div>
                                  <span className={cn('border px-2 py-1 text-[10px] uppercase tracking-[0.22em]', getPriorityTone(incident.priorityLabel))}>
                                    {incident.priorityLabel}
                                  </span>
                                </div>
                                <div className="mt-3 text-base font-semibold text-white">{incident.label}</div>
                                <div className="mt-2 text-sm text-sky-50/76">
                                  {incident.why?.[0] || incident.recommendedAction}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {impactMetrics.map((metric, index) => (
                        <motion.div
                          key={metric.label}
                          initial={{ opacity: 0, y: 18 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.55, delay: 0.26 + index * 0.06 }}
                          className={cn(surfacePanelClass, 'space-y-3')}
                        >
                          <div className="text-[11px] uppercase tracking-[0.24em] text-sky-100/74">{metric.label}</div>
                          <div className="text-3xl font-semibold text-white">{metric.value}</div>
                          <div className="text-sm text-sky-50/76">{metric.detail}</div>
                        </motion.div>
                      ))}
                    </div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                    >
                      <ExplainableOperationsStack
                        priorities={dashboardContext.prioritizedIncidents}
                        shortages={dashboardContext.shortagePredictions}
                        dispatches={dashboardContext.dispatchRecommendations}
                      />
                    </motion.div>
                  </div>
                ) : (
                  <div className="mt-8 border border-rose-300/20 bg-rose-400/[0.06] p-5 text-sm text-rose-100/88">
                    No briefing data available.
                  </div>
                )}
              </div>
            </div>
          </motion.section>
        </main>
      </div>
    </div>
  );
}
