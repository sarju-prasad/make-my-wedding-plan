/**
 * Public except /auth/me. api_design.docx §5.1, §20 (rate limit login,
 * register, refresh, and password reset).
 */
import { Router } from 'express';

import { authenticate } from '#middleware/authenticate.js';
import { emailKey, rateLimit } from '#middleware/rate-limit.js';
import { validate } from '#middleware/validate.js';

import {
  getMe,
  postForgotPassword,
  postLogin,
  postLogout,
  postRefresh,
  postRegister,
  postResetPassword,
} from './auth.controller.js';
import {
  forgotPasswordBodySchema,
  loginBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
} from './auth.validation.js';

export const authRouter: Router = Router();

authRouter.post(
  '/auth/register',
  rateLimit('auth:register'),
  validate({ body: registerBodySchema }),
  postRegister,
);

authRouter.post(
  '/auth/login',
  rateLimit('auth:login'),
  rateLimit('auth:login-per-email', emailKey),
  validate({ body: loginBodySchema }),
  postLogin,
);

authRouter.post('/auth/refresh', rateLimit('auth:refresh'), postRefresh);
authRouter.post('/auth/logout', postLogout);
authRouter.get('/auth/me', authenticate, getMe);

authRouter.post(
  '/auth/forgot-password',
  rateLimit('auth:forgot-password'),
  validate({ body: forgotPasswordBodySchema }),
  postForgotPassword,
);

authRouter.post(
  '/auth/reset-password',
  rateLimit('auth:reset-password'),
  validate({ body: resetPasswordBodySchema }),
  postResetPassword,
);
