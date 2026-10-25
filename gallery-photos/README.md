# Your gallery photos

This folder is the only place you need to manage the photos on the **full Gallery page and homepage gallery preview**.

## Add or remove photos

1. Drop JPG, JPEG, PNG or WebP photos into this folder.
2. Remove photos from this folder when you no longer want them in the gallery.
3. Double-click **Update Gallery.command** in this folder. A Terminal window confirms the update.

If you prefer the project terminal, run `npm run gallery:update` or `python3 scripts/update-gallery.py`.

Refresh your local preview to see the result. Updating the gallery does **not** publish the website; the usual review and deployment steps still apply.

## Change the order

Photos appear in filename order. The homepage gallery preview uses the last six photos, starting from the bottom of the gallery. The first three preview photos are shown immediately on mobile. Use numbered names such as `01-wedding-table.jpg`, `02-bridal-shower.jpg` and `03-birthday.png` to choose the order. Numbers are sorted naturally (2 comes before 10).

## Optional descriptions

The site uses the filename as accessible image alt text, without the number or extension. For a more descriptive version, add the filename and its description to `captions.json`. Existing descriptions are already included. Descriptions do not appear in the image modal.

## What the update does

It creates smaller preview images, web-ready full-size images, and the gallery page automatically. You do not need to edit HTML or JSON to add or remove a photo. Only edit captions.json if you want custom alt text.

Only the image files currently in this folder are included in the gallery. The homepage gallery preview now follows this folder too. The hero, occasion cards and blog images stay separate and are not changed or deleted. To include a photo used elsewhere on the site in the gallery too, copy it into this folder and run the update.

Do not edit `content/gallery.json` or `img/gallery-managed/` directly; they are generated. Gallery updates use macOS's built-in image tools and require no extra packages. Keep original-resolution photos here; the update creates suitably sized website copies.
