import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Box,
  Edit3,
  Loader2,
  PackageCheck,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '../lib/utils';
import { ExplainableOperationsStack } from '../components/ai/ExplainableOperationsStack';
import {
  addResource,
  allocateResource,
  getAssistantContext,
  deleteResource,
  getCurrentUser,
  getResourceAnalytics,
  getResources,
  Resource,
  ResourceAnalytics,
  updateResource,
} from '../services/api';
import { BackToDashboardButton } from '../components/navigation/BackToDashboardButton';
import { useNotifications } from '../hooks/useNotifications';
import { useSocket } from '../hooks/useSocket';

type Category = 'Medicine' | 'Food' | 'Water' | 'Fuel' | 'Equipment' | 'Ambulance';
type Status = 'Healthy' | 'Low' | 'Critical';
type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

interface ResourceFormState {
  name: string;
  category: Category;
  quantity: number;
  unit: string;
  location: string;
  status: Status;
  priority: Priority;
}

interface AllocationFormState {
  resourceId: string;
  target: string;
  quantity: number;
  notes: string;
}

const CATEGORY_OPTIONS: Category[] = ['Medicine', 'Food', 'Water', 'Fuel', 'Equipment', 'Ambulance'];
const STATUS_OPTIONS: Status[] = ['Healthy', 'Low', 'Critical'];
const PRIORITY_OPTIONS: Priority[] = ['Low', 'Medium', 'High', 'Critical'];
const PIE_COLORS = ['#3b82f6', '#22d3ee', '#f97316', '#facc15', '#ef4444', '#8b5cf6'];

const createInitialResourceForm = (): ResourceFormState => ({
  name: '',
  category: 'Medicine',
  quantity: 100,
  unit: 'units',
  location: 'Warehouse 01',
  status: 'Healthy',
  priority: 'Medium',
});

const formatDate = (value?: string) => {
  if (!value) {
    return '--';
  }
  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const statusTone = (status: Status) => {
  if (status === 'Critical') {
    return 'text-red-300 border-red-400/25 bg-red-500/10';
  }
  if (status === 'Low') {
    return 'text-amber-200 border-amber-400/25 bg-amber-500/10';
  }
  return 'text-emerald-200 border-emerald-400/25 bg-emerald-500/10';
};

const priorityTone = (priority: Priority) => {
  if (priority === 'Critical') {
    return 'text-red-300 bg-red-500/10';
  }
  if (priority === 'High') {
    return 'text-orange-200 bg-orange-500/10';
  }
  if (priority === 'Medium') {
    return 'text-cyan-100 bg-cyan-500/10';
  }
  return 'text-gray-200 bg-white/10';
};

const toStatusRank = (status: Status) => {
  if (status === 'Critical') {
    return 0;
  }
  if (status === 'Low') {
    return 1;
  }
  return 2;
};

const deriveFallbackAnalytics = (resources: Resource[]): ResourceAnalytics => {
  const lowStock = resources.filter((item) => item.status === 'Low' || item.status === 'Critical');
  const criticalTargets = new Set(
    resources
      .filter((resource) => resource.status === 'Critical' && resource.deploymentTarget)
      .map((resource) => resource.deploymentTarget as string)
  );

  const categoryDistribution = CATEGORY_OPTIONS.map((category) => ({
    name: category,
    value: resources.filter((resource) => resource.type === category).length,
  })).filter((item) => item.value > 0);

  return {
    summary: {
      totalResources: resources.length,
      lowStockItems: lowStock.length,
      activeDeliveries: resources.filter((resource) => resource.isDeployed).length,
      criticalZones: criticalTargets.size,
    },
    categoryDistribution,
    lowStock: lowStock.slice(0, 8).map((resource) => ({
      id: resource._id,
      name: resource.name,
      quantity: resource.quantity,
      unit: resource.unit,
      location: resource.location,
      status: resource.status,
      priority: resource.priority,
    })),
    consumptionTrend: [],
    aiSuggestions: [],
  };
};

export default function Resources() {
  const user = getCurrentUser();
  const canManage = !user || user.role === 'admin' || user.role === 'rescue_team';
  const canDelete = !user || user.role === 'admin' || user.role === 'rescue_team';
  const assistantSessionId = `resources-${user?.id || user?.email || 'operator'}`;

  const [resources, setResources] = useState<Resource[]>([]);
  const [analytics, setAnalytics] = useState<ResourceAnalytics | null>(null);
  const [assistantContext, setAssistantContext] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | Category>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | Status>('All');
  const [sortLowStock, setSortLowStock] = useState(false);

  const [showResourceModal, setShowResourceModal] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [resourceForm, setResourceForm] = useState<ResourceFormState>(createInitialResourceForm);

  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocationForm, setAllocationForm] = useState<AllocationFormState>({
    resourceId: '',
    target: '',
    quantity: 1,
    notes: '',
  });
  const [selectedAllocationResource, setSelectedAllocationResource] = useState<Resource | null>(null);

  const { addNotification } = useNotifications();
  const { joinDashboard, on } = useSocket();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resourceResult, analyticsResult, assistantResult] = await Promise.allSettled([
        getResources(),
        getResourceAnalytics(),
        getAssistantContext({
          sessionId: assistantSessionId,
          role: user?.role || 'admin',
          page: 'resources',
          mode: 'logistics',
        }),
      ]);

      if (resourceResult.status !== 'fulfilled') {
        throw resourceResult.reason;
      }

      const resourceData = resourceResult.value;
      setResources(resourceData);

      if (analyticsResult.status === 'fulfilled') {
        setAnalytics(analyticsResult.value);
      } else {
        console.error('Resource analytics fetch failed, using local fallback:', analyticsResult.reason);
        setAnalytics(deriveFallbackAnalytics(resourceData));
      }

      if (assistantResult.status === 'fulfilled') {
        setAssistantContext(assistantResult.value.context);
      }
    } catch (error) {
      console.error('Failed to load resources:', error);
      addNotification({
        type: 'critical',
        title: 'Resource Feed Error',
        message: 'Unable to load resource inventory right now. Please retry in a moment.',
      });
    } finally {
      setLoading(false);
    }
  }, [addNotification, assistantSessionId, user?.role]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    joinDashboard();

    const events = [
      'resource_added',
      'resource_updated',
      'resource_deleted',
      'resource_deployed',
      'resource_allocated',
    ];

    const unsubscribers = events.map((eventName) =>
      on(eventName, () => {
        void loadData();
      })
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [joinDashboard, on, loadData]);

  const filteredResources = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = resources.filter((resource) => {
      const matchesSearch =
        term.length === 0 ||
        resource.name.toLowerCase().includes(term) ||
        resource.location.toLowerCase().includes(term);
      const matchesCategory = categoryFilter === 'All' || resource.type === categoryFilter;
      const matchesStatus = statusFilter === 'All' || resource.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });

    filtered.sort((a, b) => {
      if (sortLowStock) {
        const statusDiff = toStatusRank(a.status) - toStatusRank(b.status);
        if (statusDiff !== 0) {
          return statusDiff;
        }
        return a.quantity - b.quantity;
      }
      return (
        new Date(b.lastUpdated || b.lastChecked || 0).getTime() -
        new Date(a.lastUpdated || a.lastChecked || 0).getTime()
      );
    });

    return filtered;
  }, [resources, search, categoryFilter, statusFilter, sortLowStock]);

  const effectiveAnalytics = analytics || deriveFallbackAnalytics(resources);
  const stats = effectiveAnalytics.summary;
  const statCards = [
    {
      label: 'Total Resources',
      value: stats.totalResources,
      icon: Box,
      tone: 'text-cyan-100',
      glow: 'from-cyan-400/14 to-blue-500/8',
    },
    {
      label: 'Low Stock Items',
      value: stats.lowStockItems,
      icon: AlertCircle,
      tone: 'text-amber-100',
      glow: 'from-amber-400/14 to-orange-500/8',
    },
    {
      label: 'Active Deliveries',
      value: stats.activeDeliveries,
      icon: Truck,
      tone: 'text-blue-100',
      glow: 'from-blue-400/14 to-cyan-500/8',
    },
    {
      label: 'Critical Zones',
      value: stats.criticalZones,
      icon: ShieldAlert,
      tone: 'text-rose-100',
      glow: 'from-rose-400/14 to-red-500/8',
    },
  ] as const;
  const categoryChartData = effectiveAnalytics.categoryDistribution.length > 0
    ? effectiveAnalytics.categoryDistribution
    : CATEGORY_OPTIONS.slice(0, 4).map((category) => ({ name: category, value: 0 }));
  const lowStockChartData = effectiveAnalytics.lowStock.length > 0
    ? effectiveAnalytics.lowStock.slice(0, 6).map((item) => ({
        name: item.name.length > 12 ? `${item.name.slice(0, 12)}...` : item.name,
        quantity: item.quantity,
      }))
    : [{ name: 'No shortages', quantity: 0 }];
  const consumptionTrendData = effectiveAnalytics.consumptionTrend.length > 0
    ? effectiveAnalytics.consumptionTrend
    : [
        { name: 'Mon', allocated: 0 },
        { name: 'Tue', allocated: 0 },
        { name: 'Wed', allocated: 0 },
        { name: 'Thu', allocated: 0 },
        { name: 'Fri', allocated: 0 },
      ];
  const aiSuggestions = effectiveAnalytics.aiSuggestions.length > 0
    ? effectiveAnalytics.aiSuggestions
    : [
        'Shift reserve water pallets toward the highest-demand eastern corridor before night operations begin.',
        'Medicine replenishment is projected to tighten within four hours if current dispatch rates continue.',
        'Re-route one transport unit from Depot 2 to reduce pressure on the primary response corridor.',
      ];

  const openAddModal = () => {
    setEditingResource(null);
    setResourceForm(createInitialResourceForm());
    setShowResourceModal(true);
  };

  const openEditModal = (resource: Resource) => {
    setEditingResource(resource);
    setResourceForm({
      name: resource.name,
      category: resource.type,
      quantity: resource.quantity,
      unit: resource.unit,
      location: resource.location,
      status: resource.status,
      priority: resource.priority,
    });
    setShowResourceModal(true);
  };

  const closeResourceModal = () => {
    setShowResourceModal(false);
    setEditingResource(null);
  };

  const submitResource = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) {
      addNotification({
        type: 'warning',
        title: 'Access Restricted',
        message: 'Only Admin or Rescue Team roles can modify resources.',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: resourceForm.name.trim(),
        type: resourceForm.category,
        category: resourceForm.category,
        quantity: Number(resourceForm.quantity),
        unit: resourceForm.unit.trim(),
        location: resourceForm.location.trim(),
        status: resourceForm.status,
        priority: resourceForm.priority,
      };

      if (editingResource) {
        await updateResource(editingResource._id, payload);
        addNotification({
          type: 'success',
          title: 'Resource Updated',
          message: `${payload.name} has been updated successfully.`,
        });
      } else {
        await addResource(payload);
        addNotification({
          type: 'success',
          title: 'Resource Added',
          message: `${payload.name} is now tracked in inventory.`,
        });
      }

      closeResourceModal();
      await loadData();
    } catch (error) {
      console.error('Save resource failed:', error);
      addNotification({
        type: 'critical',
        title: 'Save Failed',
        message: 'Could not save resource. Check permissions and required fields.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (resource: Resource) => {
    if (!canDelete) {
      addNotification({
        type: 'warning',
        title: 'Admin Only',
        message: 'Only Admin role can delete resources.',
      });
      return;
    }

    const confirmed = window.confirm(`Delete resource "${resource.name}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteResource(resource._id);
      addNotification({
        type: 'success',
        title: 'Resource Deleted',
        message: `${resource.name} has been removed from inventory.`,
      });
      await loadData();
    } catch (error) {
      console.error('Delete failed:', error);
      addNotification({
        type: 'critical',
        title: 'Delete Failed',
        message: 'Unable to delete resource right now.',
      });
    }
  };

  const openAllocateModal = (resource: Resource) => {
    setSelectedAllocationResource(resource);
    setAllocationForm({
      resourceId: resource._id,
      target: resource.deploymentTarget || '',
      quantity: 1,
      notes: '',
    });
    setShowAllocateModal(true);
  };

  const closeAllocateModal = () => {
    setShowAllocateModal(false);
    setSelectedAllocationResource(null);
    setAllocationForm({
      resourceId: '',
      target: '',
      quantity: 1,
      notes: '',
    });
  };

  const submitAllocation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) {
      addNotification({
        type: 'warning',
        title: 'Access Restricted',
        message: 'Only Admin or Rescue Team roles can allocate resources.',
      });
      return;
    }

    setSaving(true);
    try {
      await allocateResource({
        resourceId: allocationForm.resourceId,
        target: allocationForm.target.trim(),
        quantity: Number(allocationForm.quantity),
        notes: allocationForm.notes.trim(),
      });

      addNotification({
        type: 'success',
        title: 'Allocation Created',
        message: `Resource assigned to ${allocationForm.target}.`,
      });

      closeAllocateModal();
      await loadData();
    } catch (error) {
      console.error('Allocation failed:', error);
      addNotification({
        type: 'critical',
        title: 'Allocation Failed',
        message: 'Could not allocate resource. Verify available quantity.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relief-page pb-8 text-white">
      <div className="relief-orb left-[8%] top-[8%] h-80 w-80 bg-[rgba(255,98,62,0.14)]" />
      <div className="relief-orb right-[8%] top-[14%] h-72 w-72 bg-[rgba(139,0,0,0.18)]" />
      <div className="dashboard-particles absolute inset-0 opacity-22" />

      <div className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6">
        <div>
          <BackToDashboardButton />
        </div>
        <section className="relative px-1 py-4 sm:px-2 sm:py-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_12%,rgba(91,155,255,0.16),transparent_22%),radial-gradient(circle_at_88%_18%,rgba(67,224,255,0.12),transparent_18%)]" />
          <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="relief-chip inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.34em]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Supply Intelligence Mesh
                </div>
                <h1 className="relief-title mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl xl:text-6xl">
                  Resource Command Center
                </h1>
                <p className="relief-muted mt-4 max-w-2xl text-sm leading-7 sm:text-base">
                  Real-time inventory, allocation, and supply intelligence for relief teams coordinating critical stock, deliveries, and zone pressure.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={openAddModal}
                    disabled={!canManage}
                    className={cn(
                      'inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-medium transition',
                      canManage
                        ? 'relief-button-primary text-cyan-50'
                        : 'border-white/10 bg-white/[0.03] text-white/40 cursor-not-allowed'
                    )}
                  >
                    <Plus className="h-4 w-4" />
                    Add Resource
                  </button>
                  <div className="relief-chip inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.26em] text-white/58">
                    {loading ? 'Syncing inventory feed' : `${filteredResources.length} visible records`}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:min-w-[620px]">
                {statCards.map((card) => (
                  <div
                    key={card.label}
                    className={cn(
                      'bg-gradient-to-br px-4 py-4',
                      card.glow
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.24em] text-white/46">{card.label}</div>
                        <div className="mt-3 font-display text-3xl font-semibold tracking-tight text-white">{card.value}</div>
                      </div>
                      <card.icon className={cn('h-5 w-5', card.tone)} />
                    </div>
                  </div>
                ))}
              </div>
          </div>
        </section>

        <section className="p-1">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relief-card flex flex-1 items-center gap-3 rounded-2xl px-4 py-3">
              <Search className="w-4 h-4 text-gray-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by resource name or location..."
                className="w-full bg-transparent outline-none text-sm text-white placeholder:text-gray-500"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as 'All' | Category)}
              className="relief-input rounded-2xl px-4 py-3 text-sm text-white"
            >
              <option value="All">All Categories</option>
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'All' | Status)}
              className="relief-input rounded-2xl px-4 py-3 text-sm text-white"
            >
              <option value="All">All Status</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <label className="relief-card inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-mono uppercase tracking-[0.24em] text-gray-300">
              <input
                type="checkbox"
                checked={sortLowStock}
                onChange={(event) => setSortLowStock(event.target.checked)}
                className="accent-cyan-400"
              />
              Sort low stock first
            </label>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_390px]">
          <div className="flex flex-col gap-5 overflow-hidden">
            <div className="flex items-center justify-between px-2 py-4 sm:px-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.28em] text-white/42">Inventory Grid</div>
                <div className="mt-1 text-base font-semibold text-white">Tracked resource ledger</div>
              </div>
              <div className="text-xs text-white/44">
                {loading ? 'Syncing' : `${filteredResources.length} entries`}
              </div>
            </div>

            <div className="max-h-[760px] overflow-auto rounded-[1.75rem] bg-[#06101d]/22 backdrop-blur-md">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="sticky top-0 z-10 bg-black/55 backdrop-blur-md">
                  <tr className="text-left text-[10px] uppercase tracking-widest font-mono text-gray-400">
                    <th className="px-4 py-3">Resource Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Last Updated</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                        <div className="inline-flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Syncing inventory feed...
                        </div>
                      </td>
                    </tr>
                  ) : filteredResources.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                        No resources match current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredResources.map((resource) => (
                      <tr key={resource._id} className="border-t border-white/5 hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-semibold text-white">{resource.name}</td>
                        <td className="px-4 py-3 text-gray-300">{resource.type}</td>
                        <td className="px-4 py-3 text-white font-semibold">{resource.quantity}</td>
                        <td className="px-4 py-3 text-gray-300">{resource.unit}</td>
                        <td className="px-4 py-3 text-gray-300">{resource.location}</td>
                        <td className="px-4 py-3">
                          <span className={cn('px-2 py-1 rounded-full text-[10px] border font-semibold', statusTone(resource.status))}>
                            {resource.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('px-2 py-1 rounded-full text-[10px] font-semibold', priorityTone(resource.priority))}>
                            {resource.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {formatDate(resource.lastUpdated || resource.lastChecked)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(resource)}
                              disabled={!canManage}
                              className={cn(
                                'p-2 rounded-lg border',
                                canManage
                                  ? 'border-white/10 text-gray-200 hover:border-blue-400/40 hover:text-white'
                                  : 'border-white/5 text-gray-500 cursor-not-allowed'
                              )}
                              title="Edit"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(resource)}
                              disabled={!canDelete}
                              className={cn(
                                'p-2 rounded-lg border',
                                canDelete
                                  ? 'border-white/10 text-gray-200 hover:border-red-400/40 hover:text-red-200'
                                  : 'border-white/5 text-gray-500 cursor-not-allowed'
                              )}
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openAllocateModal(resource)}
                              disabled={!canManage || resource.quantity <= 0}
                              className={cn(
                                'p-2 rounded-lg border',
                                canManage && resource.quantity > 0
                                  ? 'border-cyan-400/20 text-cyan-100 hover:border-cyan-300/50'
                                  : 'border-white/5 text-gray-500 cursor-not-allowed'
                              )}
                              title="Allocate"
                            >
                              <PackageCheck className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="relief-card h-72 rounded-[1.5rem] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-tight text-white">Category Split</h3>
                  <BarChart3 className="h-4 w-4 text-cyan-200" />
                </div>
                <ResponsiveContainer width="100%" height="88%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={72}
                      paddingAngle={4}
                    >
                      {categoryChartData.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#101723',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '10px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="relief-card h-72 rounded-[1.5rem] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-tight text-white">Low Stock Watch</h3>
                  <AlertCircle className="h-4 w-4 text-amber-200" />
                </div>
                <ResponsiveContainer width="100%" height="88%">
                  <BarChart data={lowStockChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a3241" vertical={false} />
                    <XAxis dataKey="name" stroke="#6b7280" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis stroke="#6b7280" fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#101723',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '10px',
                      }}
                    />
                    <Bar dataKey="quantity" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="relief-card h-72 rounded-[1.5rem] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-tight text-white">Consumption Trend</h3>
                  <Truck className="h-4 w-4 text-blue-200" />
                </div>
                <ResponsiveContainer width="100%" height="88%">
                  <LineChart data={consumptionTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a3241" vertical={false} />
                    <XAxis dataKey="name" stroke="#6b7280" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis stroke="#6b7280" fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#101723',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '10px',
                      }}
                    />
                    <Line type="monotone" dataKey="allocated" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className="p-1">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-cyan-200" />
                <h3 className="text-sm font-bold text-white uppercase tracking-tight">AI Resource Brief</h3>
              </div>
              {assistantContext ? (
                <div className="space-y-4">
                  <div className="border-l border-cyan-300/35 bg-cyan-500/[0.04] px-3 py-2 text-[12px] leading-relaxed text-cyan-100">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-300/80">
                      Executive Summary
                    </span>
                    <p className="mt-1">{assistantContext.aiBriefing.shortageHeadline}</p>
                  </div>
                  <ExplainableOperationsStack
                    compact
                    priorities={assistantContext.prioritizedIncidents}
                    shortages={assistantContext.shortagePredictions}
                    dispatches={assistantContext.dispatchRecommendations}
                    className="xl:grid-cols-1"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {aiSuggestions.map((suggestion, index) => (
                    <div
                      key={`${suggestion}-${index}`}
                      className="border-l border-cyan-300/35 bg-cyan-500/[0.04] px-3 py-2 text-[12px] leading-relaxed text-cyan-100"
                    >
                      <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-300/80">
                        Recommendation {index + 1}
                      </span>
                      <p className="mt-1">{suggestion}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </section>
      </div>

      {showResourceModal && (
        <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relief-panel w-full max-w-xl rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                {editingResource ? 'Edit Resource' : 'Add Resource'}
              </h3>
              <button type="button" onClick={closeResourceModal} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitResource} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs text-gray-400">Name</span>
                  <input
                    required
                    value={resourceForm.name}
                    onChange={(event) => setResourceForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="relief-input w-full rounded-xl px-3 py-2 text-sm outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-gray-400">Category</span>
                  <select
                    value={resourceForm.category}
                    onChange={(event) =>
                      setResourceForm((prev) => ({ ...prev, category: event.target.value as Category }))
                    }
                    className="relief-input w-full rounded-xl px-3 py-2 text-sm outline-none"
                  >
                    {CATEGORY_OPTIONS.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-gray-400">Quantity</span>
                  <input
                    type="number"
                    min={0}
                    required
                    value={resourceForm.quantity}
                    onChange={(event) =>
                      setResourceForm((prev) => ({ ...prev, quantity: Number(event.target.value) }))
                    }
                    className="relief-input w-full rounded-xl px-3 py-2 text-sm outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-gray-400">Unit</span>
                  <input
                    required
                    value={resourceForm.unit}
                    onChange={(event) => setResourceForm((prev) => ({ ...prev, unit: event.target.value }))}
                    className="relief-input w-full rounded-xl px-3 py-2 text-sm outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-gray-400">Location</span>
                  <input
                    required
                    value={resourceForm.location}
                    onChange={(event) => setResourceForm((prev) => ({ ...prev, location: event.target.value }))}
                    className="relief-input w-full rounded-xl px-3 py-2 text-sm outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-gray-400">Status</span>
                  <select
                    value={resourceForm.status}
                    onChange={(event) =>
                      setResourceForm((prev) => ({ ...prev, status: event.target.value as Status }))
                    }
                    className="relief-input w-full rounded-xl px-3 py-2 text-sm outline-none"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-xs text-gray-400">Priority</span>
                  <select
                    value={resourceForm.priority}
                    onChange={(event) =>
                      setResourceForm((prev) => ({ ...prev, priority: event.target.value as Priority }))
                    }
                    className="relief-input w-full rounded-xl px-3 py-2 text-sm outline-none"
                  >
                    {PRIORITY_OPTIONS.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeResourceModal}
                  className="px-4 py-2 rounded-xl border border-white/15 text-gray-200 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="relief-button-primary px-4 py-2 rounded-xl text-white font-semibold disabled:opacity-70 inline-flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingResource ? 'Save Changes' : 'Create Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAllocateModal && selectedAllocationResource && (
        <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relief-panel w-full max-w-lg rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Allocate Resource</h3>
              <button type="button" onClick={closeAllocateModal} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 rounded-xl border border-cyan-400/15 bg-cyan-500/5 p-3 text-sm text-cyan-100">
              <div className="font-semibold">{selectedAllocationResource.name}</div>
              <div className="text-xs text-cyan-200/80 mt-1">
                Available: {selectedAllocationResource.quantity} {selectedAllocationResource.unit}
              </div>
            </div>

            <form onSubmit={submitAllocation} className="space-y-3">
              <label className="space-y-1 block">
                <span className="text-xs text-gray-400">Target Crisis Zone / Shelter</span>
                <input
                  required
                  value={allocationForm.target}
                  onChange={(event) => setAllocationForm((prev) => ({ ...prev, target: event.target.value }))}
                  className="relief-input w-full rounded-xl px-3 py-2 text-sm outline-none"
                  placeholder="East Shelter"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-xs text-gray-400">Allocate Quantity</span>
                <input
                  type="number"
                  min={1}
                  max={selectedAllocationResource.quantity}
                  required
                  value={allocationForm.quantity}
                  onChange={(event) =>
                    setAllocationForm((prev) => ({ ...prev, quantity: Number(event.target.value) }))
                  }
                  className="relief-input w-full rounded-xl px-3 py-2 text-sm outline-none"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-xs text-gray-400">Notes (optional)</span>
                <textarea
                  rows={3}
                  value={allocationForm.notes}
                  onChange={(event) => setAllocationForm((prev) => ({ ...prev, notes: event.target.value }))}
                  className="relief-input w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                  placeholder="Immediate dispatch required..."
                />
              </label>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeAllocateModal}
                  className="px-4 py-2 rounded-xl border border-white/15 text-gray-200 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="relief-button-primary px-4 py-2 rounded-xl text-white font-semibold disabled:opacity-70 inline-flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
