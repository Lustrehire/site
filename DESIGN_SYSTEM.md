# Lustre public-page design system

The homepage, Gallery and FAQ pages share a small CSS design system. It uses the browser's Grid/Flexbox layout engines and CSS custom properties; no new framework, dependency or build command is required.

## Source of truth

`cro.css` defines tokens first, component defaults once, then grouped responsive rules. `cro-base.css` imports the unchanged `style.css` into the `legacy` cascade layer on these three pages. Normal legacy declarations therefore cannot out-rank the new component rules simply because they contain IDs. Existing important safety/visibility declarations still follow normal CSS importance rules. Other published pages retain their existing base stylesheet.

Change the shared token or component when adjusting a visual role. Avoid adding a final section-specific override to compensate for another rule.

| Role | Token / rule |
| --- | --- |
| Desktop hero | Full available width with equal page gutters; one-column overlay; landscape picture source above 768px |
| Main content width | `--cro-page-width`: 72rem maximum |
| Prose measure | `--cro-copy-width`: 44rem maximum |
| Page gutter | `--cro-gutter`: fluid 20–48px at the default root size |
| Section separation | `--cro-section-space`: fluid 40–64px |
| Spacing scale | 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64px tokens |
| Main body | `--cro-type-body`: 1rem (normally 16px) |
| Compact copy / labels | `--cro-type-small`: .875rem (normally 14px) |
| Captions / secondary metadata | `--cro-type-caption`: .75rem (normally 12px) |
| Section heading | `--cro-type-heading`: fluid 30–36px |
| Main display heading | `--cro-type-display`: fluid 36–56px |
| Body leading | `--cro-leading-body`: 1.6 |
| Heading leading | `--cro-leading-heading`: 1.15 |
| Primary control minimum | `--cro-control-height`: 3rem; content can grow |
| Card / field radius | `--cro-radius-card` / `--cro-radius-field` |

These values are this site's design choices, not claimed WCAG-mandated font sizes. Rem units let browser text preferences influence the scale.

## Composition

- `.cro-section` owns the outer section rhythm and divider. Sections share the main content edge; do not add an independently centered narrower section wrapper.
- `.cro-section-heading` owns heading/prose grouping, a 12px internal gap and a 32px gap to its component. Its children have no independent margins.
- `.cro-availability-body` contains the existing live form and estimator. Grid places it beside the intro on wider screens and underneath on smaller screens; no JavaScript coordinates are used.
- Pricing, benefits, reviews and gallery use Grid/Flexbox gaps for alignment. The homepage gallery now uses equal image ratios and aligned rows rather than independently staggered heights.
- Body copy, compact card copy, labels and captions use their named roles consistently. Captions are secondary information; do not assign them to essential instructions or field values.
- The final CTA is intentionally centered. Normal section headings, body copy and secondary actions share the left alignment.
- Photography cropping and decorative icon geometry can be art-directed; they should not determine the section gutters or typography scale.

Keep existing booking/result IDs, state classes, tracking hooks and masks when changing presentation. Dynamic personal output must remain inside pre-masked containers.

## Validation

`npm test` includes all requested viewport widths, equal section-heading edges/type roles, functional booking/tracking regressions, and a 320px test with increased user text spacing. These checks protect the design contract; they do not replace visual review or establish full accessibility certification.

The safe design preview is `node scripts/preview-server.cjs` at http://127.0.0.1:4174/. Its form responses are simulated and external backend/provider traffic is blocked.

## Visual details

Homepage section labels and process steps use decorative inline SVG icons with a 24-unit viewBox, 1.5-unit strokes and rounded ends. Icons accompany visible labels and are hidden from assistive technology. Benefits retain the same outline style in soft square icon containers. No additional icon font or JavaScript library is needed.

Sage surfaces distinguish supporting cards; warm brass rules accent pricing and reviews. The closing quote panel uses deep forest green with ivory text and a light action button. Keep decorative details outside generated FAQ content and masked form outputs.

## Responsive homepage desktop extension

`desktop-home.css` is loaded from 768px upwards and styles `#main-content` and the footer; the existing hero and navigation retain their earlier design. Desktop shares the mobile content variants and sequence, with full gallery/review/benefit/contact visibility. At 1100px, pricing and quote share a two-column row; below it, the page uses stacked sections. Both layouts retain 4px-derived spacing tokens, native Grid/Flexbox alignment and a single instance of each functional form. Mobile disclosures are removed at the desktop breakpoint by moving the same nodes, preserving state and event handlers.

## Shared site header

All root and blog HTML pages use `templates/site-header.html.template`, rendered by `python3 scripts/generate-headers.py`. The output stays static and readable without JavaScript. Update the template or generator once instead of editing each page's navigation. `shared-header.css` owns the logo, header dimensions and desktop navigation; `mobile-navigation.css` owns the CSS hamburger and expanded mobile menu; `public-nav.js` is the sole menu controller. Keep page-specific booking, payment and tracking logic independent of these presentation files.

The header stays sticky, uses file-based Gallery/FAQ links, and highlights Home, Gallery, FAQ or Blog as appropriate. Homepage section links stay local; other pages link back to the corresponding homepage anchors. Existing mobile-nav IDs are preserved for compatibility.
