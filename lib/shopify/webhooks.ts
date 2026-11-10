export interface WebhookStore {
  uninstall(shop: string, triggeredAt: string): Promise<void>;
  redact(shop: string): Promise<void>;
}
// No payload parsing: stage one stores no customer data.
export async function handleWebhook(topic: string, shop: string, store: WebhookStore, triggeredAt = new Date().toISOString()): Promise<void> {
  switch (topic) {
    case "app/uninstalled": await store.uninstall(shop, triggeredAt); break;
    case "shop/redact": await store.redact(shop); break;
    case "customers/data_request":
    case "customers/redact": break;
    default: break;
  }
}
