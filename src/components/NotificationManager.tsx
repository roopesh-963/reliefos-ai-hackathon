import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Bell, X, Info, CheckCircle2 } from 'lucide-react';
import { useNotifications, NotificationType } from '../hooks/useNotifications';
import { cn } from '../lib/utils';

const iconMap: Record<NotificationType, any> = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertTriangle,
  success: CheckCircle2,
};

const colorMap: Record<NotificationType, string> = {
  info: 'border-blue-500/50 bg-blue-500/10 text-blue-400',
  warning: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400',
  critical: 'border-red-500/50 bg-red-500/10 text-red-500',
  success: 'border-green-500/50 bg-green-500/10 text-green-400',
};

export const NotificationManager: React.FC = () => {
  const { notifications, removeNotification } = useNotifications();

  return (
    <div className="fixed top-24 right-6 z-[9999] flex flex-col gap-3 pointer-events-none w-80">
      <AnimatePresence>
        {notifications.map((n) => {
          const Icon = iconMap[n.type];
          return (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={cn(
                "pointer-events-auto relative overflow-hidden p-4 rounded-xl border backdrop-blur-md shadow-2xl flex gap-4",
                colorMap[n.type]
              )}
            >
              {/* Pulsing indicator for critical */}
              {n.type === 'critical' && (
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-red-500">
                  <motion.div 
                    className="h-full bg-white/50"
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{ duration: 10, ease: "linear" }}
                  />
                </div>
              )}

              <div className={cn(
                "p-2 rounded-lg h-fit",
                n.type === 'critical' ? 'bg-red-500 text-white animate-pulse' : 'bg-white/5'
              )}>
                <Icon className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-bold font-display uppercase tracking-wider truncate mr-2">
                    {n.title}
                  </h4>
                  <button 
                    onClick={() => removeNotification(n.id)}
                    className="text-white/20 hover:text-white transition-colors p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-[10px] opacity-70 leading-relaxed font-mono">
                  {n.message}
                </p>
                <div className="mt-2 text-[8px] opacity-40 font-mono tracking-widest uppercase">
                  {n.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
