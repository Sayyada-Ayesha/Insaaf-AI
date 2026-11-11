// Vercel catch-all Function: /api/* -> the same Express app `npm start` runs.
// Nothing is re-declared here, so every existing endpoint, middleware order and
// error response stays identical between local and serverless execution.
import app from '../server/index.js';

// Vercel Hobby caps function duration at 60 s (configurable up to 60 only). The
// model timeout is clamped below this in server/modelInferenceClient.js so a
// stalled provider still returns the deterministic answer inside the window.
export const maxDuration = 60;

export default async function handler(req, res) {
  return app(req, res);
}
