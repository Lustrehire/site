"""Build the public gallery from gallery-photos/, using macOS's built-in sips."""
import argparse
import html
import json
from pathlib import Path
import re
import shutil
import subprocess
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
START, END = '<!-- GALLERY_IMAGES_START -->', '<!-- GALLERY_IMAGES_END -->'
HOME_START, HOME_END = '<!-- HOME_GALLERY_IMAGES_START -->', '<!-- HOME_GALLERY_IMAGES_END -->'

def natural_key(path):
    return [int(part) if part.isdigit() else part.casefold() for part in re.split(r'(\d+)', path.name)]

def dimensions(path):
    result = subprocess.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', str(path)], check=True, capture_output=True, text=True)
    values = [re.search(key + r':\s*(\d+)', result.stdout) for key in ['pixelWidth', 'pixelHeight']]
    if not all(values):
        raise ValueError(f'Cannot read image dimensions: {path.name}')
    return tuple(int(value.group(1)) for value in values)

def build(root=ROOT):
    source = root / 'gallery-photos'
    if not source.is_dir():
        raise ValueError('Missing gallery-photos folder. Add your gallery photos there first.')
    if not shutil.which('sips'):
        raise ValueError('Gallery updates use sips, which is built into macOS.')
    page = root / 'gallery.html'
    document = page.read_text()
    if START not in document or END not in document:
        raise ValueError('Missing gallery image markers in gallery.html; no files were changed.')
    homepage = root / 'index.html'
    home_document = homepage.read_text()
    if HOME_START not in home_document or HOME_END not in home_document:
        raise ValueError('Missing homepage gallery markers; no files were changed.')
    captions_file = source / 'captions.json'
    captions = json.loads(captions_file.read_text()) if captions_file.exists() else {}
    if not isinstance(captions, dict) or any(not isinstance(v, str) for v in captions.values()):
        raise ValueError('captions.json must contain image filenames and text descriptions.')
    photos = sorted((p for p in source.iterdir() if p.is_file() and not p.is_symlink() and not p.name.startswith('.') and p.suffix.lower() in EXTENSIONS), key=natural_key)
    items, used = [], set()
    for photo in photos:
        # Include the original extension in the generated name to avoid collisions.
        name = photo.name + '.jpg'
        outputs = []
        source_width, source_height = dimensions(photo)
        for directory, size in [('full', 1600), ('previews', 480)]:
            output = root / 'img/gallery-managed' / directory / name
            output.parent.mkdir(parents=True, exist_ok=True)
            if not output.exists() or output.stat().st_mtime_ns < max(photo.stat().st_mtime_ns, Path(__file__).stat().st_mtime_ns):
                resize = ['--resampleWidth', str(min(480, source_width))] if directory == 'previews' else ['-Z', str(min(size, max(source_width, source_height)))]
                subprocess.run(['sips', *resize, '-s', 'format', 'jpeg', '-s', 'formatOptions', '82' if directory == 'full' else '75', str(photo), '--out', str(output)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            used.add(output.resolve())
            outputs.append('/' + output.relative_to(root).as_posix())
        width, height = dimensions(root / outputs[0].lstrip('/'))
        preview_width, _ = dimensions(root / outputs[1].lstrip('/'))
        fallback = re.sub(r'^\d+[\s._-]*', '', photo.stem).replace('-', ' ').replace('_', ' ').strip()
        items.append({'src': quote(outputs[0], safe='/'), 'preview': quote(outputs[1], safe='/'), 'alt': captions.get(photo.name) or fallback or 'Candle styling inspiration', 'width': width, 'height': height, 'previewWidth': preview_width})
    markup = []
    for item in items:
        full = html.escape(item['src'], quote=True)
        preview = html.escape(item['preview'], quote=True)
        alt = html.escape(item['alt'], quote=True)
        markup.append(f'<a class="cro-gallery-item" href="{full}" data-gallery-image><img src="{preview}" srcset="{preview} {item["previewWidth"]}w, {full} {item["width"]}w" sizes="(max-width: 767px) calc((100vw - 60px) / 2), (max-width: 1200px) 30vw, 400px" alt="{alt}" width="{item["width"]}" height="{item["height"]}" loading="lazy" decoding="async"><span class="cro-image-open" aria-hidden="true">↗</span></a>')
    if not markup:
        markup.append('<p class="gallery-empty">Our gallery is being refreshed. You can still check availability or contact us about your event.</p>')
    document = document[:document.index(START)] + START + '\n' + '\n'.join(markup) + '\n' + document[document.index(END):]
    home_markup = []
    for item in list(reversed(items))[:6]:
        preview = html.escape(item['preview'], quote=True)
        full = html.escape(item['src'], quote=True)
        alt = html.escape(item['alt'], quote=True)
        home_markup.append(f'<a href="{full}" data-gallery-image aria-label="Open image: {alt}"><img src="{preview}" srcset="{preview} {item["previewWidth"]}w, {full} {item["width"]}w" sizes="(max-width: 767px) 90vw, (min-width: 1101px) 768px, 45vw" alt="{alt}" width="{item["width"]}" height="{item["height"]}" loading="lazy" decoding="async"></a>')
    if not home_markup:
        home_markup.append('<p class="gallery-empty">Our gallery is being refreshed. View the full gallery for updates.</p>')
    home_document = home_document[:home_document.index(HOME_START)] + HOME_START + '\n' + '\n'.join(home_markup) + '\n' + home_document[home_document.index(HOME_END):]
    manifest = root / 'content/gallery.json'
    manifest.parent.mkdir(exist_ok=True)
    # Keep the last published page intact if an image cannot be processed.
    page.write_text(document)
    homepage.write_text(home_document)
    manifest.write_text(json.dumps(items, indent=2) + '\n')
    # Only clean generated JPGs in our dedicated output directories; never site originals.
    for directory in ['full', 'previews']:
        folder = root / 'img/gallery-managed' / directory
        if folder.exists():
            for generated in folder.glob('*.jpg'):
                if not generated.is_symlink() and generated.resolve() not in used:
                    generated.unlink()
    print(f'Gallery updated: {len(items)} photos from gallery-photos/. Homepage preview updated with the last {min(6, len(items))} photos, bottom first.')
    return items

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    try:
        build()
    except (ValueError, subprocess.CalledProcessError, OSError, json.JSONDecodeError) as error:
        parser.exit(1, f'Gallery update failed: {error}\n')
