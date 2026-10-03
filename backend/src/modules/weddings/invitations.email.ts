/**
 * Sends the wedding-member invitation email via Resend. Only called when
 * `env.RESEND_API_KEY` is actually configured — see invitations.service.ts
 * for what happens when it isn't (the invite link is handed back in the
 * response instead, non-production only, same dev fallback as
 * auth.service.ts's requestPasswordReset()).
 */
import { env } from '#config/env.js';
import {
  getResendClient,
  mapResendErrorResponse,
  mapResendException,
} from '#integrations/resend/index.js';

import type { MemberRole } from './members.model.js';

export interface InvitationEmailContext {
  weddingName: string;
  inviterName: string;
  role: MemberRole;
}

// inviterName/weddingName are both user-controlled (a user's own display
// name; a wedding's own name) — anyone can register, create a wedding and
// become its Admin, then invite an arbitrary email address. Without
// escaping, that's a way to make this app's own sending domain deliver
// attacker-chosen HTML to any inbox. The subject line doesn't need this: it
// can't contain markup, only header-injection characters, which Resend's
// client already rejects/strips at the API boundary.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendInvitationEmail(
  to: string,
  inviteUrl: string,
  context: InvitationEmailContext,
): Promise<void> {
  const client = getResendClient();
  const roleLabel = context.role === 'ADMIN' ? 'Admin' : 'Manager';
  const inviterName = escapeHtml(context.inviterName);
  const weddingName = escapeHtml(context.weddingName);

  const result = await client.emails
    .send({
      from: env.EMAIL_FROM ?? 'Make My Wedding Plan <noreply@example.com>',
      to,
      subject: `${context.inviterName} invited you to join ${context.weddingName}`,
      html: `<p>${inviterName} has invited you to join <strong>${weddingName}</strong> as a <strong>${roleLabel}</strong> on Make My Wedding Plan.</p><p><a href="${inviteUrl}">View your invitation</a></p><p>This link expires in 7 days. If you weren't expecting this, you can safely ignore this email.</p>`,
    })
    .catch((error: unknown) => {
      throw mapResendException(error, 'Wedding invitation email');
    });

  if (result.error) {
    throw mapResendErrorResponse(result.error, 'Wedding invitation email');
  }
}
