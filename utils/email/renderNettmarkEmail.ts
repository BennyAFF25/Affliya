type Tone = "success" | "warning" | "danger" | "info";

type Row = {
  label: string;
  value: string;
  href?: string;
};

type RenderArgs = {
  previewText?: string;
  badge?: { text: string; tone?: Tone };
  heading: string;
  body?: string;
  rows?: Row[];
  cta?: { label: string; href: string };
  footerNote?: string;
};

const BRAND = {
  name: "Nettmark",
  accent: "#00C2CB",
  bg: "#0b0b0b",
  card: "#121212",
  border: "#232323",
  text: "#EDEDED",
  muted: "#A1A1AA",
  logoUrl: "https://www.nettmark.com/icon.png",
  siteUrl: "https://www.nettmark.com",
};

function escapeHtml(input: string) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toneStyles(tone: Tone) {
  switch (tone) {
    case "success":
      return { bg: "#062a1a", text: "#8ef3b0", border: "#15803d" };
    case "warning":
      return { bg: "#2a1f06", text: "#fde68a", border: "#a16207" };
    case "danger":
      return { bg: "#2a0f0f", text: "#fecaca", border: "#b91c1c" };
    case "info":
    default:
      return { bg: "#071f2a", text: "#7ff5fb", border: "#0ea5e9" };
  }
}

function safeHref(href: string) {
  // Basic guard against accidental newlines or quotes
  return href.replace(/[\n\r\t\"]+/g, "").trim();
}

export function renderNettmarkEmail(args: RenderArgs) {
  const year = new Date().getFullYear();
  const preview = args.previewText ? `${args.previewText}` : "";

  const badge = args.badge;
  const badgeTone = badge?.tone ?? "info";
  const badgeStyle = toneStyles(badgeTone);

  const rows = (args.rows ?? [])
    .filter((r) => r && r.label && r.value)
    .map((r) => {
      const value = r.href
        ? `<a href="${safeHref(r.href)}" style="color:${BRAND.accent}; text-decoration:none;">${escapeHtml(r.value)}</a>`
        : `<span style="color:${BRAND.text};">${escapeHtml(r.value)}</span>`;

      return `
        <tr>
          <td style="padding:10px 0; color:${BRAND.muted}; font-size:12px; width:150px; vertical-align:top;">
            ${escapeHtml(r.label)}
          </td>
          <td style="padding:10px 0; color:${BRAND.text}; font-size:13px; vertical-align:top;">
            ${value}
          </td>
        </tr>
        <tr>
          <td colspan="2" style="border-bottom:1px solid ${BRAND.border}; font-size:0; line-height:0;">&nbsp;</td>
        </tr>
      `;
    })
    .join("");

  const bodyHtml = args.body
    ? `<p style="margin:14px 0 0 0; color:${BRAND.text}; font-size:14px; line-height:1.55;">${escapeHtml(
        args.body
      ).replace(/\n/g, "<br/>")}</p>`
    : "";

  const rowsBlock = rows
    ? `
      <div style="margin-top:18px; border:1px solid ${BRAND.border}; border-radius:14px; overflow:hidden;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse;">
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `
    : "";

  const cta = args.cta
    ? `
      <div style="margin-top:18px;">
        <a href="${safeHref(args.cta.href)}"
           style="
             display:inline-block;
             background:${BRAND.accent};
             color:#000;
             padding:12px 16px;
             border-radius:12px;
             font-weight:800;
             text-decoration:none;
             font-size:13px;
           ">
          ${escapeHtml(args.cta.label)}
        </a>
      </div>
    `
    : "";

  const footerNote = args.footerNote
    ? `<p style="margin:16px 0 0 0; color:${BRAND.muted}; font-size:12px; line-height:1.45;">${escapeHtml(
        args.footerNote
      )}</p>`
    : "";

  // TABLE-BASED HTML for deliverability
  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <title>${BRAND.name}</title>
  </head>
  <body style="margin:0; padding:0; background:${BRAND.bg}; color:${BRAND.text}; font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
    ${
      preview
        ? `<div style="display:none; max-height:0; overflow:hidden; opacity:0;">${escapeHtml(
            preview
          )}</div>`
        : ""
    }

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.bg}; padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px; width:100%;">
            <tr>
              <td style="padding:0 0 14px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="${BRAND.logoUrl}" width="38" height="38" alt="${BRAND.name}"
                        style="border-radius:10px; display:inline-block; vertical-align:middle;" />
                      <span style="margin-left:10px; font-weight:900; letter-spacing:0.2px; color:${BRAND.text}; vertical-align:middle;">
                        ${BRAND.name}
                      </span>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <a href="${BRAND.siteUrl}" style="font-size:11px; color:${BRAND.muted}; text-decoration:none;">
                        Performance marketing under one roof
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="background:${BRAND.card}; border:1px solid ${BRAND.border}; border-radius:18px; padding:22px;">
                ${
                  badge?.text
                    ? `
                  <div style="
                    display:inline-block;
                    padding:6px 10px;
                    border-radius:999px;
                    background:${badgeStyle.bg};
                    color:${badgeStyle.text};
                    border:1px solid ${badgeStyle.border};
                    font-size:11px;
                    font-weight:900;
                    letter-spacing:0.12em;
                    text-transform:uppercase;
                  ">
                    ${escapeHtml(badge.text)}
                  </div>
                `
                    : ""
                }

                <h1 style="margin:14px 0 0 0; font-size:22px; line-height:1.25; color:${BRAND.text}; letter-spacing:-0.2px;">
                  ${escapeHtml(args.heading)}
                </h1>

                ${bodyHtml}
                ${rowsBlock}
                ${cta}
                ${footerNote}

                <div style="margin-top:20px; border-top:1px solid ${BRAND.border}; padding-top:14px;">
                  <p style="margin:0; color:${BRAND.muted}; font-size:12px; line-height:1.45;">
                    Need help? Reply to this email or visit
                    <a href="${BRAND.siteUrl}/support" style="color:${BRAND.accent}; text-decoration:none;">Support</a>.
                  </p>
                  <p style="margin:8px 0 0 0; color:${BRAND.muted}; font-size:11px;">
                    © ${year} ${BRAND.name}. All rights reserved.
                  </p>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:14px 2px 0 2px;">
                <p style="margin:0; color:${BRAND.muted}; font-size:11px; line-height:1.45; text-align:center;">
                  You are receiving this because you have an account on ${BRAND.name}.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}