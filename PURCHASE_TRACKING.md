# Verified GA4 deposit purchases

Frontend changes only. Nothing has been deployed. Do not release these frontend files until the updated Apps Script deployment has been tested.

## Contract and behaviour

`payment-success.html` retains the existing direct `saveConfirmedBooking` and quote `markQuoteAsConfirmed` payloads. Both must return literal `success: true` and `paymentVerified: true` before a new paid confirmation is displayed. A missing/invalid analytics receipt does not undo an otherwise verified confirmation. Old backend responses without `paymentVerified` now enter the existing contact/recovery flow, retaining pending details.

`lustre-tracking.js` exposes `trackLustrePurchase(result, expectedSessionId)`. It accepts only verified responses with a Checkout Session ID matching `cs_live_` or `cs_test_` followed by 1–240 alphanumeric characters; a finite positive numeric value; AUD; and exactly one `lustre_hire_deposit` / `Candle hire booking deposit` item with quantity 1 and numeric price exactly equal to value. The session must match the success-page session when supplied. Optional booking_mode is allowed only as direct/quote. Additional response/item fields are discarded. Changes to item ID, name, quantity, currency, amount type or receipt shape require a deliberate frontend contract update.

The purchase goes through the existing gtag installation to G-1RPLQ8LZ48 with sanitised page context. There is no generic purchase event hook, GTM event object, additional installation or Meta Purchase. Private page exclusions, attribution and existing consent/opt-out behaviour remain unchanged. Repository code contains no Meta Purchase implementation; remote GTM/Meta configuration has not been inspected.

Cached booking details are display data only. The page labels them as a previously saved confirmation and requests `getVerifiedPurchaseReceipt` with only a valid session ID from the URL or matching saved record. It does not resend a booking-save request. Failed lookup leaves that confirmation untouched. With no pending details, a valid session can still recover analytics via read-only lookup while retaining the manual recovery message.

The transaction ID is used as a persistent localStorage guard, backed by sessionStorage and memory, and is passed to GA4 for its transaction deduplication. The guard is written before queueing. It records an attempt, not delivery. Cleared/blocked storage, simultaneous tabs, different browsers and provider blocking mean exactly-once delivery cannot be guaranteed; an interrupted attempt may be lost. No personal booking data or full success URL is included in purchase payloads. Transaction IDs remain in local guard keys and are not logged.

Google references: [purchase event setup](https://developers.google.com/analytics/devguides/collection/ga4/set-up-ecommerce), [transaction deduplication](https://support.google.com/analytics/answer/12313109?hl=en).

## Release and verification order

1. Deploy and test the updated Apps Script separately first. Confirm the existing `/exec` URL used by payment-success.html serves that deployment; if a new deployment URL is required, update the frontend URL before release. No Apps Script changes are included here.
2. In Stripe test mode / a staging environment, verify both direct and quote confirmation responses against the contract above. Verify the read-only lookup returns the same verified transaction and amount with `alreadyConfirmed: true`. Test payment failures. Do not test by creating live charges or sending real customer emails.
3. Run `npm test` with Playwright Chromium installed. Tests mock all backend and provider requests; they do not create real bookings, charges or emails.
4. After backend verification, release the frontend using the site's normal deployment process, explicitly including payment-success.html and lustre-tracking.js. This task does not authorise deployment.
5. In staging with Google Tag Assistant / GA4 DebugView, finish one direct and one quote test checkout. Check exactly one purchase per transaction, currency AUD, value equal to the verified deposit (not full hire or bond), fixed item fields and the intended booking mode. Confirm only the existing GA loader and destination are used. Never copy customer data into debug notes.
6. Refresh and revisit each success page: only read-only receipt lookup should run; no additional save/email action or purchase should appear. Test a cached confirmation with a failed lookup: summary stays visible, no purchase. Test an unverified save: recovery flow, no paid confirmation. Check external consent/opt-out settings remain effective and no Clarity, Meta or GTM script loads on payment-success.
7. Check GA4 Monetisation reports after processing. Optionally register booking_mode as an event-scoped custom dimension. Keep existing GTM tags unchanged; inspect remote configuration for any independently configured purchase conversions before release to avoid double reporting. Do not add a new purchase tag.

## Automated validation

Final run: `npm test -- --workers=4` — **450 passed** across desktop Chromium and mobile Chromium (2.8 minutes). New tests cover verified direct/quote purchases, actual deposit value and AUD/session/item fields, invalid and missing receipts, unverified/nonboolean responses, duplicate callbacks and refresh/revisit guards, cached receipt recovery, failed/network-aborted lookups, absent browser booking details, blocked storage, analytics exceptions and payload privacy. Existing booking, attribution, funnel events and private-page recording exclusions also pass. `git diff --check` passes. External providers are mocked; real GA receipt, remote GTM configuration and backend Stripe verification require the staging checks above.
