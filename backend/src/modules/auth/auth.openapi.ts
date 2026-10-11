import { z } from 'zod';

import { commonErrorResponses, registerModulePaths, successEnvelope } from '#config/openapi.js';

import { USER_STATUS } from './auth.model.js';
// Request bodies are imported directly from the schemas that actually
// validate them at runtime, rather than re-declared here — two independent
// copies of e.g. "password min length 8" can only drift out of sync with
// each other, and none of these have a `.transform()`, so the runtime
// input shape is exactly what should be documented.
import {
  forgotPasswordBodySchema,
  loginBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
} from './auth.validation.js';

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  status: z.enum(USER_STATUS),
  lastLoginAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const userResponse = successEnvelope('UserResponse', z.object({ user: userSchema }));
const emptyResponse = successEnvelope('EmptyResponse', z.object({}));

const messageResponse = successEnvelope(
  'MessageResponse',
  z.object({ message: z.string(), devResetUrl: z.string().optional() }),
);

registerModulePaths({
  '/auth/register': {
    post: {
      operationId: 'postAuthRegister',
      summary: 'Register a new account',
      tags: ['Authentication'],
      security: [],
      requestBody: { content: { 'application/json': { schema: registerBodySchema } } },
      responses: {
        '201': {
          description: 'Account created; access and refresh cookies set.',
          content: { 'application/json': { schema: userResponse } },
        },
        ...commonErrorResponses,
      },
    },
  },
  '/auth/login': {
    post: {
      operationId: 'postAuthLogin',
      summary: 'Authenticate with email and password',
      tags: ['Authentication'],
      security: [],
      requestBody: { content: { 'application/json': { schema: loginBodySchema } } },
      responses: {
        '200': {
          description: 'Authenticated; access and refresh cookies set.',
          content: { 'application/json': { schema: userResponse } },
        },
        ...commonErrorResponses,
      },
    },
  },
  '/auth/refresh': {
    post: {
      operationId: 'postAuthRefresh',
      summary: 'Issue a new access token from the refresh cookie',
      tags: ['Authentication'],
      security: [],
      responses: {
        '200': {
          description: 'A new access-token cookie was set.',
          content: { 'application/json': { schema: emptyResponse } },
        },
        '401': commonErrorResponses['401'],
        '429': commonErrorResponses['429'],
      },
    },
  },
  '/auth/logout': {
    post: {
      operationId: 'postAuthLogout',
      summary: 'Clear authentication cookies',
      description: 'Safe to call repeatedly and without a session.',
      tags: ['Authentication'],
      security: [],
      responses: {
        '200': {
          description: 'Cookies cleared.',
          content: { 'application/json': { schema: emptyResponse } },
        },
      },
    },
  },
  '/auth/me': {
    get: {
      operationId: 'getAuthMe',
      summary: 'Get the current authenticated user',
      tags: ['Authentication'],
      security: [{ accessTokenCookie: [] }],
      responses: {
        '200': {
          description: 'The current user.',
          content: { 'application/json': { schema: userResponse } },
        },
        '401': commonErrorResponses['401'],
      },
    },
  },
  '/auth/forgot-password': {
    post: {
      operationId: 'postAuthForgotPassword',
      summary: 'Request a password reset link',
      description:
        'Always returns the same generic response, whether or not the email is registered.',
      tags: ['Authentication'],
      security: [],
      requestBody: { content: { 'application/json': { schema: forgotPasswordBodySchema } } },
      responses: {
        '200': {
          description: 'Generic acknowledgement.',
          content: { 'application/json': { schema: messageResponse } },
        },
        '422': commonErrorResponses['422'],
        '429': commonErrorResponses['429'],
      },
    },
  },
  '/auth/reset-password': {
    post: {
      operationId: 'postAuthResetPassword',
      summary: 'Set a new password using a reset token',
      tags: ['Authentication'],
      security: [],
      requestBody: { content: { 'application/json': { schema: resetPasswordBodySchema } } },
      responses: {
        '200': {
          description: 'Password reset; every outstanding session is now invalid.',
          content: { 'application/json': { schema: messageResponse } },
        },
        '401': commonErrorResponses['401'],
        '422': commonErrorResponses['422'],
        '429': commonErrorResponses['429'],
      },
    },
  },
});
