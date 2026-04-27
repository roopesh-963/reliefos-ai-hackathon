import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeDollarSign,
  Biohazard,
  Globe2,
  LoaderCircle,
  ShieldAlert,
  Soup,
  Waves,
  Zap,
} from 'lucide-react';
import OperationsCopilot from '../components/assistant/OperationsCopilot';
import { BackToDashboardButton } from '../components/navigation/BackToDashboardButton';
import { cn } from '../lib/utils';
import {
  fetchGlobalCrisisOverview,
  GlobalCrisisCard,
  GlobalCrisisOverview,
  GlobalCrisisType,
} from '../services/api';
import { useNotifications } from '../hooks/useNotifications';

const ICON_MAP: Record<GlobalCrisisType, typeof Waves> = {
  natural_disaster: Waves,
  financial_crisis: BadgeDollarSign,
  war_conflict: ShieldAlert,
  food_shortage: Soup,
  health_outbreak: Biohazard,
  energy_water_crisis: Zap,
};

const DEFAULT_OVERVIEW: GlobalCrisisOverview = {
  updatedAt: new Date(0).toISOString(),
  executiveSummary: {
    headline: 'Global crisis monitoring is initializing.',
    summary: 'ReliefOS AI is preparing universal crisis telemetry feeds.',
    watchwords: [],
    preventionFocus: 'Awaiting live risk synthesis.',
    responseFocus: 'Awaiting live response synthesis.',
  },
  cards: [],
  sourceStatus: {
    newsApiEnabled: false,
    aiEnabled: false,
    usgsEnabled: true,
    worldBankEnabled: true,
    outbreakEnabled: true,
    mode: 'partial',
  },
};

const severityTone = (severity: GlobalCrisisCard['severity']) => {
  if (severity === 'Critical') {
    return 'border-rose-300/22 bg-rose-500/[0.08] text-rose-100';
  }
  if (severity === 'Warning') {
    return 'border-amber-300/22 bg-amber-500/[0.08] text-amber-100';
  }
  return 'border-cyan-300/20 bg-cyan-500/[0.07] text-cyan-100';
};

const sourceChipTone = (enabled: boolean) =>
  enabled
    ? 'border-emerald-300/18 bg-emerald-500/[0.08] text-emerald-100'
    : 'border-white/10 bg-white/[0.04] text-white/55';

function CrisisCard({ card }: { card: GlobalCrisisCard }) {
  const Icon = ICON_MAP[card.type] || Globe2;

  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(14,23,38,0.92)_0%,rgba(7,14,24,0.96)_100%)] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.28)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-white/45">Crisis Lane</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{card.label}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.24em]', severityTone(card.severity))}>
            {card.severity}
          </span>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/14 bg-cyan-500/[0.08] text-cyan-100">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_140px]">
        <div>
          <p className="text-sm leading-7 text-white/78">{card.executiveSummary}</p>
          <p className="mt-3 text-sm leading-7 text-white/58">{card.summary}</p>
        </div>
        <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-4 text-center">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/44">Risk Score</div>
          <div className="mt-3 text-4xl font-semibold text-white">{card.score}</div>
          <div className="mt-2 text-xs text-white/56">AI-classified {card.classification.replaceAll('_', ' ')}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[11px] uppercase tracking-[0.26em] text-white/46">Executive Summary Cards</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {card.metrics.map((metric) => (
              <div key={`${card.type}-${metric.label}`} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/75">
                <span className="text-white/46">{metric.label}:</span> {metric.value}
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {card.topSignals.map((signal) => (
              <div key={signal} className="text-sm leading-6 text-white/72">
                {signal}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[11px] uppercase tracking-[0.26em] text-white/46">Prevention Recommendations</div>
          <div className="mt-3 space-y-2">
            {card.preventionRecommendations.map((item) => (
              <div key={item} className="text-sm leading-6 text-white/72">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[11px] uppercase tracking-[0.26em] text-white/46">Control / Response Actions</div>
          <div className="mt-3 space-y-2">
            {card.responseActions.map((item) => (
              <div key={item} className="text-sm leading-6 text-white/72">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[11px] uppercase tracking-[0.26em] text-white/46">Integrated Public Feeds</div>
          <div className="mt-3 space-y-3">
            {card.articles.slice(0, 3).map((article) => (
              <a
                key={article.id}
                href={article.url || '#'}
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:bg-white/[0.05]"
              >
                <div className="text-sm font-medium text-white">{article.title}</div>
                <div className="mt-1 text-xs leading-5 text-white/58">{article.description}</div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.24em] text-white/40">
                  {article.source} • {new Date(article.publishedAt).toLocaleString()}
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function GlobalCrisisDashboard() {
  const [overview, setOverview] = useState<GlobalCrisisOverview>(DEFAULT_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const lastHeadlineRef = useRef<string | null>(null);
  const { addNotification } = useNotifications();

  useEffect(() => {
    let mounted = true;

    const loadOverview = async () => {
      try {
        if (mounted) {
          setLoading(true);
        }

        const data = await fetchGlobalCrisisOverview();
        if (!mounted) {
          return;
        }

        setOverview(data);
        if (lastHeadlineRef.current && lastHeadlineRef.current !== data.executiveSummary.headline) {
          addNotification({
            type: 'info',
            title: 'Global Crisis Brief Updated',
            message: data.executiveSummary.headline,
          });
        }
        lastHeadlineRef.current = data.executiveSummary.headline;
      } catch (error) {
        console.error('Failed to load global crisis overview:', error);
        if (mounted) {
          addNotification({
            type: 'warning',
            title: 'Global Feeds Delayed',
            message: 'Universal crisis intelligence is temporarily running in partial mode.',
          });
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadOverview();
    const interval = window.setInterval(loadOverview, 4 * 60 * 1000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [addNotification]);

  const highestRiskCard = useMemo(() => {
    return overview.cards[0] || null;
  }, [overview.cards]);

  return (
    <div className="min-h-screen bg-[#030711] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(66,173,255,0.12),transparent_32%),radial-gradient(circle_at_18%_22%,rgba(255,124,64,0.12),transparent_24%),linear-gradient(180deg,rgba(3,7,17,0.92)_0%,rgba(3,7,17,1)_100%)]" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6">
        <BackToDashboardButton />

        <section className="mt-5 rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,29,0.78)_0%,rgba(8,13,22,0.92)_100%)] p-6 shadow-[0_36px_120px_rgba(0,0,0,0.32)] sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/16 bg-cyan-500/[0.08] px-4 py-2 text-[11px] uppercase tracking-[0.34em] text-cyan-100/88">
                <Globe2 className="h-3.5 w-3.5" />
                Universal Crisis Intelligence Platform
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl xl:text-6xl">
                {overview.executiveSummary.headline}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-white/64 sm:text-lg">
                {overview.executiveSummary.summary}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[440px]">
              <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/42">Top Watch Area</div>
                <div className="mt-3 text-2xl font-semibold text-white">{highestRiskCard?.label || 'Loading'}</div>
                <div className="mt-2 text-sm text-white/58">{highestRiskCard?.severity || 'Monitoring'}</div>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/42">Platform Mode</div>
                <div className="mt-3 text-2xl font-semibold text-white">{overview.sourceStatus.mode}</div>
                <div className="mt-2 text-sm text-white/58">
                  Updated {new Date(overview.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <div className="rounded-[1.4rem] border border-cyan-300/16 bg-cyan-500/[0.06] p-4 lg:col-span-3">
              <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.26em] text-cyan-100/76">
                <Globe2 className="h-4 w-4" />
                AI Global Summary
              </div>
              <div className="mt-3 text-lg font-semibold text-white">
                {overview.executiveSummary.headline}
              </div>
              <div className="mt-3 max-w-5xl text-sm leading-7 text-white/72">
                {overview.executiveSummary.summary}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(overview.executiveSummary.watchwords || []).slice(0, 4).map((item) => (
                  <div
                    key={item}
                    className="rounded-full border border-cyan-300/12 bg-white/[0.04] px-3 py-2 text-xs text-white/74"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="text-[11px] uppercase tracking-[0.26em] text-white/42">AI Executive Summary Cards</div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-white/74">
                {overview.executiveSummary.watchwords.length > 0 ? (
                  overview.executiveSummary.watchwords.map((item) => <div key={item}>{item}</div>)
                ) : (
                  <div>Watchwords will appear once the next synthesis completes.</div>
                )}
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="text-[11px] uppercase tracking-[0.26em] text-white/42">Prevention Focus</div>
              <div className="mt-3 text-sm leading-7 text-white/74">{overview.executiveSummary.preventionFocus}</div>
            </div>

            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="text-[11px] uppercase tracking-[0.26em] text-white/42">Control Focus</div>
              <div className="mt-3 text-sm leading-7 text-white/74">{overview.executiveSummary.responseFocus}</div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <div className={cn('rounded-full border px-3 py-2 text-xs', sourceChipTone(overview.sourceStatus.newsApiEnabled))}>
              News feed
            </div>
            <div className={cn('rounded-full border px-3 py-2 text-xs', sourceChipTone(overview.sourceStatus.aiEnabled))}>
              Gemini synthesis
            </div>
            <div className={cn('rounded-full border px-3 py-2 text-xs', sourceChipTone(overview.sourceStatus.usgsEnabled))}>
              USGS
            </div>
            <div className={cn('rounded-full border px-3 py-2 text-xs', sourceChipTone(overview.sourceStatus.worldBankEnabled))}>
              World Bank
            </div>
            <div className={cn('rounded-full border px-3 py-2 text-xs', sourceChipTone(overview.sourceStatus.outbreakEnabled))}>
              Outbreak tracker
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center text-white/72">
            <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
            Loading universal crisis intelligence...
          </div>
        ) : overview.cards.length === 0 ? (
          <div className="mt-6 rounded-[1.6rem] border border-amber-300/18 bg-amber-500/[0.06] p-5 text-sm text-amber-100/86">
            No global crisis lanes are available yet.
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {overview.cards.map((card) => (
              <CrisisCard key={card.type} card={card} />
            ))}
          </div>
        )}

        <section className="mt-6">
          <div className="mb-4">
            <div className="text-[11px] uppercase tracking-[0.28em] text-white/42">Global Copilot</div>
            <div className="mt-1 text-sm text-white/66">
              Ask for one AI summary, compare crisis lanes, or request prevention and response actions.
            </div>
          </div>
          <OperationsCopilot embedded />
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.26em] text-white/42">
              <Activity className="h-4 w-4" />
              Universal Monitoring
            </div>
            <div className="mt-3 text-sm leading-7 text-white/70">
              ReliefOS AI now tracks natural disasters, financial crises, war/conflict, food shortages, health outbreaks, and energy/water stress in one surface.
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.26em] text-white/42">
              <AlertTriangle className="h-4 w-4" />
              Classification Engine
            </div>
            <div className="mt-3 text-sm leading-7 text-white/70">
              Headlines are classified into crisis lanes, scored, and fused with public indicators before the Gemini executive synthesis runs.
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.26em] text-white/42">
              <Globe2 className="h-4 w-4" />
              Existing Disaster Modules
            </div>
            <div className="mt-3 text-sm leading-7 text-white/70">
              The original disaster intel routes remain intact, so Crisis Map, SOS, logistics, and analytics continue to operate independently.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
