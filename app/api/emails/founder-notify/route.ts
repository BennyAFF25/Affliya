import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { type, email, role } = body;

    if (!process.env.RESEND_API_KEY || !process.env.ADMIN_NOTIFY_EMAIL) {
      return NextResponse.json(
        { ok: false, error: "Missing env vars" },
        { status: 500 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const subject = `🚀 New ${role} signup on Nettmark`;

    const html = `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0b0b0b;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:28px;">
      <tr>
        <td align="center">
          <table width="540" cellpadding="0" cellspacing="0" style="background:#0e0e0e;border-radius:18px;border:1px solid #1f2933;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
            
            <!-- Header -->
            <tr>
              <td style="padding:20px 22px;border-bottom:1px solid #1f2933;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right:12px;">
                      <img src="https://www.nettmark.com/icon.png" width="38" height="38" style="border-radius:10px;display:block;" />
                    </td>
                    <td>
                      <div style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.2px;">
                        Nettmark Founder Alert
                      </div>
                      <div style="font-size:12px;color:#9ca3af;margin-top:3px;">
                        Internal system event
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:24px 22px;">
                <div style="font-size:22px;font-weight:900;color:#ffffff;margin-bottom:10px;">
                  🚀 New ${role} just joined
                </div>

                <div style="font-size:14px;line-height:1.7;color:#e5e7eb;">
                  Someone just trusted <b>Nettmark</b> enough to sign up.
                </div>

                <!-- Info box -->
                <div style="margin-top:16px;padding:14px 16px;border-radius:14px;background:#0b1220;border:1px solid rgba(0,194,203,0.25);">
                  <div style="font-size:13px;color:#9ca3af;margin-bottom:6px;">
                    EVENT DETAILS
                  </div>
                  <div style="font-size:14px;color:#ffffff;line-height:1.6;">
                    <b>Type:</b> ${type}<br/>
                    <b>Role:</b> ${role}<br/>
                    <b>Email:</b> ${email}
                  </div>
                </div>

                <!-- Cheeky founder note -->
                <div style="margin-top:18px;padding:14px 16px;border-radius:14px;background:rgba(0,194,203,0.08);border:1px solid rgba(0,194,203,0.3);color:#9ff3f6;font-size:13px;line-height:1.6;">
                  Another brick laid.<br/>
                  No sales calls. No chasing.<br/>
                  <b>The system is working.</b>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:16px 22px;border-top:1px solid #1f2933;font-size:12px;color:#6b7280;">
                Founder-only notification · Nettmark © 2026<br/>
                <span style="color:#374151;">If this fires, momentum exists.</span>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

    await resend.emails.send({
      from: `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
      to: [process.env.ADMIN_NOTIFY_EMAIL],
      subject,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[founder-notify]", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}