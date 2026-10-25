import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('gallery_builder', ROOT / 'scripts/update-gallery.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

class GalleryBuilderTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'gallery-photos').mkdir()
        (self.root / 'gallery.html').write_text('<h1>Gallery</h1><!-- GALLERY_IMAGES_START --><!-- GALLERY_IMAGES_END -->')
        (self.root / 'index.html').write_text('Hero stays unchanged<!-- HOME_GALLERY_IMAGES_START --><!-- HOME_GALLERY_IMAGES_END -->Footer stays unchanged')
        self.photo = next((ROOT / 'img/gallery-preview').glob('*.jpg'))

    def add_photo(self, name):
        target = self.root / 'gallery-photos' / name
        shutil.copyfile(self.photo, target)
        return target

    def test_folder_controls_selection_order_alt_text_and_generated_cleanup(self):
        self.add_photo('10-table.jpg')
        first = self.add_photo('2-shower & candles.jpg')
        (self.root / 'gallery-photos/captions.json').write_text(json.dumps({first.name: 'Candles & flowers <styled>'}))
        items = builder.build(self.root)
        self.assertIn('2-shower%20%26%20candles.jpg', items[0]['src'])
        self.assertEqual(items[0]['alt'], 'Candles & flowers <styled>')
        html = (self.root / 'gallery.html').read_text()
        self.assertIn('Candles &amp; flowers &lt;styled&gt;', html)
        self.assertEqual(html.count('data-gallery-image'), 2)
        removed = self.root / 'img/gallery-managed/full/2-shower & candles.jpg.jpg'
        self.assertTrue(removed.exists())
        first.unlink()
        self.add_photo('1-birthday.png')
        items = builder.build(self.root)
        self.assertIn('1-birthday.png', items[0]['src'])
        self.assertFalse(removed.exists())
        home = (self.root / 'index.html').read_text()
        self.assertTrue(home.startswith('Hero stays unchanged'))
        self.assertTrue(home.endswith('Footer stays unchanged'))
        self.assertIn(items[0]['preview'], home)
        self.assertLess(home.index(items[-1]['preview']), home.index(items[0]['preview']))
        self.assertNotIn('2-shower%20%26%20candles.jpg', home)
        for photo in (self.root / 'gallery-photos').glob('*'):
            if photo.suffix != '.json': photo.unlink()
        self.assertEqual(builder.build(self.root), [])
        self.assertIn('gallery is being refreshed', (self.root / 'gallery.html').read_text())

    def test_invalid_photo_keeps_last_gallery_document_and_manifest(self):
        self.add_photo('1-good.jpg')
        builder.build(self.root)
        previous = (self.root / 'gallery.html').read_bytes()
        manifest = (self.root / 'content/gallery.json').read_bytes()
        (self.root / 'gallery-photos/2-invalid.jpg').write_text('not an image')
        with self.assertRaises((subprocess.CalledProcessError, ValueError)):
            builder.build(self.root)
        self.assertEqual(previous, (self.root / 'gallery.html').read_bytes())
        self.assertEqual(manifest, (self.root / 'content/gallery.json').read_bytes())

if __name__ == '__main__': unittest.main()
