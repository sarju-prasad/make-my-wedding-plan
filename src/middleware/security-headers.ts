/**
 * Security response headers — api_design.docx §20 ("Use security headers and
 * strict CORS configuration").
 *
 * This is a private, cookie-authenticated JSON API with no server-rendered
 * HTML, so most of helmet's default protections (which are largely aimed at
 * HTML-serving apps) apply harmlessly, and Content-Security-Policy is left to
 * the frontend project, which is the one actually rendering pages.
 */
import type { RequestHandler } from 'express';
import helmet from 'helmet';

import { isProduction } from '#config/env.js';

export const securityHeaders: RequestHandler = helmet({
  // This API serves no HTML; a CSP here would protect nothing and only
  // needs revisiting if that stops being true.
  contentSecurityPolicy: false,
  // HSTS only makes sense once the app is actually reached over HTTPS in
  // production; forcing it in local dev would break plain-HTTP localhost.
  hsts: isProduction ? { maxAge: 15552000, includeSubDomains: true } : false,
});
