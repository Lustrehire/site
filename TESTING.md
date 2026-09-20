# Checking Lustre Hire before publishing

These tests open the local website in Chromium and act like a customer. Each test runs at desktop size and a Pixel 7 mobile size. Mobile is browser emulation, not a real phone.

## Install once

Install the current LTS version of Node.js from [nodejs.org](https://nodejs.org/), then reopen your terminal. Open a terminal in this website's folder and run:

```sh
npm install
npx playwright install chromium
```

You do not need Apps Script credentials, Stripe keys, card details, or a separate web server. Playwright starts and stops a local server automatically.

## Before publishing changes

Run this in the website folder:

```sh
npm test
```

- **Passed** means that the behaviour checked by that test worked.
- **Failed** means that the expected behaviour did not happen, or an unexpected browser error occurred. It can indicate a website bug or a test setup problem.

Do not push or publish the change until any failure is understood. Copy the failing test name and error to Codex, or open the report:

```sh
npm run test:report
```

Click a failed test to see its error, screenshot, and trace. The trace records the browser's actions. Close the report server with Control+C. Reports contain synthetic customer details only and are ignored by Git.

To watch the tests in visible browser windows:

```sh
npm run test:headed
```

For a shorter check of the main booking/payment flows:

```sh
npm run test:critical
```

Run the full `npm test` before publishing; the shorter check does not include every validation case.

## Minimum-order regression

The initial suite found a missing 15-candle guard. The homepage now blocks quantities below 15 before checking availability, handles the backend’s `below_minimum` response, and checks the minimum again before displaying quote or booking actions. The original minimum-order tests remain unchanged.

## Why repeated runs are safe

The suite serves only your local files at `http://127.0.0.1:4173`. It intercepts browser requests before they reach external services. Apps Script replies are synthetic fixtures; checkout redirects land on an intercepted `checkout.example.test` page. No requests are forwarded to Apps Script, Stripe, Google Sheets, or email services. Unknown external requests are blocked and fail the test. Third-party fonts, images, and analytics receive harmless local responses.

Always import `test` from `tests/fixtures.js` when adding tests: that fixture installs the network isolation and browser error checks. Do not use live customer data, add secrets, or bypass interception. Service workers are disabled. The server is read-only and bound to your own computer.

## What is covered

- Homepage and available, unavailable, partial, and minimum-order states.
- Quote request payload and success screen.
- Current and revalidated quotes, stored prices, paid/missing/unavailable/manual-confirmation states.
- Required booking fields, review details and totals, Terms & Conditions gating.
- Direct and quote checkout request payloads, fake redirect, failed checkout and retry with retained details.
- Unexpected JavaScript runtime and console errors on every test. Only the exact intentional checkout failure error is allowed in its failure test.
- All tests run in desktop and mobile Chromium. Quote/booking checks also check for horizontal overflow.

The fixtures use a fixed browser date of 1 June 2030 and synthetic event dates later that month, so tests do not become stale as time passes. Adjust response data in `tests/fixtures.js` if the documented backend response format changes. Stable existing IDs and accessible button names identify controls; tests do not depend on screenshots matching pixel for pixel.

## What still needs manual integration testing

Mocked tests cannot prove real inventory calculations, stored quote prices, seven-day backend revalidation, Sheet writes, email delivery, Stripe configuration, webhooks, payment completion, refunds, or success/cancel reconciliation. Test those separately in an explicitly configured staging environment using Stripe test mode. This suite does not supply or configure staging and must not be pointed at production to test writes.

Also manually check real mobile Safari/phones, fonts/images and visual appearance; external assets are replaced in the automated runs. Passing tests are useful protection, not proof of the whole live system.

## Future Codex workflow

Whenever Codex changes availability, quoting, booking, Stripe checkout, or payment success/cancel flows, Codex should run the regression suite before completing the task and report:

- Tests run.
- Tests passed.
- Tests failed.
- Any tests not run and why.

Do not skip or mark a genuine product failure as expected just to get a green run. Keep fixes to tests separate from changes to production behaviour.

Setup follows Playwright's [local web server](https://playwright.dev/docs/test-webserver), [network interception](https://playwright.dev/docs/network), and [browser projects](https://playwright.dev/docs/test-projects) guidance.
