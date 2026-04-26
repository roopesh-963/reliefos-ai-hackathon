import { ArrowRight, LifeBuoy, MapPinned, Package, ShieldAlert } from 'lucide-react';
import type { AssistantContextSnapshot } from '../../services/assistant';

const stepIcons = [ShieldAlert, MapPinned, Package, LifeBuoy] as const;

function buildStory(context: AssistantContextSnapshot) {
  const topIncident = context.prioritizedIncidents[0];
  const topDispatch = context.dispatchRecommendations[0];
  const topShortage = context.shortagePredictions[0];
  const shelter = context.nearestShelters[0];

  return [
    {
      title: 'AI detects pressure',
      detail: topIncident
        ? `${topIncident.region} is now the highest-priority zone because ${topIncident.why?.[0] || 'live incident pressure is rising'}.`
        : 'Live incident pressure is monitored continuously across all active zones.',
    },
    {
      title: 'Map confirms location',
      detail: topIncident
        ? `Crisis Map centers the team on ${topIncident.region} and nearby shelter coverage.`
        : 'Crisis Map verifies impact areas, terrain risk, and nearby shelter options.',
    },
    {
      title: 'Ops recommends action',
      detail: topDispatch
        ? `${topDispatch.action} with ${topDispatch.quantity} ${topDispatch.unit} of ${topDispatch.resourceType.toLowerCase()}.`
        : topShortage
          ? `Stock pressure is building around ${topShortage.type.toLowerCase()} and should be pre-positioned now.`
          : 'Operations AI prepares the next best dispatch before queues escalate.',
    },
    {
      title: 'Citizen impact closes the loop',
      detail: shelter
        ? `Citizens can be guided toward ${shelter.name} while field teams stabilize response.`
        : 'Citizen SOS and shelter guidance reflect the same live command context.',
    },
  ];
}

export function JudgeDemoStoryline({ context }: { context: AssistantContextSnapshot }) {
  const steps = buildStory(context);

  return (
    <section className="bg-white/[0.03] p-5 backdrop-blur-xl">
      <div className="mb-4 text-[11px] uppercase tracking-[0.24em] text-white/42">Judge Demo Flow</div>
      <div className="grid gap-3 lg:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = stepIcons[index];
          return (
            <div key={step.title} className="bg-black/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-white/36">Step {index + 1}</div>
                <Icon className="h-4 w-4 text-cyan-100/70" />
              </div>
              <div className="mt-3 text-sm font-semibold text-white">{step.title}</div>
              <div className="mt-2 text-sm leading-6 text-white/58">{step.detail}</div>
              {index < steps.length - 1 && (
                <div className="mt-4 hidden lg:flex justify-end text-white/22">
                  <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default JudgeDemoStoryline;
