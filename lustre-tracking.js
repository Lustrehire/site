(function () {
  const attributionStorageKey = "lustreHireAttribution";
  const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

  function captureLustreAttribution() {
    try {
      const params = new URLSearchParams(window.location.search);
      const attribution = {};
      let hasUtm = false;

      utmKeys.forEach((key) => {
        const value = params.get(key);
        if (value) {
          attribution[key] = value;
          hasUtm = true;
        }
      });

      if (!hasUtm) return;

      attribution.landing_page = window.location.pathname;
      attribution.first_seen_at = new Date().toISOString();

      localStorage.setItem(attributionStorageKey, JSON.stringify(attribution));
    } catch (error) {
      console.warn("Attribution capture failed:", error);
    }
  }

  function getLustreAttribution() {
    try {
      return JSON.parse(localStorage.getItem(attributionStorageKey)) || {};
    } catch (error) {
      return {};
    }
  }

  function trackLustreEvent(eventName, eventParams = {}) {
    try {
      const params = {
        page_path: window.location.pathname,
        page_url: window.location.href,
        ...eventParams,
      };

      if (window.gtag) {
        window.gtag("event", eventName, params);
      }

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: eventName,
        ...params,
      });

      if (window.fbq) {
        window.fbq("trackCustom", eventName, params);
      }
    } catch (error) {
      console.warn("Tracking event failed:", eventName, error);
    }
  }

  function getNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function buildLustreBookingTrackingParams(source = {}, extraParams = {}) {
    const hireFee = getNumber(source.hireFee);
    const bondAmount = getNumber(source.bondAmount ?? source.refundableBond);
    const totalDue = getNumber(source.totalDue ?? source.total_due) || (hireFee || bondAmount ? hireFee + bondAmount : 0);
    const params = {
      event_date: source.eventDate || source.event_date || "",
      quantity: getNumber(source.quantity || source.requestedQuantity),
      ...getLustreAttribution(),
      ...extraParams,
    };

    if (hireFee) params.hire_fee = hireFee;
    if (bondAmount) params.bond_amount = bondAmount;
    if (totalDue) params.total_due = totalDue;
    if (source.bookingId || source.booking_id) params.booking_id = source.bookingId || source.booking_id;
    if (source.stripeSessionId || source.stripe_session_id) params.stripe_session_id = source.stripeSessionId || source.stripe_session_id;
    if (source.mode || source.bookingMode || source.booking_mode) params.booking_mode = source.mode || source.bookingMode || source.booking_mode;

    return params;
  }

  function trackLustreStandardMetaEvent(eventName, totalDue) {
    try {
      const value = getNumber(totalDue);
      if (!window.fbq || !value) return;

      window.fbq("track", eventName, {
        value,
        currency: "AUD",
      });
    } catch (error) {
      console.warn("Meta tracking event failed:", eventName, error);
    }
  }

  window.captureLustreAttribution = captureLustreAttribution;
  window.getLustreAttribution = getLustreAttribution;
  window.trackLustreEvent = trackLustreEvent;
  window.buildLustreBookingTrackingParams = buildLustreBookingTrackingParams;
  window.trackLustreStandardMetaEvent = trackLustreStandardMetaEvent;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", captureLustreAttribution);
  } else {
    captureLustreAttribution();
  }
})();
