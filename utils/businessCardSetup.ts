type SetupError = { code?: string; decline_code?: string; type?: string; message?: string; setup_intent?: { id?: string } };

const messages: Record<string, string> = {
  insufficient_funds: "Your bank reported insufficient funds. Try another card or contact your bank.",
  do_not_honor: "Your bank declined this card. Contact your bank or try another card.",
  card_not_supported: "This card does not support this payment. Try another card.",
  currency_not_supported: "This card does not support the billing currency. Try another card or contact your bank.",
  country_not_supported: "This card's country is not supported for this payment. Try another card.",
  card_country_not_supported: "This card's country is not supported for this payment. Try another card.",
  incorrect_cvc: "The card security code is incorrect. Check it and try again.",
  expired_card: "This card has expired. Use a current card.",
  generic_decline: "Your bank declined this card. Contact your bank or try another card.",
  authentication_required: "Your bank requires authentication. Try again and complete the bank verification.",
};
export function businessCardSetupMessage(error: SetupError): string {
  return messages[error.decline_code || ""] || messages[error.code || ""] || "Your card could not be saved. Check the details, try another card, or contact your bank.";
}

export async function reportBusinessCardSetupFailure(error: SetupError) {
  try {
    const response = await fetch("/api/stripe/setup-intent-failure", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: error.code, decline_code: error.decline_code, type: error.type,
        setup_intent: error.setup_intent?.id, message: error.message }),
    });
    if (!response.ok) console.warn("[business-card-setup] Could not record setup failure");
  } catch { console.warn("[business-card-setup] Could not record setup failure"); }
}
