import OperationsCopilot from '../components/assistant/OperationsCopilot';
import { BackToDashboardButton } from '../components/navigation/BackToDashboardButton';

export default function AIAssistant() {
  return (
    <div className="relief-page text-white">
      <div className="relief-orb left-[8%] top-[10%] h-80 w-80 bg-[rgba(255,98,70,0.16)]" />
      <div className="relief-orb right-[4%] top-[18%] h-64 w-64 bg-[rgba(139,0,0,0.18)]" />
      <div className="dashboard-particles absolute inset-0 opacity-26" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1700px] flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex items-center justify-between gap-4">
          <BackToDashboardButton />
          <div className="hidden text-right md:block">
            <div className="text-[10px] uppercase tracking-[0.28em] text-white/38">ReliefOS AI</div>
            <div className="mt-1 text-sm text-white/70">Operations Copilot</div>
          </div>
        </div>
        <section className="min-h-0 flex-1">
          <OperationsCopilot embedded />
        </section>
      </div>
    </div>
  );
}
