import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { app, ensureBackendReady } = require('../backend/app');

export default async function handler(req, res) {
  await ensureBackendReady();
  return app(req, res);
}
