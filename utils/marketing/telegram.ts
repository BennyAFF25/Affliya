export async function telegramSend(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
  }

  const url =
    `https://api.telegram.org/bot${token}/sendMessage` +
    `?chat_id=${encodeURIComponent(chatId)}` +
    `&text=${encodeURIComponent(text)}` +
    `&disable_web_page_preview=true`;

  const res = await fetch(url, { method: "GET" });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram sendMessage failed: ${res.status} ${body}`);
  }

  const json = await res.json();
  if (!json?.ok) {
    throw new Error(
      `Telegram sendMessage returned not ok: ${JSON.stringify(json)}`
    );
  }
}
