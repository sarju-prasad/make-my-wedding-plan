import type { Request, Response } from 'express';

import { sendSuccess } from '../../core/http/response.js';

import { getLiveness, getReadiness } from './health.service.js';

export function getHealthz(_req: Request, res: Response): void {
  sendSuccess(res, getLiveness());
}

export async function getReadyz(_req: Request, res: Response): Promise<void> {
  const result = await getReadiness();
  // Not ready is a legitimate, expected state during a cold start or a
  // transient DB blip — 503 tells infra/load balancers "retry me shortly",
  // not "something is broken".
  sendSuccess(res, result, result.status === 'ok' ? 200 : 503);
}
