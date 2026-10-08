export type NettmarkEmailTone = "success" | "warning" | "danger" | "info" | "neutral";

export type NettmarkEmailRow = {
  label: string;
  value: string;
  href?: string;
};

export type NettmarkEmailNotice = {
  title?: string;
  body: string;
  tone?: NettmarkEmailTone;
};

export type RenderNettmarkEmailArgs = {
  previewText?: string;
  badge?: { text: string; tone?: NettmarkEmailTone };
  heading: string;
  body?: string;
  rows?: NettmarkEmailRow[];
  notice?: NettmarkEmailNotice;
  cta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  footerNote?: string;
  recipientNote?: string;
};

const BRAND = {
  name: "Nettmark",
  accent: "#00C2CB",
  bg: "#0F0F0F",
  card: "#151718",
  nested: "#101415",
  border: "#2A2A2A",
  text: "#FFFFFF",
  body: "#E5E7EB",
  muted: "#94A3B8",
  logoUrl: "https://www.nettmark.com/icon.png",
  siteUrl: "https://www.nettmark.com",
  supportEmail: "support@nettmark.com",
};

function escapeHtml(input: string) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHref(href: string) {
  return String(href || "")
    .replace(/[\n\r\t\"]+/g, "")
    .trim();
}

function toneStyles(tone: NettmarkEmailTone) {
  switch (tone) {
    case "success":
      return { bg: "#0A2618", text: "#A7F3D0", border: "#1F7A4A" };
    case "warning":
      return { bg: "#2B220B", text: "#FDE68A", border: "#9A6B12" };
    case "danger":
      return { bg: "#2A1212", text: "#FECACA", border: "#A33A3A" };
    case "neutral":
      return { bg: "#1A1A1A", text: "#CBD5E1", border: "#333333" };
    case "info":
    default:
      return { bg: "#08282B", text: "#8CF5FA", border: "#14676C" };
  }
}

function paragraphHtml(body?: string) {
  if (!body) return "";
  return `<p style="margin:14px 0 0;color:${BRAND.body};font-size:14px;line-height:1.65;">${escapeHtml(
    body,
  ).replace(/\n/g, "<br/>")}</p>`;
}

function rowsHtml(rows?: NettmarkEmailRow[]) {
  const validRows = (rows ?? []).filter((row) => row?.label && row?.value);
  if (!validRows.length) return "";

  const content = validRows
    .map((row, index) => {
      const value = row.href
        ? `<a href="${safeHref(row.href)}" style="color:${BRAND.accent};text-decoration:none;font-weight:700;">${escapeHtml(row.value)}</a>`
        : `<span style="color:${BRAND.text};font-weight:650;">${escapeHtml(row.value)}</span>`;

      return `
        <tr>
          <td style="padding:${index === 0 ? "0" : "12px"} 0 0;color:${BRAND.muted};font-size:12px;vertical-align:top;width:145px;">
            ${escapeHtml(row.label)}
          </td>
          <td style="padding:${index === 0 ? "0" : "12px"} 0 0 14px;color:${BRAND.text};font-size:13px;line-height:1.5;vertical-align:top;">
            ${value}
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div style="margin-top:18px;border:1px solid ${BRAND.border};border-radius:18px;background:${BRAND.nested};padding:16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;">
        <tbody>${content}</tbody>
      </table>
    </div>
  `;
}

function noticeHtml(notice?: NettmarkEmailNotice) {
  if (!notice?.body) return "";
  const tone = toneStyles(notice.tone ?? "info");

  return `
    <div style="margin-top:18px;padding:15px 16px;border-radius:18px;background:${tone.bg};border:1px solid ${tone.border};">
      ${notice.title ? `<div style="color:${tone.text};font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(notice.title)}</div>` : ""}
      <div style="margin-top:${notice.title ? "7px" : "0"};color:${tone.text};font-size:13px;line-height:1.6;">
        ${escapeHtml(notice.body).replace(/\n/g, "<br/>")}
      </div>
    </div>
  `;
}

function buttonsHtml(
  cta?: { label: string; href: string },
  secondaryCta?: { label: string; href: string },
) {
  if (!cta && !secondaryCta) return "";

  const primary = cta
    ? `
      <td style="padding:0 10px 0 0;">
        <a href="${safeHref(cta.href)}"
          style="display:inline-block;background:${BRAND.accent};color:#071011;padding:12px 18px;border-radius:999px;font-weight:800;text-decoration:none;font-size:13px;line-height:1.2;">
          ${escapeHtml(cta.label)}
        </a>
      </td>
    `
    : "";

  const secondary = secondaryCta
    ? `
      <td>
        <a href="${safeHref(secondaryCta.href)}"
          style="display:inline-block;background:#191B1C;color:${BRAND.body};padding:12px 18px;border-radius:999px;border:1px solid ${BRAND.border};font-weight:750;text-decoration:none;font-size:13px;line-height:1.2;">
          ${escapeHtml(secondaryCta.label)}
        </a>
      </td>
    `
    : "";

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:20px;">
      <tr>${primary}${secondary}</tr>
    </table>
  `;
}

export function renderNettmarkEmail(args: RenderNettmarkEmailArgs) {
  const year = new Date().getFullYear();
  const preview = args.previewText ? escapeHtml(args.previewText) : "";
  const badge = args.badge;
  const badgeStyle = toneStyles(badge?.tone ?? "info");
  const recipientNote =
    args.recipientNote ||
    `You are receiving this because you have an account or activity on ${BRAND.name}.`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>${BRAND.name}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.bg};color:${BRAND.text};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;">
    ${preview ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preview}</div>` : ""}

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:${BRAND.bg};padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;">
            <tr>
              <td style="padding:0 4px 14px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="${BRAND.logoUrl}" width="38" height="38" alt="Nettmark" style="display:inline-block;vertical-align:middle;border-radius:11px;" />
                      <span style="display:inline-block;vertical-align:middle;margin-left:10px;color:${BRAND.text};font-size:17px;font-weight:800;letter-spacing:-0.02em;">Nettmark</span>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <span style="color:${BRAND.muted};font-size:11px;">Distribution, simplified.</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:24px;padding:24px;box-shadow:0 22px 60px rgba(0,0,0,0.22);">
                ${badge?.text ? `
                  <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:${badgeStyle.bg};color:${badgeStyle.text};border:1px solid ${badgeStyle.border};font-size:10px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;">
                    ${escapeHtml(badge.text)}
                  </div>
                ` : ""}

                <h1 style="margin:${badge?.text ? "14px" : "0"} 0 0;color:${BRAND.text};font-size:24px;line-height:1.24;font-weight:700;letter-spacing:-0.025em;">
                  ${escapeHtml(args.heading)}
                </h1>

                ${paragraphHtml(args.body)}
                ${rowsHtml(args.rows)}
                ${noticeHtml(args.notice)}
                ${buttonsHtml(args.cta, args.secondaryCta)}

                ${args.footerNote ? `
                  <p style="margin:18px 0 0;color:${BRAND.muted};font-size:12px;line-height:1.55;">${escapeHtml(args.footerNote).replace(/\n/g, "<br/>")}</p>
                ` : ""}

                <div style="margin-top:22px;border-top:1px solid ${BRAND.border};padding-top:16px;">
                  <p style="margin:0;color:${BRAND.muted};font-size:12px;line-height:1.55;">
                    Need help? Reply to this email or contact
                    <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.accent};text-decoration:none;font-weight:700;">${BRAND.supportEmail}</a>.
                  </p>
                  <p style="margin:8px 0 0;color:#667085;font-size:11px;">© ${year} Nettmark. All rights reserved.</p>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:14px 8px 0;text-align:center;">
                <p style="margin:0;color:#667085;font-size:11px;line-height:1.5;">${escapeHtml(recipientNote)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
