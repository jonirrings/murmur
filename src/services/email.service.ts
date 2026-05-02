import { Resend } from "resend";

/**
 * Email service using Resend (https://resend.com).
 * Used for magic link authentication emails.
 */

let resendClient: Resend | null = null;

function getResendClient(apiKey: string): Resend {
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

interface SendMagicLinkOptions {
  to: string;
  url: string;
  token: string;
}

export async function sendMagicLinkEmail(
  options: SendMagicLinkOptions,
  apiKey: string,
  fromEmail: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResendClient(apiKey);

    const { error } = await resend.emails.send({
      from: fromEmail,
      to: options.to,
      subject: "Sign in to Murmur",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #1a1a1a; margin-bottom: 24px;">Sign in to Murmur</h2>
          <p style="color: #4a4a4a; margin-bottom: 24px;">Click the link below to sign in. This link will expire in 10 minutes.</p>
          <a href="${options.url}?token=${options.token}"
             style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
            Sign in
          </a>
          <p style="color: #888; font-size: 13px; margin-top: 24px;">
            If you didn't request this email, you can safely ignore it.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("[email] Resend error:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[email] Failed to send magic link:", message);
    return { success: false, error: message };
  }
}
