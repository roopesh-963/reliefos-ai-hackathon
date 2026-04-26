import api from './http';

export type ShipmentResourceType =
  | 'Medicine'
  | 'Food'
  | 'Water'
  | 'Fuel'
  | 'Equipment'
  | 'Blankets'
  | 'Ambulance';

export type ShipmentStatus = 'Queued' | 'In Transit' | 'Delivered' | 'Delayed' | 'Rerouted';
export type ShipmentPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type ShipmentRouteState = 'Clear' | 'Watch' | 'Blocked';
export type ShipmentDestinationType = 'Warehouse' | 'Shelter' | 'Camp' | 'Clinic' | 'Zone';

export interface Shipment {
  _id: string;
  shipmentId: string;
  resourceType: ShipmentResourceType;
  quantity: number;
  unit: string;
  from: string;
  to: string;
  vehicle: string;
  driver: string;
  status: ShipmentStatus;
  etaMinutes: number;
  etaLabel: string;
  priority: ShipmentPriority;
  routeState: ShipmentRouteState;
  blockedReason: string;
  destinationType: ShipmentDestinationType;
  progress: number;
  fromCoords: { lat: number; lng: number };
  toCoords: { lat: number; lng: number };
  currentCoords: { lat: number; lng: number };
  routePath: [number, number][];
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string | null;
  notes?: string;
}

export interface WarehouseStockLevels {
  Water: number;
  Food: number;
  Medicine: number;
  Fuel: number;
  Blankets: number;
}

export interface WarehouseSummary {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  stockLevels: WarehouseStockLevels;
  capacity: number;
  usedCapacity: number;
  fillPercent: number;
  lowStockWarnings: string[];
  lastUpdated: string;
}

export interface SupplyAnalytics {
  summary: {
    activeShipments: number;
    deliveredToday: number;
    delayedDeliveries: number;
    avgEtaMinutes: number;
    avgEtaLabel: string;
    criticalRoutes: number;
    warehouseCapacity: number;
  };
  byStatus: Array<{ name: ShipmentStatus; value: number }>;
  byPriority: Array<{ name: ShipmentPriority; value: number }>;
  insights: Array<{
    id: string;
    title: string;
    message: string;
    tone: 'info' | 'warning' | 'critical';
  }>;
}

export interface ShipmentPayload {
  resourceType: ShipmentResourceType;
  quantity: number;
  unit?: string;
  from: string;
  to: string;
  vehicle: string;
  driver: string;
  etaMinutes: number;
  priority: ShipmentPriority;
  destinationType: ShipmentDestinationType;
  notes?: string;
}

export const getShipments = async (params?: {
  status?: string;
  priority?: string;
  search?: string;
}): Promise<Shipment[]> => {
  const { data } = await api.get('/supply/shipments', { params });
  return data;
};

export const createShipment = async (
  shipment: ShipmentPayload
): Promise<{ message: string; shipment: Shipment }> => {
  const { data } = await api.post('/supply/shipments', shipment);
  return data;
};

export const updateShipment = async (
  id: string,
  updates: Partial<Pick<Shipment, 'status' | 'etaMinutes' | 'priority' | 'blockedReason' | 'notes'>>
): Promise<{ message: string; shipment: Shipment }> => {
  const { data } = await api.put(`/supply/shipments/${id}`, updates);
  return data;
};

export const deleteShipment = async (id: string): Promise<{ message: string }> => {
  const { data } = await api.delete(`/supply/shipments/${id}`);
  return data;
};

export const rerouteShipment = async (
  shipmentId: string,
  reason: string,
  etaAdjustmentMinutes = 18
): Promise<{ message: string; shipment: Shipment }> => {
  const { data } = await api.post('/supply/reroute', { shipmentId, reason, etaAdjustmentMinutes });
  return data;
};

export const getWarehouses = async (): Promise<WarehouseSummary[]> => {
  const { data } = await api.get('/supply/warehouses');
  return data;
};

export const getSupplyAnalytics = async (): Promise<SupplyAnalytics> => {
  const { data } = await api.get('/supply/analytics');
  return data;
};
