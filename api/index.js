// Vercel rewrite target for nested API paths. On the live deployment the
// root catch-all (`api/[...all].js`) only matched one path segment, so every
// nested endpoint (/api/ai/chat, /api/community/posts, /api/civic/reports …)
// returned the platform 404 while single-segment routes worked. Rewrites match
// by path pattern rather than by file name, so this entry receives the request
// plus the captured path and calls the same Express app `npm start` runs.
import app from '../server/index.js';

export const maxDuration = 60;

export default function handler(req, res) {
  const raw = String(req.url || '');
  const qIndex = raw.indexOf('?');
  const params = new URLSearchParams(qIndex >= 0 ? raw.slice(qIndex) : '');
  const captured = typeof req.query?.__vpath === 'string' ? req.query.__vpath : params.get('__vpath');
  if (captured && /^[A-Za-z0-9]/.test(captured)) {
    params.delete('__vpath');
    const rest = params.toString();
    req.url = `/api/${captured.replace(/^\/+/, '')}${rest ? `?${rest}` : ''}`;
  }
  return app(req, res);
}
