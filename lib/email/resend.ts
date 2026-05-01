import { Resend } from "resend";
import { getResendEnv } from "@/lib/supabase/env";

type InviteEmailParams = {
  to: string;
  invitedByEmail: string;
  projectName: string;
  invitePath: string;
  expiresAt: string;
};

export async function sendInviteEmail(params: InviteEmailParams) {
  const env = getResendEnv();
  const resend = new Resend(env.apiKey);
  const inviteUrl = `${env.appBaseUrl.replace(/\/$/, "")}${params.invitePath}`;

  const { error } = await resend.emails.send({
    from: env.fromEmail,
    to: params.to,
    subject: `You're invited to join ${params.projectName}`,
    html: `
      <p>You have been invited to join <strong>${escapeHtml(params.projectName)}</strong>.</p>
      <p>Invited by: ${escapeHtml(params.invitedByEmail)}</p>
      <p>
        <a href="${escapeHtml(inviteUrl)}">Accept invitation</a>
      </p>
      <p>Invite expires at: ${escapeHtml(new Date(params.expiresAt).toLocaleString())}</p>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
