import type { Request, Response } from 'express';

import { AppError } from '#core/errors/index.js';
import { sendSuccess } from '#core/http/response.js';
import {
  clearAuthCookies,
  COOKIE_NAMES,
  setAccessCookie,
  setRefreshCookie,
} from '#middleware/cookies.js';

import {
  getCurrentUser,
  loginUser,
  refreshAccessToken,
  registerUser,
  requestPasswordReset,
  resetPassword,
} from './auth.service.js';
import type {
  ForgotPasswordBody,
  LoginBody,
  RegisterBody,
  ResetPasswordBody,
} from './auth.validation.js';

export async function postRegister(req: Request, res: Response): Promise<void> {
  const body = req.validated?.body as RegisterBody;
  const { user, tokens } = await registerUser(body);

  setAccessCookie(res, tokens.accessToken);
  setRefreshCookie(res, tokens.refreshToken);
  sendSuccess(res, { user }, 201);
}

export async function postLogin(req: Request, res: Response): Promise<void> {
  const body = req.validated?.body as LoginBody;
  const { user, tokens } = await loginUser(body);

  setAccessCookie(res, tokens.accessToken);
  setRefreshCookie(res, tokens.refreshToken);
  sendSuccess(res, { user });
}

export async function postRefresh(req: Request, res: Response): Promise<void> {
  const refreshToken = req.cookies[COOKIE_NAMES.refresh] as string | undefined;
  if (!refreshToken) {
    throw AppError.unauthorized();
  }

  const { accessToken } = await refreshAccessToken(refreshToken);
  setAccessCookie(res, accessToken);
  sendSuccess(res, {});
}

/** Safe to call repeatedly and without a session — api_design.docx §5.4. */
export function postLogout(_req: Request, res: Response): void {
  clearAuthCookies(res);
  sendSuccess(res, {});
}

export async function getMe(req: Request, res: Response): Promise<void> {
  // Set by middleware/authenticate.ts — this route only mounts behind it.
  if (!req.userId) {
    throw AppError.unauthorized();
  }

  const user = await getCurrentUser(req.userId);
  sendSuccess(res, { user });
}

export async function postForgotPassword(req: Request, res: Response): Promise<void> {
  const body = req.validated?.body as ForgotPasswordBody;
  const { devResetUrl } = await requestPasswordReset(body.email);

  sendSuccess(res, {
    message: 'If an account exists for this email, a password reset link has been sent.',
    ...(devResetUrl ? { devResetUrl } : {}),
  });
}

export async function postResetPassword(req: Request, res: Response): Promise<void> {
  const body = req.validated?.body as ResetPasswordBody;
  await resetPassword(body.token, body.password);
  sendSuccess(res, { message: 'Your password has been reset. Please sign in again.' });
}
