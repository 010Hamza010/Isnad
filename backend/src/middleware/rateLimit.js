// Small in-memory rate limit for public (unauthenticated) routes: `max` requests per `windowMs` per IP.
module.exports = ({ windowMs = 60_000, max = 60 } = {}) => {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const recent = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (recent.length >= max) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ error: 'طلبات كثيرة، حاول بعد قليل' });
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 10_000) hits.clear(); // bound memory
    next();
  };
};
