import api from './http';

export interface SOSRequest {
  _id: string;
  submittedBy: { name: string; email: string; role: string };
  location: { coordinates: [number, number]; label: string };
  severity: 'low' | 'medium' | 'high' | 'critical';
  crisisType?: 'flood' | 'fire' | 'medical' | 'earthquake' | 'food' | 'fuel' | 'other';
  region?: string;
  message: string;
  status: 'pending' | 'acknowledged' | 'in_progress' | 'resolved';
  assignedTeam: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

export const submitSOS = async (params: {
  latitude: number;
  longitude: number;
  locationLabel?: string;
  severity?: string;
  crisisType?: string;
  region?: string;
  message?: string;
  mediaUrl?: string;
}): Promise<{ message: string; sos: SOSRequest }> => {
  const { data } = await api.post('/sos', params);
  return data;
};

export const getCurrentLocation = (): Promise<{ lat: number; lng: number }> =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err)
    );
  });

export const getAllSOS = async (params?: {
  status?: string;
  severity?: string;
  limit?: number;
}): Promise<SOSRequest[]> => {
  const { data } = await api.get('/sos', { params });
  return data;
};

export const updateSOSStatus = async (
  id: string,
  status: string,
  assignedTeam?: string
): Promise<{ message: string; sos: SOSRequest }> => {
  const { data } = await api.patch(`/sos/${id}/status`, { status, assignedTeam });
  return data;
};
