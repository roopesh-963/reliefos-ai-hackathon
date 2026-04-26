import api from './http';

export interface CrisisAlert {
  _id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'critical';
  affectedCity: string;
  isActive: boolean;
  createdAt: string;
}

export const getAlerts = async (): Promise<CrisisAlert[]> => {
  const { data } = await api.get('/alerts');
  return data;
};

export const createAlert = async (params: {
  title: string;
  message: string;
  type: string;
  affectedCity?: string;
}): Promise<{ message: string; alert: CrisisAlert }> => {
  const { data } = await api.post('/alerts', params);
  return data;
};

export const deactivateAlert = async (id: string) => {
  const { data } = await api.patch(`/alerts/${id}/deactivate`);
  return data;
};
