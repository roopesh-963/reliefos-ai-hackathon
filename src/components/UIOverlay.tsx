import { memo } from 'react';
import { motion } from 'motion/react';
import { Activity, ArrowRight, ChevronDown, Cpu, Menu, Radio, Shield } from 'lucide-react';
import { cn } from '../lib/utils';

interface UIOverlayProps {
  progress: number;
  onNavigate: (path: string) => void;
  lowPower?: boolean;
}

const NAV_ITEMS = ['Crisis Map', 'Intelligence', 'Logistics'] as const;
const ANALYTICS_CARDS = [
  { icon: Shield, label: 'AI Shielding', value: '99.9%' },
  { icon: Radio, label: 'Drone Network', value: 'Active' },
  { icon: Activity, label: 'Structural Integrity', value: 'Nominal' },
] as const;

const deferredSectionStyle = {
  contentVisibility: 'auto' as const,
  containIntrinsicSize: '100vh',
};

export const UIOverlay = memo(function UIOverlay({ progress, onNavigate, lowPower = false }: UIOverlayProps) {
  return (
    <div className="w-screen font-sans text-white">
      <header className="fixed top-0 left-0 w-full px-10 py-8 flex justify-between items-center z-[100] pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto cursor-pointer" onClick={() => onNavigate('/landing')}>
          <Shield className="w-8 h-8 text-blue-500" />
          <span className="font-display font-bold text-2xl tracking-tighter">RELIEFOS</span>
        </div>

        <nav className="hidden md:flex items-center gap-10 pointer-events-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              onClick={() => onNavigate(item === 'Intelligence' ? '/ai-assistant' : item === 'Logistics' ? '/supply-chain' : '/crisis-map')}
              className="text-[10px] uppercase font-bold tracking-[0.3em] text-gray-400 hover:text-white transition-colors"
            >
              {item}
            </button>
          ))}
          <button
            onClick={() => onNavigate('/dashboard')}
            className="px-6 py-2 bg-[#1c222d] border border-white/10 rounded-lg text-[10px] uppercase font-bold tracking-[0.3em] text-white hover:bg-blue-600 transition-all shadow-lg"
          >
            Mission Start
          </button>
        </nav>

        <button className="md:hidden pointer-events-auto" type="button" aria-label="Open navigation">
          <Menu className="w-6 h-6" />
        </button>
      </header>

      <section className="relative h-screen flex flex-col items-center justify-center pointer-events-none">
        <motion.div
          initial={lowPower ? false : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: progress < 0.1 ? 1 : 0, scale: 1 }}
          transition={{ duration: lowPower ? 0.45 : 0.8 }}
          className="text-center z-10 will-change-[transform,opacity]"
        >
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-4 mb-2">
              <div className="h-[1px] w-12 bg-blue-500/50" />
              <span className="text-[10px] font-mono tracking-[0.3em] text-blue-400 uppercase">System Initialized</span>
              <div className="h-[1px] w-12 bg-blue-500/50" />
            </div>

            <h1 className="text-8xl md:text-[15vw] font-display font-bold tracking-tighter leading-none mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white via-gray-100 to-gray-700 drop-shadow-[0_0_25px_rgba(59,130,246,0.2)]">
              RELIEFOS
            </h1>

            <div className="flex items-center gap-6">
              <p className="text-xl md:text-2xl font-light tracking-[0.8em] uppercase text-gray-400 opacity-80">
                Rebuilding Order <span className="text-blue-500/80 font-normal animate-pulse">From Chaos</span>
              </p>
            </div>

            <div className="mt-8 flex gap-8">
              <div className="flex flex-col items-center">
                <span className="text-[9px] uppercase tracking-widest text-gray-500">Core Logic</span>
                <span className="text-xs font-mono text-blue-400/70">v.4.0.2</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[9px] uppercase tracking-widest text-gray-500">Processing</span>
                <span className="text-xs font-mono text-blue-400/70">Edge-Cloud</span>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="absolute bottom-10 animate-bounce">
          <ChevronDown className="w-8 h-8 text-gray-500" />
        </div>
      </section>

      <section className="h-screen flex items-center justify-start px-10 md:px-20" style={deferredSectionStyle}>
        <div
          className={cn(
            'max-w-xl transition-all duration-700 will-change-[transform,opacity]',
            progress > 0.1 && progress < 0.3 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'
          )}
        >
          <div className="flex items-center gap-2 mb-4 text-orange-500 bg-orange-500/10 px-3 py-1 rounded-full w-fit">
            <Activity className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Crisis Detected</span>
          </div>
          <h2 className="text-5xl font-display font-bold mb-6 italic">The Singularity of Destruction.</h2>
          <p className="text-gray-400 text-lg leading-relaxed">
            In the heart of entropy, all complexity is stripped away. RelieofOS AI thrives where others fail, processing cataclysmic data at the edge of existence.
          </p>
        </div>
      </section>

      <section className="h-screen flex items-center justify-end px-10 md:px-20" style={deferredSectionStyle}>
        <div
          className={cn(
            'max-w-xl text-right transition-all duration-700 will-change-[transform,opacity]',
            progress > 0.3 && progress < 0.5 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'
          )}
        >
          <div className="flex items-center gap-2 mb-4 text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full w-fit ml-auto">
            <Cpu className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Stability Protocol</span>
          </div>
          <h2 className="text-5xl font-display font-bold mb-6 italic">Signal, Refined.</h2>
          <p className="text-gray-400 text-lg leading-relaxed">
            A lighter command horizon keeps the landing experience fast while live intelligence, anomaly detection, and crisis response stay front and center.
          </p>
        </div>
      </section>

      <section className="h-screen flex items-center justify-center px-10" style={deferredSectionStyle}>
        <div
          className={cn(
            'grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl transition-all duration-700 will-change-[transform,opacity]',
            progress > 0.5 && progress < 0.8 ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          )}
        >
          {ANALYTICS_CARDS.map((stat) => (
            <div key={stat.label} className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-2xl group hover:border-blue-500/50 transition-colors">
              <stat.icon className="w-10 h-10 text-blue-500 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-sm font-bold uppercase tracking-tighter text-gray-500 mb-1">{stat.label}</h3>
              <p className="text-4xl font-display font-bold">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="h-screen flex flex-col items-center justify-center text-center px-10" style={deferredSectionStyle}>
        <div
          className={cn(
            'transition-all duration-700 will-change-[transform,opacity]',
            progress > 0.8 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          )}
        >
          <h2 className="text-6xl md:text-8xl font-display font-bold mb-10">THE NEW HORIZON.</h2>
          <div className="flex justify-center pointer-events-auto">
            <button
              onClick={() => onNavigate('/dashboard')}
              className="inline-flex items-center px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] shadow-lg uppercase tracking-widest text-xs"
            >
              Access Command Center
              <ArrowRight className="ml-2 w-5 h-5" />
            </button>
          </div>
          <p className="mt-20 text-gray-600 text-sm uppercase tracking-[0.5em]">&copy; 2026 ReliefOS Global Intelligence</p>
        </div>
      </section>
    </div>
  );
});
