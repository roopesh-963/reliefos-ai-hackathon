import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bot,
  Brain,
  Loader2,
  MessageSquareCode,
  Mic,
  PanelLeft,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Truck,
  Waves,
  Warehouse,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../../lib/utils';
import {
  AssistantAction,
  AssistantContextSnapshot,
  ChatMessage,
  clearAssistantHistory,
  createShipment,
  defaultAssistantContext,
  getAnalyticsIncidentsTrend,
  getAnalyticsInsights,
  getAnalyticsOverview,
  getAssistantContext,
  getCurrentUser,
  rerouteShipment,
  sendAssistantChatMessage,
} from '../../services/api';
import { useNotifications } from '../../hooks/useNotifications';

interface OperationsCopilotProps {
  embedded?: boolean;
}

interface CopilotMessage extends ChatMessage {
  actions?: AssistantAction[];
}

const MODE_OPTIONS = [
  { id: 'citizen', label: 'Citizen', icon: Waves },
  { id: 'admin', label: 'Admin', icon: Brain },
  { id: 'logistics', label: 'Logistics', icon: Truck },
  { id: 'analytics', label: 'Analytics', icon: Warehouse },
] as const;

const defaultContext: AssistantContextSnapshot = {
  ...defaultAssistantContext,
  generatedAt: new Date().toISOString(),
  aiBriefing: {
    ...defaultAssistantContext.aiBriefing,
    summary: 'AI briefing will appear once live context finishes syncing.',
    topPriorityReason: 'Awaiting live incident context.',
    shortageHeadline: 'No shortage forecast yet',
    dispatchHeadline: 'No dispatch recommendation yet',
  },
};

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

const resolvePage = (pathname: string) => {
  if (pathname.startsWith('/resources')) return 'resources';
  if (pathname.startsWith('/supply-chain') || pathname.startsWith('/supply')) return 'supply';
  if (pathname.startsWith('/analytics')) return 'analytics';
  if (pathname.startsWith('/sos-citizen') || pathname.startsWith('/sos')) return 'sos';
  if (pathname.startsWith('/ai-assistant') || pathname.startsWith('/assistant')) return 'assistant';
  if (pathname.startsWith('/crisis-map') || pathname.startsWith('/map')) return 'map';
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  return 'landing';
};

const deriveMode = (page: string, role: string) => {
  if (page === 'resources' || page === 'supply') return 'logistics';
  if (page === 'analytics') return 'analytics';
  if (page === 'sos') return 'citizen';
  if (role === 'citizen') return 'citizen';
  if (role === 'rescue_team') return 'logistics';
  return 'admin';
};

const getSessionId = () => {
  const existing = localStorage.getItem('reliefos_assistant_session');
  if (existing) {
    return existing;
  }
  const created = `assistant-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem('reliefos_assistant_session', created);
  return created;
};

const getPromptList = (suggestedPrompts: string[], contextPrompts: string[]) =>
  Array.from(new Set([...(suggestedPrompts || []), ...(contextPrompts || [])])).filter(Boolean);

export function OperationsCopilot({ embedded = false }: OperationsCopilotProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const currentUser = getCurrentUser();
  const role = currentUser?.role || 'guest';
  const page = resolvePage(location.pathname);
  const [mode, setMode] = useState<string>(deriveMode(page, role));
  const [isOpen, setIsOpen] = useState(embedded);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState('');
  const [loadingContext, setLoadingContext] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [context, setContext] = useState<AssistantContextSnapshot>(defaultContext);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  const [geo, setGeo] = useState<{ lat?: number; lng?: number }>({});
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const sessionIdRef = useRef<string>(getSessionId());
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

  useEffect(() => {
    if (!embedded) {
      setMode((current) => current || deriveMode(page, role));
    }
  }, [embedded, page, role]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  useEffect(() => {
    if (!isOpen) return;
    if (geo.lat && geo.lng) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeo({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => undefined,
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
    );
  }, [geo.lat, geo.lng, isOpen]);

  const shouldRenderFloating = !embedded && location.pathname !== '/ai-assistant' && location.pathname !== '/assistant';
  const promptList = useMemo(
    () => getPromptList(suggestedPrompts, context.suggestedPrompts),
    [suggestedPrompts, context.suggestedPrompts]
  );
  const historyEntries = useMemo(
    () =>
      messages
        .map((message, index) => ({
          id: `${message.role}-${index}`,
          role: message.role,
          preview: message.text.replace(/\s+/g, ' ').trim(),
          index,
        }))
        .filter((entry) => entry.preview.length > 0)
        .reverse(),
    [messages]
  );

  const loadContext = async () => {
    if (!isOpen && !embedded) return;
    setLoadingContext(true);
    try {
      const data = await getAssistantContext({
        sessionId: sessionIdRef.current,
        role,
        page,
        mode,
        lat: geo.lat,
        lng: geo.lng,
      });

      setContext(data.context);
      setSuggestedPrompts(data.context.suggestedPrompts || []);
      setMessages(
        data.history.length > 0
          ? data.history
          : [
              {
                role: 'assistant',
                text: 'ReliefOS Operations Copilot is online. Ask for live incident summaries, shelter guidance, inventory pressure, convoy actions, or analytics interpretation.',
              },
            ]
      );
    } catch (error) {
      console.error('Failed to load assistant context:', error);
      setMessages([
        {
          role: 'assistant',
          text: 'The copilot context relay is temporarily unavailable. I can still help, but live data may be partial.',
        },
      ]);
    } finally {
      setLoadingContext(false);
    }
  };

  useEffect(() => {
    if (embedded || isOpen) {
      void loadContext();
    }
  }, [embedded, isOpen, mode, page, geo.lat, geo.lng]);

  const panelTitle = useMemo(() => {
    if (page === 'resources') return 'Inventory Copilot';
    if (page === 'supply') return 'Logistics Copilot';
    if (page === 'analytics') return 'Analytics Copilot';
    if (page === 'sos') return 'Citizen Copilot';
    return 'Operations Copilot';
  }, [page]);

  const executeAction = async (action: AssistantAction) => {
    if (action.confirmation && !window.confirm(action.confirmation)) {
      return;
    }

    try {
      if (action.type === 'create_shipment') {
        await createShipment(action.payload as any);
        addNotification({
          type: 'success',
          title: 'Shipment created',
          message: `${action.payload?.resourceType || 'Supply'} dispatch was created from the copilot.`,
        });
      } else if (action.type === 'reroute_shipment') {
        await rerouteShipment(String(action.payload?.shipmentId || ''), String(action.payload?.reason || 'Assistant reroute'));
        addNotification({
          type: 'info',
          title: 'Shipment rerouted',
          message: 'The selected convoy has been moved onto an alternate route.',
        });
      } else if (action.type === 'filter_delayed_deliveries') {
        navigate('/supply-chain?assistantFilter=delayed');
        addNotification({
          type: 'info',
          title: 'Delayed deliveries focus',
          message: 'Supply Chain view opened with delayed deliveries in focus.',
        });
      } else if (action.type === 'highlight_critical_sos') {
        navigate('/dashboard?assistantFocus=critical');
        addNotification({
          type: 'warning',
          title: 'Critical zones highlighted',
          message: 'Dashboard focus shifted to the most urgent incident clusters.',
        });
      } else if (action.type === 'open_nearest_shelters') {
        navigate('/crisis-map');
        addNotification({
          type: 'info',
          title: 'Nearest shelters',
          message:
            action.payload?.shelters?.slice?.(0, 2)?.map((item: any) => item.name).join(', ') ||
            'Crisis Map opened with shelter guidance.',
        });
      } else if (action.type === 'export_analytics_report') {
        const [overview, trend, insights] = await Promise.all([
          getAnalyticsOverview(),
          getAnalyticsIncidentsTrend(),
          getAnalyticsInsights(),
        ]);
        const content = [
          '# ReliefOS Analytics Report',
          `Generated: ${new Date().toLocaleString()}`,
          '',
          `- Total Incidents: ${overview.metrics.totalIncidents}`,
          `- Active Emergencies: ${overview.metrics.activeEmergencies}`,
          `- Avg Response Time: ${overview.metrics.avgResponseTime.toFixed(1)} min`,
          `- Resolution Rate: ${overview.metrics.resolutionRate.toFixed(1)}%`,
          '',
          '## Trend',
          ...trend.map((row) => `- ${row.name}: total ${row.total}, resolved ${row.resolved}, critical ${row.critical}`),
          '',
          '## Insights',
          ...insights.insights.map((item) => `- ${item.title}: ${item.message}`),
        ].join('\n');
        blobDownload(content, `reliefos-assistant-report-${Date.now()}.md`, 'text/markdown;charset=utf-8');
        addNotification({
          type: 'success',
          title: 'Analytics exported',
          message: 'A fresh analytics report has been downloaded.',
        });
      }
    } catch (error: any) {
      console.error('Assistant action failed:', error);
      addNotification({
        type: 'critical',
        title: 'Action failed',
        message: error?.response?.data?.message || 'The assistant action could not be completed.',
      });
    }
  };

  const handleSend = async (text = input) => {
    const nextText = text.trim();
    if (!nextText || isThinking) return;

    const userMessage: CopilotMessage = { role: 'user', text: nextText };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setIsThinking(true);

    try {
      const response = await sendAssistantChatMessage({
        sessionId: sessionIdRef.current,
        role,
        page,
        mode,
        messages: nextMessages.map((message) => ({
          role: message.role,
          text: message.text,
        })),
        lat: geo.lat,
        lng: geo.lng,
      });

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: response.reply,
          actions: response.actions,
        },
      ]);
      setContext(response.context);
      setSuggestedPrompts(response.suggestedPrompts || []);
    } catch (error) {
      console.error('Assistant chat failed:', error);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: 'The copilot relay timed out while preparing a response. Try again in a moment and I will continue from current operational data.',
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const clearHistory = async () => {
    try {
      await clearAssistantHistory({ sessionId: sessionIdRef.current });
      setMessages([
        {
          role: 'assistant',
          text: 'Conversation history cleared. The copilot context is still live and ready for a fresh command.',
        },
      ]);
      addNotification({
        type: 'info',
        title: 'Assistant reset',
        message: 'Conversation history has been cleared.',
      });
    } catch (error) {
      console.error('Clear assistant history failed:', error);
    }
  };

  const panel = (
    <motion.div
      initial={embedded ? false : { opacity: 0, x: 40, y: 12 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 40, y: 12 }}
      className={cn(
        embedded
          ? 'grid h-[calc(100vh-8.5rem)] min-h-[680px] grid-cols-1 overflow-hidden rounded-[2rem] border border-white/10 bg-[#07111f]/94 shadow-[0_28px_100px_rgba(0,0,0,0.46)] lg:grid-cols-[300px_minmax(0,1fr)]'
          : 'fixed bottom-6 right-6 z-[120] flex h-[min(82vh,780px)] w-[min(96vw,440px)] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#07111f]/94 shadow-[0_28px_100px_rgba(0,0,0,0.58)] backdrop-blur-xl'
      )}
    >
      {embedded && (
        <React.Fragment>
          <aside
            className={cn(
              'border-b border-white/10 bg-[rgba(10,10,12,0.72)] lg:border-b-0 lg:border-r',
              mobileHistoryOpen ? 'block' : 'hidden lg:flex',
              'min-h-0 flex-col'
            )}
          >
            <div className="border-b border-white/10 px-4 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Sparkles className="h-4 w-4 text-cyan-200" />
                ReliefOS AI
              </div>
              <div className="mt-1 text-xs uppercase tracking-[0.24em] text-white/38">{panelTitle}</div>
              <button
                type="button"
                onClick={() => void clearHistory()}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/86 transition hover:bg-white/8"
              >
                <Plus className="h-4 w-4" />
                New chat
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <div className="mb-3 px-2 text-[10px] uppercase tracking-[0.28em] text-white/32">History</div>
              <div className="space-y-2">
                {historyEntries.length > 0 ? (
                  historyEntries.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => {
                        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                        setMobileHistoryOpen(false);
                      }}
                      className="block w-full rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3 text-left transition hover:bg-white/[0.06]"
                    >
                      <div className="text-[10px] uppercase tracking-[0.24em] text-white/34">
                        {entry.role === 'user' ? 'You' : 'Assistant'}
                      </div>
                      <div className="mt-1 line-clamp-2 text-sm leading-6 text-white/78">{entry.preview}</div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-4 text-sm text-white/48">
                    Conversation history will appear here as you chat.
                  </div>
                )}
              </div>

              <div className="mt-5 space-y-2 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.24em] text-white/34">Live context</div>
                <div className="text-sm text-white/72">{context.activeIncidents} active incidents</div>
                <div className="text-sm text-white/72">{context.supplySummary.activeShipments} live shipments</div>
                <div className="text-sm text-white/72">{context.lowStockResources.length} low-stock signals</div>
              </div>
            </div>
          </aside>

          <div className={cn('min-h-0 flex-col', mobileHistoryOpen ? 'hidden lg:flex' : 'flex')}>
            <div className="relative overflow-hidden border-b border-white/10 px-4 py-3">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,107,61,0.14),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.05),transparent_32%)]" />
              <div className="relative z-10 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-500/10 px-2.5 py-1 text-[9px] uppercase tracking-[0.24em] text-cyan-100">
                    <Sparkles className="h-3.5 w-3.5" />
                    Chat
                  </div>
                  <div className="mt-2 text-lg font-bold tracking-tight text-white">{panelTitle}</div>
                  <div className="mt-1 text-xs text-gray-400">Live operational chat context.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileHistoryOpen((current) => !current)}
                  className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:text-white lg:hidden"
                >
                  <PanelLeft className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="border-b border-white/10 px-4 py-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MODE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setMode(option.id)}
                    className={cn(
                      'inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition',
                      mode === option.id
                        ? 'border-cyan-300/25 bg-cyan-500/15 text-cyan-50'
                        : 'border-white/10 bg-white/5 text-gray-300 hover:border-cyan-300/20'
                    )}
                  >
                    <option.icon className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
              {loadingContext ? (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing live operational context...
                </div>
              ) : (
                <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
                  <div className="space-y-6">
                    {messages.map((message, index) => (
                      <motion.div
                        key={`${message.role}-${index}-${message.text.slice(0, 24)}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn('flex gap-4', message.role === 'user' && 'justify-end')}
                      >
                        {message.role === 'assistant' && (
                          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-500/10 text-cyan-100">
                            <Bot className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0 max-w-[86%]">
                          <div className="mb-2 text-xs uppercase tracking-[0.22em] text-white/36">
                            {message.role === 'assistant' ? 'ReliefOS AI' : 'You'}
                          </div>
                          <div
                            className={cn(
                              'rounded-[1.75rem] border px-4 py-4 text-sm leading-7',
                              message.role === 'assistant'
                                ? 'border-white/10 bg-white/[0.04] text-gray-100'
                                : 'border-cyan-300/20 bg-cyan-500/12 text-cyan-50'
                            )}
                          >
                            {message.text}
                            {message.actions && message.actions.length > 0 && (
                              <div className="mt-4 flex flex-wrap gap-2">
                                {message.actions.map((action) => (
                                  <button
                                    key={action.id}
                                    type="button"
                                    onClick={() => void executeAction(action)}
                                    className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-50 transition hover:bg-cyan-500/15"
                                  >
                                    {action.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {message.role === 'user' && (
                          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-gray-100">
                            <MessageSquareCode className="h-4 w-4" />
                          </div>
                        )}
                      </motion.div>
                    ))}

                    {isThinking && (
                      <div className="flex gap-4">
                        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-500/10 text-cyan-100">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                        <div className="max-w-[86%]">
                          <div className="mb-2 text-xs uppercase tracking-[0.22em] text-white/36">ReliefOS AI</div>
                          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-gray-300">
                            ReliefOS AI is reviewing live incident, inventory, and convoy state before responding.
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messageEndRef} />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-white/10 bg-[rgba(7,17,31,0.92)] px-4 py-3 backdrop-blur-xl sm:px-6">
              <div className="mx-auto w-full max-w-3xl">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-[9px] uppercase tracking-[0.22em] text-gray-500">Suggested prompts</div>
                  <button
                    type="button"
                    onClick={() => void clearHistory()}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-gray-300 transition hover:text-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear
                  </button>
                </div>
                <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto pb-1">
                  {promptList.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void handleSend(prompt)}
                      className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-[11px] leading-5 text-gray-200 transition hover:border-cyan-300/20 hover:text-white"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <div className="flex items-end gap-2 rounded-[1.75rem] border border-white/10 bg-black/20 p-2">
                  <button
                    type="button"
                    onClick={() =>
                      addNotification({
                        type: 'info',
                        title: 'Voice mode not enabled',
                        message: 'Speech input is not wired in this build yet, but the copilot is ready for typed commands.',
                      })
                    }
                    className="rounded-xl p-3 text-gray-400 transition hover:text-white"
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder="Message ReliefOS AI..."
                    rows={1}
                    className="min-h-[52px] flex-1 resize-none bg-transparent px-2 py-3 text-sm text-white outline-none placeholder:text-gray-500"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={!input.trim() || isThinking}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500 text-[#04111e] transition disabled:cursor-not-allowed disabled:bg-cyan-900/40 disabled:text-cyan-200/40"
                  >
                    {isThinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </React.Fragment>
      )}

      {!embedded && (
        <React.Fragment>
          <div className="relative overflow-hidden border-b border-white/10 px-5 py-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.14),transparent_36%)]" />
            <div className="relative z-10 flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-500/10 px-2.5 py-1 text-[9px] uppercase tracking-[0.24em] text-cyan-100">
                  <Sparkles className="h-3.5 w-3.5" />
                  ReliefOS AI
                </div>
                <div className="mt-2 text-lg font-bold tracking-tight text-white">{panelTitle}</div>
                <div className="mt-1 text-xs text-gray-400">
                  {context.activeIncidents} active incidents, {context.supplySummary.activeShipments} live shipments, {context.lowStockResources.length} low-stock signals
                </div>
              </div>
              {!embedded && (
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="border-b border-white/10 px-4 py-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MODE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setMode(option.id)}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition',
                    mode === option.id
                      ? 'border-cyan-300/25 bg-cyan-500/15 text-cyan-50'
                      : 'border-white/10 bg-white/5 text-gray-300 hover:border-cyan-300/20'
                  )}
                >
                  <option.icon className="h-3.5 w-3.5" />
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {loadingContext ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing live operational context...
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <motion.div
                    key={`${message.role}-${index}-${message.text.slice(0, 24)}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn('flex gap-3', message.role === 'user' && 'justify-end')}
                  >
                    {message.role === 'assistant' && (
                      <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-500/10 text-cyan-100">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[86%] rounded-[1.5rem] border px-4 py-3 text-sm leading-relaxed',
                        message.role === 'assistant'
                          ? 'border-white/10 bg-white/5 text-gray-100'
                          : 'border-cyan-300/20 bg-cyan-500/15 text-cyan-50'
                      )}
                    >
                      {message.text}
                      {message.actions && message.actions.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.actions.map((action) => (
                            <button
                              key={action.id}
                              type="button"
                              onClick={() => void executeAction(action)}
                              className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-50 transition hover:bg-cyan-500/15"
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {message.role === 'user' && (
                      <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-gray-100">
                        <MessageSquareCode className="h-4 w-4" />
                      </div>
                    )}
                  </motion.div>
                ))}

                {isThinking && (
                  <div className="flex gap-3">
                    <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-500/10 text-cyan-100">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300">
                      ReliefOS AI is reviewing live incident, inventory, and convoy state before responding.
                    </div>
                  </div>
                )}
                <div ref={messageEndRef} />
              </div>
            )}
          </div>

          <div className="border-t border-white/10 px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-[9px] uppercase tracking-[0.22em] text-gray-500">Suggested prompts</div>
              <button
                type="button"
                onClick={() => void clearHistory()}
                className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-gray-300 transition hover:text-white"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
            </div>
            <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto pb-1">
              {promptList.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void handleSend(prompt)}
                  className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-[11px] leading-5 text-gray-200 transition hover:border-cyan-300/20 hover:text-white"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="flex items-end gap-2 rounded-[1.5rem] border border-white/10 bg-black/20 p-2">
              <button
                type="button"
                onClick={() =>
                  addNotification({
                    type: 'info',
                    title: 'Voice mode not enabled',
                    message: 'Speech input is not wired in this build yet, but the copilot is ready for typed commands.',
                  })
                }
                className="rounded-xl p-3 text-gray-400 transition hover:text-white"
              >
                <Mic className="h-4 w-4" />
              </button>
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Ask about incidents, supplies, shelters, routes, or analytics..."
                rows={1}
                className="min-h-[48px] flex-1 resize-none bg-transparent px-2 py-3 text-sm text-white outline-none placeholder:text-gray-500"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={!input.trim() || isThinking}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500 text-[#04111e] transition disabled:cursor-not-allowed disabled:bg-cyan-900/40 disabled:text-cyan-200/40"
              >
                {isThinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </React.Fragment>
      )}
    </motion.div>
  );

  return (
    <React.Fragment>
      {shouldRenderFloating && (
        <React.Fragment>
          <AnimatePresence>{isOpen && panel}</AnimatePresence>
          {!isOpen && (
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="fixed bottom-6 right-6 z-[115] flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/20 bg-[#07111f]/95 text-cyan-100 shadow-[0_20px_60px_rgba(0,0,0,0.55)] transition hover:scale-[1.03]"
            >
              <Plus className="absolute -right-1 -top-1 h-5 w-5 rounded-full border border-cyan-300/20 bg-cyan-500 p-1 text-[#04111e]" />
              <Sparkles className="h-6 w-6" />
            </button>
          )}
        </React.Fragment>
      )}
      {embedded && panel}
    </React.Fragment>
  );
}

export default OperationsCopilot;
