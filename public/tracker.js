// /public/tracker.js

(function () {
  try {
    // Grab campaign info from the script tag
    var scripts = document.querySelectorAll('script[src*="tracker.js"]');
    var trackingScript = scripts[scripts.length - 1]; // last one
    var business = trackingScript?.getAttribute('data-business');
    var offer = trackingScript?.getAttribute('data-offer');

    if (!business || !offer) return;

    // Utility: what page type is this?
    var url = window.location.href;
    var eventType = "click";
    if (url.match(/cart/i)) eventType = "add_to_cart";
    if (url.match(/thank/i)) eventType = "conversion";

    // Optionally grab more details (cart value, etc.) here

    // Fire event (replace with your real API endpoint)
    fetch("https://nettmark.com/api/track-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        business,
        offer_id: offer,
        event_type: eventType,
        // Add more details if you want!
        // e.g. amount: 123, user_email: etc.
        url,
      }),
    }).catch(() => {});
  } catch (e) {
    // Silent fail
  }
})();