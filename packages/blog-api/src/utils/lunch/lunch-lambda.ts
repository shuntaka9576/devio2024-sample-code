import { handle } from 'hono/aws-lambda';
import app from '../../route';

export const handler = handle(app);
