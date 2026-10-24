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
  accent: "#12CFE3",
  bg: "#0B0F12",
  card: "#11181C",
  nested: "#0E1418",
  border: "#1F2B31",
  text: "#F5F9FA",
  body: "#AEBCC2",
  muted: "#7D9098",
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
      return { bg: "transparent", text: BRAND.accent, border: BRAND.border };
    case "warning":
      return { bg: "transparent", text: "#E1BE82", border: BRAND.border };
    case "danger":
      return { bg: "transparent", text: "#E9A7A7", border: BRAND.border };
    case "neutral":
      return { bg: "transparent", text: "#9FB2B8", border: BRAND.border };
    case "info":
    default:
      return { bg: "transparent", text: BRAND.accent, border: BRAND.border };
  }
}

function paragraphHtml(body?: string) {
  if (!body) return "";
  return `<p class="nm-body-copy" style="margin:14px 0 0;color:${BRAND.body};font-size:14px;line-height:1.65;">${escapeHtml(
    body,
  ).replace(/\n/g, "<br/>")}</p>`;
}

function rowsHtml(rows?: NettmarkEmailRow[]) {
  const validRows = (rows ?? []).filter((row) => row?.label && row?.value);
  if (!validRows.length) return "";

  const content = validRows
    .map((row, index) => {
      const value = row.href
        ? `<a class="nm-accent" href="${safeHref(row.href)}" style="color:${BRAND.accent};text-decoration:none;font-weight:700;">${escapeHtml(row.value)}</a>`
        : `<span class="nm-text" style="color:${BRAND.text};font-weight:650;">${escapeHtml(row.value)}</span>`;

      return `
        <tr>
          <td class="nm-muted" style="padding:${index === 0 ? "0" : "12px"} 0 0;color:${BRAND.muted};font-size:12px;vertical-align:top;width:145px;">
            ${escapeHtml(row.label)}
          </td>
          <td class="nm-text" style="padding:${index === 0 ? "0" : "12px"} 0 0 14px;color:${BRAND.text};font-size:13px;line-height:1.5;vertical-align:top;">
            ${value}
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="nm-rule" style="margin-top:24px;border-top:1px solid ${BRAND.border};border-bottom:1px solid ${BRAND.border};padding:18px 0;">
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
    <div class="nm-notice nm-${notice.tone ?? "info"}" style="margin-top:20px;padding:4px 0 4px 14px;border-left:2px solid ${tone.text};">
      ${notice.title ? `<div class="nm-notice-title nm-${notice.tone ?? "info"}" style="color:${tone.text};font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(notice.title)}</div>` : ""}
      <div class="nm-notice-text nm-${notice.tone ?? "info"}" style="margin-top:${notice.title ? "7px" : "0"};color:${tone.text};font-size:13px;line-height:1.6;">
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
        <a class="nm-primary" href="${safeHref(cta.href)}"
          style="display:inline-block;background:${BRAND.accent};color:#071014;padding:13px 22px;border-radius:10px;font-weight:700;text-decoration:none;font-size:13px;line-height:1.2;">
          ${escapeHtml(cta.label)}
        </a>
      </td>
    `
    : "";

  const secondary = secondaryCta
    ? `
      <td>
        <a class="nm-secondary" href="${safeHref(secondaryCta.href)}"
          style="display:inline-block;background:transparent;color:${BRAND.body};padding:12px 18px;border-radius:10px;border:1px solid ${BRAND.border};font-weight:650;text-decoration:none;font-size:13px;line-height:1.2;">
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

  // Gmail for iOS may invert dark emails into pale layouts. Since September 2026,
  // `color-scheme: light only` opts Google-hosted Gmail inboxes out of that
  // forced recolouring while retaining our deliberately dark inline design.
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <meta name="format-detection" content="telephone=no" />
    <meta name="supported-color-schemes" content="light only" />
    <style type="text/css">
      /* Apple Mail and other standards-aware clients can follow the reader's mode.
         Gmail mobile does not support prefers-color-scheme; light only keeps the
         carefully branded dark design from being forcibly inverted on Google accounts. */
      :root { color-scheme: light dark; }
      @media (prefers-color-scheme: light) {
        body.nm-canvas, table.nm-canvas, td.nm-canvas-cell { background-color:#F4F7F9 !important; }
        td.nm-card { background-color:#FFFFFF !important; border-color:#D7E2E7 !important; }
        .nm-title, .nm-text { color:#121C24 !important; }
        .nm-body-copy { color:#475966 !important; }
        .nm-muted { color:#687F89 !important; }
        .nm-rule { border-color:#D7E2E7 !important; }
        .nm-badge.nm-success, .nm-badge.nm-info, .nm-accent { color:#008AA4 !important; }
        .nm-badge.nm-warning { color:#91621E !important; }
        .nm-badge.nm-danger { color:#B74444 !important; }
        .nm-badge.nm-neutral { color:#647883 !important; }
        .nm-notice.nm-info, .nm-notice.nm-success { border-color:#008AA4 !important; }
        .nm-notice-title.nm-info, .nm-notice-title.nm-success,
        .nm-notice-text.nm-info, .nm-notice-text.nm-success { color:#008AA4 !important; }
        .nm-notice.nm-warning { border-color:#91621E !important; }
        .nm-notice-title.nm-warning, .nm-notice-text.nm-warning { color:#91621E !important; }
        .nm-notice.nm-danger { border-color:#B74444 !important; }
        .nm-notice-title.nm-danger, .nm-notice-text.nm-danger { color:#B74444 !important; }
        .nm-primary { background-color:#0BBFD7 !important; color:#071014 !important; }
        .nm-secondary { color:#121C24 !important; border-color:#D7E2E7 !important; }
      }
      @media only screen and (max-width:620px) {
        td.nm-canvas-cell { padding:0 !important; }
        td.nm-header { padding:22px 20px 18px !important; }
        td.nm-card { border-radius:0 !important; border-left:0 !important; border-right:0 !important; }
      }
    </style>
    <title>${BRAND.name}</title>
  </head>
  <body class="nm-canvas" bgcolor="${BRAND.bg}" style="margin:0;padding:0;background:${BRAND.bg};color:${BRAND.text};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;">
    ${preview ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preview}</div>` : ""}

    <table class="nm-canvas" role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${BRAND.bg}" style="width:100%;background:${BRAND.bg};padding:0;">
      <tr>
        <td class="nm-canvas-cell" align="center" bgcolor="${BRAND.bg}" style="background:${BRAND.bg};padding:32px 0;">
          <table class="nm-layout" role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;">
            <tr>
              <td class="nm-header" style="padding:22px 20px 18px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="${BRAND.logoUrl}" width="36" height="36" alt="Nettmark" style="display:inline-block;vertical-align:middle;border-radius:8px;" />
                      <span style="display:inline-block;vertical-align:middle;margin-left:10px;color:${BRAND.text};font-size:17px;font-weight:700;letter-spacing:-0.02em;">Nettmark</span>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <span class="nm-muted" style="color:${BRAND.muted};font-size:11px;">Distribution, simplified.</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="nm-card" bgcolor="${BRAND.card}" style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:18px;padding:32px 30px;">
                ${badge?.text ? `
                  <div class="nm-badge nm-${badge?.tone ?? "info"} nm-rule" style="padding-top:22px;border-top:1px solid ${BRAND.border};color:${badgeStyle.text};font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">
                    ${escapeHtml(badge.text)}
                  </div>
                ` : ""}

                <h1 class="nm-title" style="margin:${badge?.text ? "18px" : "0"} 0 0;color:${BRAND.text};font-size:27px;line-height:1.3;font-weight:700;letter-spacing:-0.025em;">
                  ${escapeHtml(args.heading)}
                </h1>

                ${paragraphHtml(args.body)}
                ${rowsHtml(args.rows)}
                ${noticeHtml(args.notice)}
                ${buttonsHtml(args.cta, args.secondaryCta)}

                ${args.footerNote ? `
                  <p class="nm-muted" style="margin:18px 0 0;color:${BRAND.muted};font-size:12px;line-height:1.55;">${escapeHtml(args.footerNote).replace(/\n/g, "<br/>")}</p>
                ` : ""}

                <div class="nm-rule" style="margin-top:32px;border-top:1px solid ${BRAND.border};padding-top:18px;">
                  <p class="nm-muted" style="margin:0;color:${BRAND.muted};font-size:12px;line-height:1.55;">
                    Need help? Reply to this email or contact
                    <a class="nm-accent" href="mailto:${BRAND.supportEmail}" style="color:${BRAND.accent};text-decoration:none;font-weight:700;">${BRAND.supportEmail}</a>.
                  </p>
                  <p class="nm-muted" style="margin:8px 0 0;color:${BRAND.muted};font-size:11px;">© ${year} Nettmark. All rights reserved.</p>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:14px 8px 0;text-align:center;">
                <p class="nm-muted" style="margin:0;color:${BRAND.muted};font-size:11px;line-height:1.5;">${escapeHtml(recipientNote)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
