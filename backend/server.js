/**
 * ReliefOS AI - Main Server Entry Point
 */

const { loadEnv } = require('./config/env');
loadEnv();
const http = require('http');
const { Server } = require('socket.io');
const { app, ensureBackendReady, corsOptions } = require('./app');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOptions.origin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.locals.io = io;

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  socket.on('join_dashboard', () => {
    socket.join('dashboard');
    console.log(`[Socket.io] ${socket.id} joined dashboard room`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;

const bootstrap = async () => {
  try {
    await ensureBackendReady();

    server.listen(PORT, () => {
      console.log(`\nReliefOS API running at http://localhost:${PORT}`);
      console.log('Socket.io live updates enabled');
      if (String(process.env.DEMO_MODE || '').toLowerCase() === 'true') {
        console.log('DEMO_MODE is active with deterministic seed data.');
      }
      console.log('');
    });
  } catch (error) {
    console.error('Server bootstrap failed:', error);
    process.exit(1);
  }
};

void bootstrap();
