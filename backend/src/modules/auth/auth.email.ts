/**
 * Sends the password-reset email via Resend. Only called when
 * `env.RESEND_API_KEY` is actually configured — see
 * auth.service.ts's requestPasswordReset() for what happens when it isn't
 * (the reset link is handed back in the response instead, non-production
 * only — never logged, per api_design.docx §5.5).
 */
import { env } from '#config/env.js';
import {
  getResendClient,
  mapResendErrorResponse,
  mapResendException,
} from '#integrations/resend/index.js';

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const client = getResendClient();

  const result = await client.emails
    .send({
      from: env.EMAIL_FROM ?? 'Make My Wedding Plan <noreply@example.com>',
      to,
      subject: 'Reset your Make My Wedding Plan password',
      html: `<p>Someone requested a password reset for this email address.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 1 hour and can only be used once. If you didn't request this, you can safely ignore this email.</p>`,
    })
    .catch((error: unknown) => {
      throw mapResendException(error, 'Password reset email');
    });

  if (result.error) {
    throw mapResendErrorResponse(result.error, 'Password reset email');
  }
}
