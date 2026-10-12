# Public pages and tracking

When creating a public HTML page, use `templates/public-page.html.template` (or
retain its head setup when copying an existing public page). Replace
`{{PUBLIC_PAGE_PATH}}` with the exact static root-relative pathname and replace
`{{TITLE}}` with a public title. Keep the referrer policy and public-page metadata
before the single synchronous `/lustre-tracking.js` include. The declaration is
an explicit privacy review: only static public content belongs on these pages.
Do not add vendor snippets or new GTM tags for GA, Ads, Meta or Clarity.

Never opt booking, quote, payment, account, customer-specific or token-driven
pages into public tracking. Known private funnel pages retain their existing
sanitised GA tracking. For other private pages, use
`<meta name="lustre-private-page" content="true">` and omit the public marker;
shared tracking fails closed there. Review tracking separately before adding GA
on new private pages.

Keep Balanced masking. Mask input/textarea/select/contenteditable elements with
`data-clarity-mask="true"`; place personal output in pre-masked containers before
rendering it. Do not mask the body or public page containers, and do not add
`data-clarity-unmask`. Never put personal information in page titles or static
slugs. No raw search text or arbitrary URL/query/referrer data goes into events.

For a new public page, update the sitemap when appropriate, then run `npm test`.
Public-page tests discover root and blog HTML; extend their discovery when adding
another content directory. See `TRACKING_AUDIT.md` for eligibility, attribution,
provider-side consent/privacy requirements and manual verification. Do not deploy
unless explicitly requested.
