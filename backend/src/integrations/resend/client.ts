/**
 * Resend client — email delivery (system_design_architecture.pdf §13;
 * db_design.docx `emails` collection).
 *
 * Client shell only — construction and a singleton getter. No send
 * functions live here; those are feature work for whichever module first
 * needs to send an email (invitations, RSVP reminders, event reminders,
 * critical-change notices, task reminders — PRD §16–§18, §43–§44), and
 * should go through a shared `sendEmail()` that records the attempt per
 * db_design.docx's `emails` collection, not call `resend.emails.send()`
 * directly from scattered call sites.
 */
import { Resend } from 'resend';

import { env } from '#config/env.js';

let client: Resend | null = null;

export function getResendClient(): Resend {
  if (client) return client;

  if (!env.RESEND_API_KEY) {
    throw new Error('Resend is not configured — set RESEND_API_KEY.');
  }

  client = new Resend(env.RESEND_API_KEY);
  return client;
}
