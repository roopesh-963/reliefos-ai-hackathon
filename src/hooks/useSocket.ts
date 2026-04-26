/**
 * src/hooks/useSocket.ts
 * ----------------------
 * Custom React hook for Socket.io real-time updates.
 *
 * HOW TO USE in Dashboard.tsx:
 *
 *   import { useSocket } from '../hooks/useSocket';
 *
 *   export default function Dashboard() {
 *     const { on, joinDashboard } = useSocket();
 *
 *     useEffect(() => {
 *       joinDashboard(); // Join the dashboard room for live SOS updates
 *
 *       on('new_sos', (sos) => {
 *         console.log('🚨 New SOS received:', sos);
 *         // Add to your state, show notification, etc.
 *       });
 *
 *       on('new_alert', (alert) => {
 *         addNotification({ type: alert.type, title: alert.title, message: alert.message });
 *       });
 *     }, []);
 *   }
 *
 * EVENTS YOU CAN LISTEN TO:
 *   'new_sos'           → New SOS submitted by a citizen
 *   'sos_updated'       → SOS status changed (acknowledged/resolved)
 *   'new_alert'         → Admin created a crisis alert
 *   'resource_added'    → New resource added to inventory
 *   'resource_deployed' → Resource deployed to a target
 *   'new_deployment'    → New supply convoy created
 *   'deployment_updated'→ Convoy status/progress updated
 */

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
  : import.meta.env.DEV
    ? 'http://localhost:5000'
    : window.location.origin;

// Singleton socket instance — one connection for the entire app
let socketInstance: Socket | null = null;

const getSocket = (): Socket => {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
    });
  }
  return socketInstance;
};

export const useSocket = () => {
  const socket = useRef<Socket>(getSocket());

  const joinDashboard = useCallback(() => {
    socket.current.emit('join_dashboard');
  }, []);

  // Generic event listener — auto-cleans up on component unmount
  const on = useCallback(<T = unknown>(event: string, callback: (data: T) => void) => {
    socket.current.on(event, callback);
    // Return cleanup function
    return () => {
      socket.current.off(event, callback);
    };
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    socket.current.emit(event, data);
  }, []);

  useEffect(() => {
    // Reconnect if disconnected
    if (!socket.current.connected) {
      socket.current.connect();
    }
    // Note: Don't disconnect on unmount — we want the global connection to persist
  }, []);

  return {
    socket: socket.current,
    joinDashboard,
    on,
    emit,
    isConnected: socket.current.connected,
  };
};
