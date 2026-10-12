# Lustre Hire tracking audit — proof of concept

## Current implementation

Tracking now starts normally without a consent manager, campaign vocabulary, banner, regional detection, new dependency or infrastructure. The helper no longer reads `window.LustreTrackingConsent`, exposes `setLustreTrackingConsent`, or sends any Google/Meta/Clarity consent commands. Initialisation is not a claim that the visitor has consented. This replaces the previous consent-dependent implementation and its deployment instructions.

Preserved IDs:

- GA4: `G-1RPLQ8LZ48`
- Google Ads: `AW-18047450478`
- Meta Pixel: `1271538364415253`
- GTM: `GTM-MTQH9ZRG`

GA4 runs across all 21 explicitly declared public pages and the existing book, quote, payment-success and payment-cancelled funnel pages. The helper loads gtag.js once, configures GA with send_page_view:false and sends one explicit page_view. It sends one GA command per business event, explicitly targeted at this GA property; it does not also push a duplicate GTM business-event object. Re-running the helper cannot duplicate initialisation. GTM must not install a second GA implementation.

Google Ads, Meta and GTM run on explicitly eligible public page visits, including Facebook, Instagram, Google advertising and referred traffic. Private booking, quote and payment pages do not load Meta/GTM or Clarity. Their real URLs and backend request inputs remain intact; GA receives sanitised page_location/page_referrer and allowlisted event fields.

## URLs, attribution and privacy controls

Each explicitly public page URL is cleaned synchronously before vendors load. Only known UTM/click parameter keys with validated values survive. Unknown keys, repeated query parameters, unsafe fragments, private tokens and malformed advertising IDs are dropped. Existing availability scroll navigation and section links still work.

Recognised click parameters: gclid, dclid, gbraid, wbraid, fbclid and msclkid. Source and medium use recognised advertising-channel values. Campaign name/id/content/term use a maximum of 100 characters, starting with an alphanumeric character and allowing letters, digits, spaces, underscores and hyphens. No manually approved vocabulary is required. Email/URL syntax, long phone-like digit sequences, address-like strings and private identifier prefixes are rejected.

Known sensitive values from URL parameters and existing pending/confirmed booking storage are compared locally against campaign values, ignoring punctuation and case. Matching names, contact details, quote tokens, booking IDs and Stripe session IDs are rejected, not sent as campaign labels. Neither these comparison values nor browser-only deduplication keys are sent to providers. Custom event parameters are allowlisted; customer data, arbitrary backend errors and full URLs cannot override them.

**Validation limits:** syntax cannot prove that an otherwise ordinary label is not an unknown person's name, or authenticate an opaque click ID's issuer. Do not put personal data into campaign fields. This code rejects recognisable and locally known personal data; it does not claim to identify every possible personal value. Provider-side automatic collection also requires the settings review below.

Referrers in GA payloads contain only the origin. Normal origin-only referrals are accepted. A public landing with a path/query-bearing document.referrer takes one same-URL navigation under the existing no-referrer policy before loading vendors, because pixels can otherwise read the original referrer independently. The first document emits no page view. Only the sanitised origin survives this hop in short-lived session state. If storage is blocked, attribution may be lost rather than exposing the original referrer.

Validated attribution persists in sessionStorage across the booking journey, with a 30-minute inactivity expiry across page loads. A new campaign replaces the old campaign/click fields as a unit. Internal steps preserve attribution; unrelated new referrals do not inherit an old campaign. GA receives explicit campaign fields, while advertising providers can read legitimate click IDs on their public landing URL. No cross-device or indefinite cross-session attribution guarantee is made.

## Corrected events preserved

| Event | Trigger and protection |
| --- | --- |
| availability_check | Valid availability submission after date/quantity validation |
| availability_result | HTTP-successful, parsed availability response with valid boolean flags or recognised notice/minimum outcome; success may be absent. Unknown statuses, explicit failures and error payloads are excluded. |
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

The site owner has installed Clarity through GTM and confirmed recordings. This masking correction does not add a second installation or change/publish the GTM container.

The body-wide mask has been removed. Public headings, navigation, descriptions and buttons now use the dashboard's Balanced masking policy. No data-clarity-unmask attributes are introduced, so Clarity's automatic input masking remains intact.

Explicit `data-clarity-mask="true"` attributes are present in the initial homepage HTML on input, textarea and select controls, plus these sensitive dynamic containers: availability-feedback, availability-result, availability-booking-summary, availability-booking-feedback, availability-review-feedback, availability-step-4-panel and contact-modal-status. This protects names, emails, phone numbers, addresses, notes, other free text, customer-specific review/confirmation details and backend feedback. Labels and submit buttons outside these containers remain public.

Masks exist before GTM loads. Replacing a summary's innerHTML preserves the mask on its enclosing container, so its newly rendered personal content is protected without a delayed MutationObserver. Future personal-data renderers must likewise insert content into a pre-masked container. Do not add unmask overrides or transmit customer values through custom identify calls.

Configure one Clarity tag for the real project, firing once per page on `lustre_tracking_ready` when `lustre_clarity_eligible === true`. This flag means the page is eligible for recording under the site's technical privacy rules; **it is not a consent signal**. Keep private book/quote/payment pages excluded. Do not add a second direct installation or an unrestricted All Pages trigger. Keep Balanced masking for ordinary public content, retain the explicit sensitive-element masks, and inspect new recordings/network data after deploying the correction. See [Microsoft's masking documentation](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-masking).

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

Full `npm test`: **242 passed** across desktop Chromium and mobile Chromium (2.3 minutes). `git diff --check` passed. All Apps Script, checkout and provider traffic is mocked or blocked; no real Stripe payments or analytics hits are made. Tests check initialisation, attribution, sanitisation, private-page exclusion, duplicate prevention and existing booking regressions. Live reporting/provider settings still need manual verification.


## Availability-result production response fix

Cause: the event hook required `result.success === true`, but the real Apps Script checkAvailability response does not necessarily include that field. The UI correctly used available, partialAvailable and status, while analytics silently skipped the result. Earlier generic fixtures included success:true and did not expose this mismatch.

The event hook now validates the availability response separately from the unchanged booking/UI handler. It runs only after successful HTTP handling and JSON parsing, rejects arrays, explicit success:false, error fields, unknown statuses and invalid flag types for stock outcomes, and accepts the real response without a success field. Valid available/partialAvailable boolean flags determine available, partial or unavailable; notice_period and below_minimum take precedence. Legacy partial_available/limited responses are normalised to partial. If status is absent, valid boolean flags are sufficient. Only quantity and the allowlisted availability status are supplied to the existing sanitising helper; backend messages, private URLs and identifiers are not forwarded.

This fix changes index.html, the status allowlist in lustre-tracking.js, new tests/availability-tracking.spec.js and this audit. No Apps Script, Stripe, pricing, booking requests or UI behaviour changes. The new tests mirror Apps Script responses without success:true and cover all availability outcomes, payload privacy, single-event delivery, malformed responses and transport failures. Full suite: **230 passed** on desktop and mobile Chromium, including 36 new availability-tracking regression cases. `git diff --check` passed. No deployment was performed.


## Selective Clarity masking correction

Cause: the explicit body mask overrode the Balanced dashboard policy and masked every descendant's text. The helper no longer applies that blanket attribute; index.html instead marks only form controls and sensitive dynamic containers. No provider IDs, event hooks, consent behaviour, private-page exclusions, booking logic, layout, pricing or backend integrations changed.

Changed in this correction: index.html, lustre-tracking.js, tests/campaign-tracking.spec.js (replaced its old body-mask expectation), new tests/clarity-masking.spec.js, and this audit. Tests inspect masks at mocked GTM execution, verify public content has no masked ancestor, exercise actual repeated summary rendering and check all private routes remain excluded from GTM/Clarity while retaining GA.

Masking changes affect new recordings, not existing recordings. Balanced can still automatically mask things such as numbers or email addresses; removing the blanket attribute does not force all text to be public. See [Microsoft's masking documentation](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-masking). No deployment or GTM publication was performed. Full suite: **242 passed** across desktop/mobile Chromium, including 12 new masking checks. `git diff --check` passed. Provider scripts and payment requests were mocked, so live recording appearance still needs verification after deployment.

## FAQ search analytics

Homepage FAQ filtering remains immediate and unchanged. After 700 ms without input, `faq_search` sends only a locally classified `faq_topic` (`pricing`, `pickup`, `returns`, `bond`, `burn_time`, `safety`, `availability`, or `other`) plus the helper's existing sanitised page/campaign context to GA4. No raw search text is passed to the helper, stored, added to URLs or sent to Meta. The helper independently allowlists topic values. Unknown searches, including personal text without topic keywords, become `other`.

Consecutive searches in the same topic are deduplicated until the input is cleared or another topic is searched. Empty searches and filter-button clicks emit nothing; input composition waits until completion. This measures topic interest rather than every distinct phrase. The FAQ input retains `data-clarity-mask="true"`; no Clarity unmasking or vendor configuration changes were added.

For reporting by topic, register `faq_topic` as an event-scoped GA4 custom dimension if it is not already registered. No additional GTM tag or GA installation is needed. Existing dashboard privacy requirements above still apply, including avoiding automatic raw search-term collection. Tests cover all eight categories, debounce timing, deduplication, clear/composition behaviour, unchanged filtering, masking and rejection of unsafe parameters. No deployment performed.

FAQ validation: full `npm test` **264 passed** across desktop and mobile Chromium, including 22 new FAQ checks. `git diff --check` passed. Backend/payment/provider traffic was mocked; no real payments or analytics hits were generated.


## Public-page expansion

### Audit and coverage

Previously only the homepage and four private funnel pages loaded the helper. The other 20 public HTML pages had no analytics implementation to duplicate. All existing public pages now declare their exact static path and load the same helper. These are the full public inventory (also listed in the sitemap):

- `/index.html` (also `/`)
- `/terms-and-conditions.html`
- `/how-to-return.html`
- `/blog/Candle-budget-breakdown.html`
- `/blog/blog.html`
- `/blog/burn-time-calculator.html`
- `/blog/coastal-boho-colour-playbook.html`
- `/blog/diy-vs-full-service.html`
- `/blog/diy-wedding-candles-whats-actually-worth-doing-yourself.html`
- `/blog/diy-wedding-decor-regrets-what-to-outsource-vs-do-yourself.html`
- `/blog/do-wedding-candles-fit-in-a-normal-car.html`
- `/blog/how-many-candles-do-i-need-for-a-wedding.html`
- `/blog/how-to-get-candle-approval-from-your-wedding-venue-in-perth.html`
- `/blog/how-to-pack-transport-and-return-wedding-candles-without-mess.html`
- `/blog/sand-wax-candles-vs-pillar-candles-for-weddings.html`
- `/blog/spring-trend-2025.html`
- `/blog/tablescape-checklist.html`
- `/blog/venue-safety-approval.html`
- `/blog/wedding-candle-hire-perth-prices.html`
- `/blog/wedding-candle-styling-ideas-for-long-tables.html`
- `/blog/what-to-ask-your-venue-before-using-candles.html`

The burn-time calculator is an editorial guide/table, not a personal-data calculator. The blog, return guide and terms pages have no inputs, storage-driven customer content, backend requests or personal-data renderers. Homepage inputs and customer summaries retain their existing selective masks. Public text remains visible under Balanced masking; nothing broadly unmasks forms or dynamic output.

`book.html`, `quote.html`, `payment-success.html` and `payment-cancelled.html` retain sanitised GA only, even if a public marker is accidentally added. Unmarked URLs and other explicitly private pages initialise no providers. Separately maintained DEV/Apps Script files are not public content and were not changed.

Audit limitation: `blog/tablescape-checklist.html` already referenced missing `/script.js` (404). This unrelated reference was left unchanged. The tracking test explicitly checks for that one known missing resource rather than hiding all browser errors. Its shared analytics helper still initialises correctly.

### Reusable implementation and new pages

Copy `templates/public-page.html.template`, replace `{{PUBLIC_PAGE_PATH}}` with the exact static root-relative path (e.g. `/blog/new-article.html`), and replace `{{TITLE}}`. Keep the no-referrer meta policy and the public-page declaration before the single synchronous `/lustre-tracking.js` include. Populate the public content and add the page to the sitemap where appropriate. No per-page GA/GTM/Clarity dashboard work is required. `AGENTS.md` instructs future Codex work to follow this convention.

Eligibility requires an authored `meta[name="lustre-public-page"]` whose value exactly matches the current pathname (`/index.html` also accepts `/`). It is not inferred from `/blog/`, the mere presence of the helper, or any query parameter. A copy served under the wrong URL or with unfilled placeholders stays excluded. Slugs must be static public names; never put a customer name/token/ID into the marker, title or URL. Any page rendering customer, account, quote, booking or payment information must omit the public marker and may use `<meta name="lustre-private-page" content="true">` as an overriding exclusion. New private pages need separate review before enabling any GA tracking.

For any future inputs, retain automatic masking and explicitly mark inputs/textarea/select/contenteditable elements with `data-clarity-mask="true"`. Render personal output only inside an already-masked container. Do not use page-wide masking or `data-clarity-unmask`. The tests discover root and blog HTML; extend discovery for a new content directory. The template is exercised at a hypothetical `/guides/` URL without creating a published page.

### Navigation, attribution and reporting

Each document sends one GA page view using its real static path; public articles no longer fall back to `/`. Re-including the helper does not duplicate provider startup, readiness events or page views. The same GTM container and `lustre_tracking_ready` / `lustre_clarity_eligible` contract reuse the existing Clarity tag. There is no new Clarity installation or GA/Ads/Meta tag in GTM. Existing provider IDs and funnel event triggers remain unchanged; purchase remains disabled.

The optional `previous_page_path` parameter describes the previous tracked document in the same tab within 30 minutes. It contains only a stored static page path, never a raw referrer/query/fragment. It accompanies page views and existing funnel events, so an availability check on the homepage can retain the preceding article path. Browser session storage is optional: without it, this context and cross-page campaign persistence may be unavailable, while page views still work. Reloads can have the same previous/current path. Untracked pages, new tabs and external entries limit reconstruction; this is not a precise click log or guaranteed attribution model. Existing validated campaign attribution persists across public and private funnel steps.

Use GA's page paths and event sequences to analyse journeys and the last observed pages of sessions. No unreliable unload/exit event is introduced; closed tabs, blockers and consent restrictions can create gaps. Optionally register `previous_page_path` as an event-scoped custom dimension for event-level reporting. Keep the existing Clarity tag firing once on `lustre_tracking_ready` with `lustre_clarity_eligible === true`; if it has an additional homepage-only URL condition, broaden that condition to the eligibility contract. Retain all consent checks. Do not add unrestricted All Pages recording or duplicate vendor tags.

### Consent and verification limits

This expansion does not fabricate grants, reset Google/Clarity consent queues, or replace an existing Meta queue (including a queued revoke). Existing GTM/provider consent restrictions remain in charge. Eligibility is a content/privacy classification, never evidence of consent. There is still no repository consent manager or regional enforcement layer; the separate privacy and international-consent considerations above remain applicable. Mocked tests verify signal preservation, not the behaviour of real provider scripts under regional rules. No remote GA, GTM or Clarity settings have been changed or verified; check actual payloads/recordings and consent behaviour after an authorised deployment.

Changed for this expansion: the 21 public HTML files above (head metadata/helper only), `lustre-tracking.js`, `templates/public-page.html.template`, `AGENTS.md`, `tests/public-page-tracking.spec.js` and this audit. The preceding FAQ changes remain intact. No booking/payment page source, CSS, Apps Script, Stripe request or pricing code was modified. Not deployed.

Public-page validation: full `npm test` **328 passed** across desktop and mobile Chromium, including 64 new public-page checks and the preceding FAQ tests. `git diff --check` passed. Provider and backend/payment traffic was mocked or blocked; no real payments or analytics hits were generated. The single known pre-existing tablescape `/script.js` 404 is explicitly accounted for as described above.
