"""Render the same static, crawlable navigation on every existing HTML page."""
from pathlib import Path
from html.parser import HTMLParser
import re
ROOT = Path(__file__).resolve().parents[1]
template = (ROOT / 'templates/site-header.html.template').read_text().strip()

class Header(HTMLParser):
    def __init__(self, source):
        super().__init__(); self.source = source; self.offsets = [0]; self.depth = 0; self.start = self.end = None
        for line in source.splitlines(keepends=True): self.offsets.append(self.offsets[-1] + len(line))
        self.feed(source)
    def position(self):
        line, col = self.getpos(); return self.offsets[line - 1] + col
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'div':
            if self.depth: self.depth += 1
            elif self.start is None and 'header-container' in attrs.get('class', '').split(): self.start = self.position(); self.depth = 1
    def handle_endtag(self, tag):
        if tag == 'div' and self.depth:
            self.depth -= 1
            if not self.depth: self.end = self.position() + len('</div>')

for page in sorted([*ROOT.glob('*.html'), *(ROOT / 'blog').glob('*.html')]):
    source = page.read_text(); header = Header(source)
    if header.start is None or header.end is None: raise RuntimeError(f'Missing header: {page}')
    old = source[header.start:header.end]
    nav_id = re.search(r'aria-controls="([^"]+)"', old).group(1)
    home = page.name == 'index.html'; prefix = '' if home else '/'
    items = [('Home', '/', ''), ('Gallery', '/gallery.html', ''), ('Pricing', prefix + '#pricing', ''), ('How It Works', prefix + '#how-it-works', ''), ('FAQs', '/faq.html', ''), ('Blog', '/blog/blog.html', ''), ('Contact', prefix + '#contact', ''), ('Check Date &amp; Get Quote', prefix + '#availability', 'nav-booking-link')]
    active = 'Home' if home else 'Blog' if page.parent.name == 'blog' else 'Gallery' if page.name == 'gallery.html' else 'FAQs' if page.name == 'faq.html' else None
    links = '\n'.join(f'        <a href="{href}"' + (f' class="{css}"' if css else '') + (' aria-current="page"' if label == active else '') + f'>{label}</a>' for label, href, css in items)
    markup = template.replace('{{NAV_ID}}', nav_id).replace('{{LINKS}}', links)
    source = source[:header.start] + markup + source[header.end:]
    source = re.sub(r'\s*<link rel="stylesheet" href="/mobile-navigation.css"[^>]*>', '', source)
    for asset, markup in [('shared-header.css', '<link rel="stylesheet" href="/shared-header.css">'), ('public-nav.js', '<script src="/public-nav.js" defer></script>')]:
        if f'/{asset}' not in source: source = source.replace('</head>', '  ' + markup + '\n</head>')
    source = source.replace('</head>', '  <link rel="stylesheet" href="/mobile-navigation.css" media="(max-width: 1100px)">\n</head>')
    page.write_text(source)
