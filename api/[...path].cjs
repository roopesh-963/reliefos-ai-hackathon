const { app, ensureBackendReady } = require('../backend/app');

module.exports = async (req, res) => {
  await ensureBackendReady();
  return app(req, res);
};
