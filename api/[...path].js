import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { app, ensureBackendReady } = require('../backend/app');

export default async function handler(req, res) {
  try {
    await ensureBackendReady();
    return app(req, res);
  } catch (error) {
    console.error('Vercel API bootstrap failed:', error);
    return res.status(503).json({
      message: 'API startup failed',
      detail:
        process.env.NODE_ENV === 'production'
          ? 'Verify Vercel environment variables MONGO_URI and JWT_SECRET.'
          : error.message,
    });
  }
}
