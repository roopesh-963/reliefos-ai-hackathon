import api from './http';

export interface Resource {
  _id: string;
  type: 'Medicine' | 'Food' | 'Water' | 'Fuel' | 'Equipment' | 'Ambulance';
  category?: 'Medicine' | 'Food' | 'Water' | 'Fuel' | 'Equipment' | 'Ambulance';
  name: string;
  quantity: number;
  unit: string;
  status: 'Healthy' | 'Low' | 'Critical';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  location: string;
  isDeployed: boolean;
  deploymentTarget: string | null;
  lastUpdated?: string;
  lastChecked: string;
  allocations?: Array<{
    target: string;
    quantity: number;
    notes?: string;
    allocatedAt: string;
  }>;
}

export interface ResourceAnalytics {
  summary: {
    totalResources: number;
    lowStockItems: number;
    activeDeliveries: number;
    criticalZones: number;
  };
  categoryDistribution: Array<{
    name: string;
    value: number;
  }>;
  lowStock: Array<{
    id: string;
    name: string;
    quantity: number;
    unit: string;
    location: string;
    status: 'Healthy' | 'Low' | 'Critical';
    priority: 'Low' | 'Medium' | 'High' | 'Critical';
  }>;
  consumptionTrend: Array<{
    name: string;
    allocated: number;
  }>;
  aiSuggestions: string[];
}

export const getResources = async (params?: {
  type?: string;
  category?: string;
  status?: string;
  priority?: string;
  search?: string;
  sortLowStock?: boolean;
}): Promise<Resource[]> => {
  const { data } = await api.get('/resources', { params });
  return data;
};

export const addResource = async (resource: Partial<Resource>): Promise<{ message: string; resource: Resource }> => {
  const { data } = await api.post('/resources', resource);
  return data;
};

export const updateResource = async (
  id: string,
  updates: Partial<Resource>
): Promise<{ message: string; resource: Resource }> => {
  const { data } = await api.put(`/resources/${id}`, updates);
  return data;
};

export const deleteResource = async (id: string): Promise<{ message: string }> => {
  const { data } = await api.delete(`/resources/${id}`);
  return data;
};

export const deployResource = async (id: string, deploymentTarget: string) => {
  const { data } = await api.patch(`/resources/${id}/deploy`, { deploymentTarget });
  return data;
};

export const allocateResource = async (params: {
  resourceId: string;
  target: string;
  quantity: number;
  notes?: string;
}): Promise<{
  message: string;
  allocation: {
    resourceId: string;
    name: string;
    target: string;
    quantity: number;
    remaining: number;
    status: 'Healthy' | 'Low' | 'Critical';
  };
  resource: Resource;
}> => {
  const { data } = await api.post('/resources/allocate', params);
  return data;
};

export const getResourceAnalytics = async (): Promise<ResourceAnalytics> => {
  const { data } = await api.get('/resources/analytics');
  return data;
};
