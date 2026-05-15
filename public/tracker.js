// /public/tracker.js

(function () {
  try {
    var ATTR_AFF_KEY = 'nettmark_nm_aff';
    var ATTR_CAMP_KEY = 'nettmark_nm_camp';

    // Grab campaign info from the script tag
    var scripts = document.querySelectorAll('script[src*="tracker.js"]');
    var trackingScript = scripts[scripts.length - 1]; // last one
    var business = trackingScript?.getAttribute('data-business');
    var offer = trackingScript?.getAttribute('data-offer');

    if (!business || !offer) return;

    function setCookie(name, value) {
      try {
        document.cookie = name + '=' + encodeURIComponent(value) + '; Path=/; Max-Age=' + (60 * 60 * 24 * 7) + '; SameSite=Lax';
      } catch (_) {}
    }

    function getCookie(name) {
      try {
        var match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
        return match ? decodeURIComponent(match[1]) : null;
      } catch (_) {
        return null;
      }
    }

    function setStored(key, value) {
      if (!value) return;
      try { window.localStorage.setItem(key, value); } catch (_) {}
      setCookie(key, value);
    }

    function getStored(key) {
      try {
        var local = window.localStorage.getItem(key);
        if (local) return local;
      } catch (_) {}
      return getCookie(key);
    }

    function queryParam(name, rawUrl) {
      try {
        var parsed = new URL(rawUrl || window.location.href, window.location.origin);
        return parsed.searchParams.get(name);
      } catch (_) {
        return null;
      }
    }

    // Utility: what page type is this?
    var url = window.location.href;
    var eventType = "click";
    if (url.match(/cart/i)) eventType = "add_to_cart";
    if (url.match(/thank|order|checkout/i)) eventType = "checkout_completed";

    var affiliateId = queryParam('nm_aff', url) || getStored(ATTR_AFF_KEY);
    var campaignId = queryParam('nm_camp', url) || getStored(ATTR_CAMP_KEY);

    if (affiliateId) setStored(ATTR_AFF_KEY, affiliateId);
    if (campaignId) setStored(ATTR_CAMP_KEY, campaignId);

    if (eventType === 'checkout_completed' && affiliateId && campaignId) {
      eventType = 'conversion';
    }

    // Fire event (replace with your real API endpoint)
    fetch("https://www.nettmark.com/api/track-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        business,
        affiliate_id: affiliateId,
        campaign_id: campaignId,
        offer_id: offer,
        event_type: eventType,
        event_data: {
          url: url,
          page_url: url,
          referrer: document.referrer || null,
          title: document.title || null,
          nm_aff: affiliateId,
          nm_camp: campaignId,
        },
      }),
    }).catch(() => {});
  } catch (e) {
    // Silent fail
  }
})();
