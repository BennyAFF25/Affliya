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
  accent: "#10B8C4",
  bg: "#17191A",
  card: "#101516",
  nested: "#101516",
  border: "#273133",
  text: "#F4F7F7",
  body: "#B9C5C7",
  muted: "#849A9F",
  logoUrl: "https://www.nettmark.com/icon.png",
  siteUrl: "https://www.nettmark.com",
  supportEmail: "support@nettmark.com",
};

function escapeHtml(input: string) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHref(href: string) {
  return String(href || "")
    .replace(/[\n\r\t"]+/g, "")
    .trim();
}

function toneStyles(tone: NettmarkEmailTone) {
  switch (tone) {
    case "success":
      return { bg: "transparent", text: "#8CCFB4", border: "#273133" };
    case "warning":
      return { bg: "transparent", text: "#E1BE82", border: "#273133" };
    case "danger":
      return { bg: "transparent", text: "#E9A7A7", border: "#273133" };
    case "neutral":
      return { bg: "transparent", text: "#9AAEB1", border: "#273133" };
    case "info":
    default:
      return { bg: "transparent", text: "#10B8C4", border: "#273133" };
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
    <div style="margin-top:24px;border-top:1px solid ${BRAND.border};border-bottom:1px solid ${BRAND.border};padding:18px 0;">
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
    <div style="margin-top:20px;padding:4px 0 4px 14px;border-left:2px solid ${tone.text};">
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
          style="display:inline-block;background:${BRAND.accent};color:#081315;padding:13px 22px;border-radius:9px;font-weight:700;text-decoration:none;font-size:13px;line-height:1.2;">
          ${escapeHtml(cta.label)}
        </a>
      </td>
    `
    : "";

  const secondary = secondaryCta
    ? `
      <td>
        <a href="${safeHref(secondaryCta.href)}"
          style="display:inline-block;background:transparent;color:${BRAND.body};padding:12px 18px;border-radius:9px;border:1px solid ${BRAND.border};font-weight:650;text-decoration:none;font-size:13px;line-height:1.2;">
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
    <meta name="format-detection" content="telephone=no" />
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
              <td style="padding:0 4px 18px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="${BRAND.logoUrl}" width="36" height="36" alt="Nettmark" style="display:inline-block;vertical-align:middle;border-radius:8px;" />
                      <span style="display:inline-block;vertical-align:middle;margin-left:10px;color:${BRAND.text};font-size:17px;font-weight:700;letter-spacing:-0.02em;">Nettmark</span>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <span style="color:${BRAND.muted};font-size:11px;">Distribution, simplified.</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:18px;padding:32px 30px;">
                ${badge?.text ? `
                  <div style="padding-top:22px;border-top:1px solid ${BRAND.border};color:${badgeStyle.text};font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">
                    ${escapeHtml(badge.text)}
                  </div>
                ` : ""}

                <h1 style="margin:${badge?.text ? "18px" : "0"} 0 0;color:${BRAND.text};font-size:27px;line-height:1.3;font-weight:700;letter-spacing:-0.025em;">
                  ${escapeHtml(args.heading)}
                </h1>

                ${paragraphHtml(args.body)}
                ${rowsHtml(args.rows)}
                ${noticeHtml(args.notice)}
                ${buttonsHtml(args.cta, args.secondaryCta)}

                ${args.footerNote ? `
                  <p style="margin:18px 0 0;color:${BRAND.muted};font-size:12px;line-height:1.55;">${escapeHtml(args.footerNote).replace(/\n/g, "<br/>")}</p>
                ` : ""}

                <div style="margin-top:32px;border-top:1px solid ${BRAND.border};padding-top:18px;">
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
