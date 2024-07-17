import { serve } from '@hono/node-server';
import app from '../../route';

serve({
  fetch: app.fetch,
  port: 3001,
});
