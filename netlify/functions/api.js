import serverless from 'serverless-http';
import { server } from '../../server.js';

const app = serverless(server);

export const handler = async (event, context) => app(event, context);
