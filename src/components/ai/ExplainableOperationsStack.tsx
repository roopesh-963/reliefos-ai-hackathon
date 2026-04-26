import { AlertTriangle, ArrowRight, Brain, Truck, Waves } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AssistantContextSnapshot } from '../../services/assistant';

type PriorityItem = AssistantContextSnapshot['prioritizedIncidents'][number];
type ShortageItem = AssistantContextSnapshot['shortagePredictions'][number];
type DispatchItem = AssistantContextSnapshot['dispatchRecommendations'][number];

function toneForPriority(label: string) {
  if (label === 'Critical') return 'border-rose-300/25 bg-rose-400/[0.08] text-rose-100';
  if (label === 'High') return 'border-amber-300/25 bg-amber-400/[0.08] text-amber-100';
  if (label === 'Elevated') return 'border-sky-200/30 bg-sky-200/[0.1] text-sky-50';
  return 'border-sky-100/20 bg-sky-200/[0.06] text-sky-50/80';
}

function toneForRisk(label: string) {
  if (label === 'Critical') return 'text-rose-100';
  if (label === 'High') return 'text-amber-100';
  if (label === 'Watch') return 'text-sky-100';
  return 'text-sky-50';
}

function SectionFrame({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] border border-sky-100/12 bg-[linear-gradient(180deg,rgba(201,240,255,0.1)_0%,rgba(86,177,226,0.08)_100%)] p-5 shadow-[0_20px_60px_rgba(5,18,33,0.18)] backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.26em] text-sky-100/68">
        <Icon className="h-3.5 w-3.5 text-sky-100/82" />
        {title}
      </div>
      {children}
    </section>
  );
}

export function ExplainableOperationsStack({
  priorities = [],
  shortages = [],
  dispatches = [],
  compact = false,
  className,
}: {
  priorities?: PriorityItem[];
  shortages?: ShortageItem[];
  dispatches?: DispatchItem[];
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-4', compact ? 'lg:grid-cols-2' : 'xl:grid-cols-3', className)}>
      <SectionFrame title="Priority Queue" icon={AlertTriangle}>
        <div className="space-y-3">
          {priorities.length > 0 ? (
            priorities.slice(0, compact ? 2 : 3).map((item) => (
              <div key={item.id} className="rounded-[1.1rem] border border-sky-100/10 bg-sky-200/[0.06] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{item.region}</div>
                    <div className="mt-1 text-xs text-sky-50/56">
                      {item.crisisType} | {item.ageMinutes} min old
                    </div>
                  </div>
                  <span className={cn('border px-2 py-1 text-[10px] uppercase tracking-[0.22em]', toneForPriority(item.priorityLabel))}>
                    {item.priorityLabel}
                  </span>
                </div>
                <div className="mt-3 text-sm text-sky-50/82">{item.recommendedAction}</div>
                {item.why?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.why.slice(0, 3).map((reason) => (
                      <span key={reason} className="rounded-full border border-sky-100/10 bg-sky-200/[0.05] px-2.5 py-1 text-[10px] text-sky-50/62">
                        {reason}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-sm text-sky-50/56">No priority escalations are active.</div>
          )}
        </div>
      </SectionFrame>

      <SectionFrame title="Shortage Forecast" icon={Waves}>
        <div className="space-y-3">
          {shortages.length > 0 ? (
            shortages.slice(0, compact ? 2 : 3).map((item) => (
              <div key={item.id} className="rounded-[1.1rem] border border-sky-100/10 bg-sky-200/[0.06] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{item.type}</div>
                    <div className="mt-1 text-xs text-sky-50/56">{item.location}</div>
                  </div>
                  <div className={cn('text-sm font-semibold', toneForRisk(item.riskLevel))}>{item.riskLevel}</div>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-2xl font-semibold text-white">{item.daysRemaining}</div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-sky-100/56">days remaining</div>
                  </div>
                  <div className="text-right text-xs text-sky-50/60">
                    {item.currentQuantity} {item.unit}
                  </div>
                </div>
                {item.why?.length > 0 && (
                  <div className="mt-3 space-y-1.5 text-xs text-sky-50/62">
                    {item.why.slice(0, 2).map((reason) => (
                      <div key={reason}>{reason}</div>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-sm text-sky-50/56">No shortage pressure is projected yet.</div>
          )}
        </div>
      </SectionFrame>

      <SectionFrame title="Dispatch Recommendations" icon={Truck}>
        <div className="space-y-3">
          {dispatches.length > 0 ? (
            dispatches.slice(0, compact ? 2 : 3).map((item) => (
              <div key={item.id} className="rounded-[1.1rem] border border-sky-100/10 bg-sky-200/[0.06] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className={cn('border px-2 py-1 text-[10px] uppercase tracking-[0.22em]', toneForPriority(item.priorityLabel))}>
                    {item.priorityLabel}
                  </span>
                  <div className="text-xs text-sky-50/56">{item.etaMinutes} min ETA</div>
                </div>
                <div className="mt-3 text-sm font-semibold text-white">{item.action}</div>
                <div className="mt-2 flex items-center gap-2 text-xs text-sky-50/60">
                  <span>{item.from}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-sky-100/34" />
                  <span>{item.to}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-sky-50/62">
                  <span>
                    {item.quantity} {item.unit} of {item.resourceType}
                  </span>
                  {item.shipmentId && <span>Linked {item.shipmentId}</span>}
                </div>
                {item.why?.length > 0 && (
                  <div className="mt-3 rounded-xl border border-sky-100/10 bg-sky-200/[0.05] px-3 py-2 text-xs text-sky-50/60">
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-sky-100/48">
                      <Brain className="h-3 w-3" />
                      Why
                    </div>
                    {item.why[0]}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-sm text-sky-50/56">No dispatch interventions are pending.</div>
          )}
        </div>
      </SectionFrame>
    </div>
  );
}

export default ExplainableOperationsStack;
