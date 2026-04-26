require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { ensureDemoData } = require('./config/demo-data');

const authRoutes = require('./routes/auth.routes');
const sosRoutes = require('./routes/sos.routes');
const alertRoutes = require('./routes/alert.routes');
const resourceRoutes = require('./routes/resource.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const supplyRoutes = require('./routes/supply.routes');
const aiRoutes = require('./routes/ai.routes');
const assistantRoutes = require('./routes/assistant.routes');
const intelRoutes = require('./routes/intel.routes');

const noOpIo = {
  emit() {},
  to() {
    return this;
  },
};

const isAllowedOrigin = (origin, allowedOrigins) => {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  try {
    const { hostname } = new URL(origin);
    return hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
};

const allowedOrigins = Array.from(
  new Set(
    [
      process.env.CLIENT_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ].filter(Boolean)
  )
);

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin, allowedOrigins)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
};

let bootstrapPromise;

const ensureBackendReady = async () => {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await connectDB();
      await ensureDemoData();
    })().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  return bootstrapPromise;
};

const app = express();

app.use(cors(corsOptions));
app.use(express.json());

app.use(async (req, res, next) => {
  try {
    await ensureBackendReady();
    req.io = req.app.locals.io || noOpIo;
    next();
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/supply', supplyRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/intel', intelRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'ReliefOS API is running.' });
});

app.use((error, _req, res, _next) => {
  console.error('API runtime error:', error);
  res.status(500).json({ message: 'Server error' });
});

module.exports = { app, ensureBackendReady, allowedOrigins };
