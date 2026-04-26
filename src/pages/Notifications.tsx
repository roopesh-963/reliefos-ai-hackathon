import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, Loader2, RadioTower } from 'lucide-react';
import { BackToDashboardButton } from '../components/navigation/BackToDashboardButton';
import { useNotifications } from '../hooks/useNotifications';
import {
  getAlerts,
  getAllSOS,
  getCurrentUser,
  type CrisisAlert,
  type SOSRequest,
} from '../services/api';
import { useSocket } from '../hooks/useSocket';

type FeedItem = {
  id: string;
  kind: 'system' | 'alert' | 'sos';
  title: string;
  message: string;
  tone: 'info' | 'warning' | 'critical' | 'success';
  timestamp: Date;
  meta?: string;
};

const toneStyles: Record<FeedItem['tone'], string> = {
  info: 'text-cyan-200',
  success: 'text-emerald-200',
  warning: 'text-amber-200',
  critical: 'text-red-200',
};

const sosSeverityToTone = (severity: SOSRequest['severity']): FeedItem['tone'] => {
  if (severity === 'critical' || severity === 'high') {
    return 'critical';
  }
  if (severity === 'medium') {
    return 'warning';
  }
  return 'info';
};

const formatAlertItem = (alert: CrisisAlert): FeedItem => ({
  id: `alert-${alert._id}`,
  kind: 'alert',
  title: alert.title,
  message: alert.message,
  tone: alert.type,
  timestamp: new Date(alert.createdAt),
  meta: alert.affectedCity ? `Affected area: ${alert.affectedCity}` : undefined,
});

const formatSosItem = (sos: SOSRequest): FeedItem => ({
  id: `sos-${sos._id}`,
  kind: 'sos',
  title: `${String(sos.severity).toUpperCase()} SOS ${sos.crisisType ? `- ${sos.crisisType}` : ''}`,
  message: sos.message || `Emergency request from ${sos.location?.label || sos.region || 'unknown location'}`,
  tone: sosSeverityToTone(sos.severity),
  timestamp: new Date(sos.createdAt),
  meta: [sos.region || sos.location?.label, sos.status.replace('_', ' ')].filter(Boolean).join(' • '),
});

export default function Notifications() {
  const { notifications } = useNotifications();
  const { on, joinDashboard } = useSocket();
  const user = getCurrentUser();
  const canViewSOS = user?.role === 'admin' || user?.role === 'rescue_team';

  const [alerts, setAlerts] = useState<CrisisAlert[]>([]);
  const [sosItems, setSosItems] = useState<SOSRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadFeed = async () => {
      setLoading(true);
      setError(null);

      try {
        const [alertData, sosData] = await Promise.all([
          getAlerts(),
          canViewSOS ? getAllSOS({ limit: 25 }) : Promise.resolve([] as SOSRequest[]),
        ]);

        if (cancelled) {
          return;
        }

        setAlerts(alertData);
        setSosItems(sosData);
      } catch (loadError) {
        console.error('Notification feed load failed:', loadError);
        if (!cancelled) {
          setError('Unable to fetch alert data right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadFeed();

    return () => {
      cancelled = true;
    };
  }, [canViewSOS]);

  useEffect(() => {
    joinDashboard();

    const offAlert = on<{
      id: string;
      title: string;
      message: string;
      type: CrisisAlert['type'];
      affectedCity: string;
      createdAt: string;
    }>('new_alert', (payload) => {
      setAlerts((prev) => [
        {
          _id: payload.id,
          title: payload.title,
          message: payload.message,
          type: payload.type,
          affectedCity: payload.affectedCity,
          isActive: true,
          createdAt: payload.createdAt,
        },
        ...prev.filter((item) => item._id !== payload.id),
      ]);
    });

    const offSos = canViewSOS
      ? on<{
          id: string;
          submittedBy?: { name: string; email: string; role: string };
          location: { coordinates: [number, number]; label: string };
          severity: SOSRequest['severity'];
          crisisType?: SOSRequest['crisisType'];
          region?: string;
          message: string;
          status: SOSRequest['status'];
          createdAt: string;
        }>('new_sos', (payload) => {
          setSosItems((prev) => [
            {
              _id: payload.id,
              submittedBy: payload.submittedBy || { name: 'Citizen', email: '', role: 'citizen' },
              location: payload.location,
              severity: payload.severity,
              crisisType: payload.crisisType,
              region: payload.region,
              message: payload.message,
              status: payload.status,
              assignedTeam: null,
              createdAt: payload.createdAt,
            },
            ...prev.filter((item) => item._id !== payload.id),
          ]);
        })
      : () => undefined;

    const offSosUpdated = canViewSOS
      ? on<{ id: string; status: SOSRequest['status']; assignedTeam: string | null; resolvedAt?: string | null }>(
          'sos_updated',
          (payload) => {
            setSosItems((prev) =>
              prev.map((item) =>
                item._id === payload.id
                  ? {
                      ...item,
                      status: payload.status,
                      assignedTeam: payload.assignedTeam,
                      resolvedAt: payload.resolvedAt ?? item.resolvedAt,
                    }
                  : item
              )
            );
          }
        )
      : () => undefined;

    return () => {
      offAlert();
      offSos();
      offSosUpdated();
    };
  }, [canViewSOS, joinDashboard, on]);

  const localFeed = useMemo<FeedItem[]>(
    () =>
      notifications.map((notification) => ({
        id: `local-${notification.id}`,
        kind: 'system',
        title: notification.title,
        message: notification.message,
        tone: notification.type,
        timestamp: notification.timestamp,
      })),
    [notifications]
  );

  const serverFeed = useMemo<FeedItem[]>(
    () => [...alerts.map(formatAlertItem), ...sosItems.map(formatSosItem)],
    [alerts, sosItems]
  );

  const items = useMemo(
    () =>
      [...serverFeed, ...localFeed]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .filter((item, index, arr) => arr.findIndex((entry) => entry.id === item.id) === index),
    [localFeed, serverFeed]
  );

  return (
    <div className="relief-page text-white">
      <div className="relief-orb right-[10%] top-[12%] h-72 w-72 bg-[rgba(139,0,0,0.18)]" />
      <div className="relative z-10 mx-auto w-full max-w-6xl space-y-6 px-4 py-5 sm:px-6 sm:py-6">
        <div>
          <BackToDashboardButton />
        </div>

        <section className="relief-panel rounded-[1.75rem] p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <Bell className="h-8 w-8 text-[var(--color-relief-orange)]" />
            </div>
            <div>
              <div className="relief-chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.3em]">
                Alert Feed
              </div>
              <h1 className="relief-title mt-4 text-3xl font-bold tracking-tight text-white">Notifications Center</h1>
              <p className="relief-muted mt-2 text-sm">
                Live crisis alerts, SOS activity, and in-app operational updates.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          {loading ? (
            <div className="relief-card rounded-[1.5rem] p-8 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-200" />
              <div className="mt-4 text-lg font-semibold text-white">Loading alerts</div>
              <div className="mt-2 text-sm text-gray-400">Fetching live notifications and SOS activity.</div>
            </div>
          ) : error ? (
            <div className="relief-card rounded-[1.5rem] p-8 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-amber-200" />
              <div className="mt-4 text-lg font-semibold text-white">Feed unavailable</div>
              <div className="mt-2 text-sm text-gray-400">{error}</div>
            </div>
          ) : items.length > 0 ? (
            items.map((item) => (
              <div key={item.id} className="relief-card rounded-[1.5rem] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      {item.kind === 'sos' ? (
                        <RadioTower className={`h-4 w-4 ${toneStyles[item.tone]}`} />
                      ) : (
                        <Bell className={`h-4 w-4 ${toneStyles[item.tone]}`} />
                      )}
                      <div className="text-sm font-semibold text-white">{item.title}</div>
                    </div>
                    <div className="mt-2 text-sm text-gray-400">{item.message}</div>
                    {item.meta ? <div className="mt-2 text-xs text-gray-500">{item.meta}</div> : null}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-gray-500">
                    {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="relief-card rounded-[1.5rem] p-8 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-[var(--color-relief-orange)]" />
              <div className="mt-4 text-lg font-semibold text-white">No active notifications</div>
              <div className="mt-2 text-sm text-gray-400">Fresh alerts will appear here as operations update in real time.</div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
