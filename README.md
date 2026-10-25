# site

## Manage the gallery

Keep the photos you want on the full Gallery page in [`gallery-photos/`](gallery-photos/README.md).
Add or remove photos there, then double-click **Update Gallery.command** in that folder and refresh your preview. Number filenames to set their order.

Terminal alternative: `npm run gallery:update` (or `python3 scripts/update-gallery.py`).
The update generates the gallery page and optimised website images; it also refreshes the homepage gallery preview. It does not deploy the site or change hero, occasion-card or blog photos. Custom accessibility descriptions are optional in `gallery-photos/captions.json`.
