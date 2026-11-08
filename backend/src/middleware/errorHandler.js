module.exports = (err, req, res, _next) => {
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  const status = err.status || 500;
  res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
};
