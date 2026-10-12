# Lustre Hire tracking audit — proof of concept

## Current implementation

Tracking now starts normally without a consent manager, campaign vocabulary, banner, regional detection, new dependency or infrastructure. The helper no longer reads `window.LustreTrackingConsent`, exposes `setLustreTrackingConsent`, or sends any Google/Meta/Clarity consent commands. Initialisation is not a claim that the visitor has consented. This replaces the previous consent-dependent implementation and its deployment instructions.

Preserved IDs:

- GA4: `G-1RPLQ8LZ48`
- Google Ads: `AW-18047450478`
- Meta Pixel: `1271538364415253`
- GTM: `GTM-MTQH9ZRG`

GA4 runs across index, book, quote, payment-success and payment-cancelled. The helper loads gtag.js once, configures GA with send_page_view:false and sends one explicit page_view. It sends one GA command per business event, explicitly targeted at this GA property; it does not also push a duplicate GTM business-event object. Re-running the helper cannot duplicate initialisation. GTM must not install a second GA implementation.

Google Ads, Meta and GTM run on eligible public homepage visits, including Facebook, Instagram, Google advertising and referred traffic. Private booking, quote and payment pages do not load Meta/GTM or Clarity. Their real URLs and backend request inputs remain intact; GA receives sanitised page_location/page_referrer and allowlisted event fields.

## URLs, attribution and privacy controls

The public homepage URL is cleaned synchronously before vendors load. Only known UTM/click parameter keys with validated values survive. Unknown keys, repeated query parameters, unsafe fragments, private tokens and malformed advertising IDs are dropped. Existing availability scroll navigation and section links still work.

Recognised click parameters: gclid, dclid, gbraid, wbraid, fbclid and msclkid. Source and medium use recognised advertising-channel values. Campaign name/id/content/term use a maximum of 100 characters, starting with an alphanumeric character and allowing letters, digits, spaces, underscores and hyphens. No manually approved vocabulary is required. Email/URL syntax, long phone-like digit sequences, address-like strings and private identifier prefixes are rejected.

Known sensitive values from URL parameters and existing pending/confirmed booking storage are compared locally against campaign values, ignoring punctuation and case. Matching names, contact details, quote tokens, booking IDs and Stripe session IDs are rejected, not sent as campaign labels. Neither these comparison values nor browser-only deduplication keys are sent to providers. Custom event parameters are allowlisted; customer data, arbitrary backend errors and full URLs cannot override them.

**Validation limits:** syntax cannot prove that an otherwise ordinary label is not an unknown person's name, or authenticate an opaque click ID's issuer. Do not put personal data into campaign fields. This code rejects recognisable and locally known personal data; it does not claim to identify every possible personal value. Provider-side automatic collection also requires the settings review below.

Referrers in GA payloads contain only the origin. Normal origin-only referrals are accepted. A public landing with a path/query-bearing document.referrer takes one same-URL navigation under the existing no-referrer policy before loading vendors, because pixels can otherwise read the original referrer independently. The first document emits no page view. Only the sanitised origin survives this hop in short-lived session state. If storage is blocked, attribution may be lost rather than exposing the original referrer.

Validated attribution persists in sessionStorage across the booking journey, with a 30-minute inactivity expiry across page loads. A new campaign replaces the old campaign/click fields as a unit. Internal steps preserve attribution; unrelated new referrals do not inherit an old campaign. GA receives explicit campaign fields, while advertising providers can read legitimate click IDs on their public landing URL. No cross-device or indefinite cross-session attribution guarantee is made.

## Corrected events preserved

| Event | Trigger and protection |
| --- | --- |
| availability_check | Valid availability submission after date/quantity validation |
| availability_result | Successful backend response, including allowlisted availability status |
| quote_generated | Successful quote save with booking ID; once per ID per browser session |
| booking_started | Booking journey entry; deduplicated across steps/reloads |
| booking_details_completed | Validated required details and review reached; once per journey |
| begin_checkout | Successful checkout preparation returning valid HTTPS URL; once per URL per session |
| checkout_started | Legacy funnel alias at the same corrected trigger |
| checkout_error | Preparation failure or malformed URL, with a fixed non-sensitive error code |
| payment_cancelled | Cancellation page with an outstanding local checkout marker; consumed once |
| purchase / booking_confirmed / Meta Purchase | Not emitted; pending independent payment verification |

The original audit found quote_generated firing after availability, duplicate booking starts between pages, checkout events firing before preparation succeeded, full URLs/Stripe session IDs in tracking parameters and Meta Purchase firing after a generic booking-save response. These fixes remain in place.

Checkout is not a charge: checkout/cancellation events omit monetary value. Quote/booking totals remain estimates, not revenue. Full hire plus refundable bond is never reported as a completed payment. Cancellation is an observed browser return with an outstanding marker, not independently verified cancellation. Deduplication is browser-session scoped; it does not promise exactly-once delivery across devices. Confirmation refreshes cannot emit an unverified purchase.

## Clarity installation through GTM

Clarity is ready for a single GTM installation; no project ID was invented and no Clarity script or GTM tag was published.

Before GTM loads, the body receives `data-clarity-mask="true"`. This strictly masks body content, including contact forms, customer inputs and dynamically rendered booking summaries, without a visible UI change. Do not add unmask overrides or transmit customer values through custom identify calls.

Configure one Clarity tag for the real project, firing once per page on `lustre_tracking_ready` when `lustre_clarity_eligible === true`. This flag means the page is eligible for recording under the site's technical privacy rules; **it is not a consent signal**. Keep private book/quote/payment pages excluded. Do not add a second direct installation or an unrestricted All Pages trigger. Use strict masking and inspect actual recordings/network data before publishing. See [Microsoft's masking documentation](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-masking).

## Separate privacy and international-consent considerations

This proof of concept uses ordinary vendor initialisation without Consent Mode commands. It does not obtain consent, infer geography, override an external visitor opt-out, or certify privacy compliance. No banner, CMP or regional service is required by this implementation; no consent-granted state is fabricated to make it work.

Before wider/international use, the site owner needs to assess applicable consent requirements, vendor terms, privacy disclosures, retention and opt-out handling for the actual audience. If an applicable requirement needs consent, address that separately; automatic initialisation is not a substitute for it. Google's consent mode communicates consent choices rather than obtaining them: [Google consent mode overview](https://developers.google.com/tag-platform/security/concepts/consent-mode).

Clarity enforces consent signals for visits from the EEA, UK and Switzerland and may restrict functionality without them. Do not configure GTM to manufacture consent-granted signals. This is a separate rollout consideration, not a new code dependency: [Microsoft Clarity consent update](https://clarity.microsoft.com/blog/clarity-cookie-consent-update/).

## Provider settings and manual validation

- Keep GA installed directly; do not mirror GA configuration, page views or business events through GTM.
- Disable GA Enhanced Measurement automatic form, outbound-link, download, site-search and history-page-view collection that can collect URLs outside the helper. Disable user-provided-data collection and automatic enhanced conversions. The repository cannot verify these remote settings; sanitised custom event payloads alone cannot control every automatic provider event.
- Keep Meta automatic advanced matching and automatic events off; review Event Setup Tool rules. Meta autoConfig is disabled in the helper. Do not add GTM customer-data/form listeners or unrestricted recording tags.
- Remove paid-conversion rules based on success-page visits, quote_generated, booking_confirmed or checkout_started. Quotes can be labelled leads, never purchases. Do not mark both checkout aliases as separate conversions.
- Configure any needed event-scoped dimensions (booking_mode, availability_status, error_code). Verify live campaign attribution and one page view per load in GA Realtime/DebugView. Review actual GA/Ads/Meta/Clarity network payloads, including automatic and delayed events. Mocked tests cannot prove live dashboard receipt or remote configuration.

## Backend requirements outside this task

The production confirmation page submits browser-stored booking data and a Stripe session ID to saveConfirmedBooking / markQuoteAsConfirmed and accepts generic success. This does not establish independently verified payment. No purchase event is enabled, even if the existing UI calls the booking confirmed.

Before purchase tracking can be enabled, the backend must independently verify Stripe payment, associate it with the intended booking, require a paid state and supply an authoritative amount charged in AUD plus a stable non-sensitive transaction ID. Use actual deposit cents collected, excluding unpaid balance and refundable bond. Do not trust client hireFee, URL flags or generic success. Backend idempotency must handle retries, repeated webhooks and later payments. A future client/server event design should consistently deduplicate on that safe transaction ID; never use quote tokens or Stripe session IDs as analytics identifiers.

The separate DEV bridge has a TEST getPaymentStatus flow; that is not proof of the production response contract. No Apps Script, preview files, Stripe request logic or Google Sheet workflow was changed.

## Files changed for this simplification

- lustre-tracking.js: removed consent initialisation dependency/commands and campaign vocabulary; retained attribution, sanitisation, masking and event protections; added local known-personal-data comparisons.
- tests/fixtures.js: removed injected consent grants and campaign vocabulary. All tests now exercise ordinary startup without those globals.
- tests/campaign-tracking.spec.js: replaced obsolete consent-gating scenarios with unconditional-startup/no-fabricated-consent checks, repeat-load protection, ordinary campaign validation and known-personal-data rejection. Campaign/referral/journey coverage remains.
- TRACKING_AUDIT.md: current proof-of-concept behaviour, separate privacy considerations and manual provider/backend requirements.

Earlier root HTML/shared tracking changes belong to the preceding tracking work. This simplification changes no design, booking workflow, pricing, payment requests, backend code or visible UI. Pre-existing unrelated .DS_Store and .gitignore changes remain untouched. Nothing was deployed.

## Test result

Full `npm test`: **194 passed** across desktop Chromium and mobile Chromium (1.8 minutes). `git diff --check` passed. All Apps Script, checkout and provider traffic is mocked or blocked; no real Stripe payments or analytics hits are made. Tests check initialisation, attribution, sanitisation, private-page exclusion, duplicate prevention and existing booking regressions. Live reporting/provider settings still need manual verification.
