"""Check static page links, anchors and referenced local assets without network access."""
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse

ROOT = Path(__file__).resolve().parents[1]

class Document(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.targets, self.ids = [], set()
        self.content_depth, self.skip = 0, 0
        self.content = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        void = tag in ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']
        if self.content_depth and not void:
            self.content_depth += 1
        elif tag == 'main' or attrs.get('id') == 'main-content':
            self.content_depth = 1
        if tag in ['script', 'style']:
            self.skip += 1
        if attrs.get('id'):
            self.ids.add(attrs['id'])
        key = 'href' if tag == 'a' or (tag == 'link' and attrs.get('rel') in ['stylesheet', 'icon']) else 'src' if tag in ['img', 'script', 'source', 'iframe'] else None
        if key and attrs.get(key):
            self.targets.append(attrs[key])
        if tag in ['img', 'source'] and attrs.get('srcset'):
            self.targets.extend(part.strip().split()[0] for part in attrs['srcset'].split(','))

    def handle_endtag(self, tag):
        if self.content_depth:
            self.content_depth -= 1
        if tag in ['script', 'style']:
            self.skip = max(0, self.skip - 1)

    def handle_data(self, data):
        if self.content_depth and not self.skip:
            self.content.append(data)

files = sorted([*ROOT.glob('*.html'), *(ROOT / 'blog').glob('*.html')])
docs = {file: Document(file.read_text()) for file in files}
issues, checked = [], 0
for file, doc in docs.items():
    if not ''.join(doc.content).strip():
        issues.append({'page': file.relative_to(ROOT).as_posix(), 'reason': 'Empty main content'})
    for href in doc.targets:
        url = urlparse(urljoin('https://www.lustrehire.com/' + file.relative_to(ROOT).as_posix(), href))
        if url.hostname not in ['www.lustrehire.com', 'lustrehire.com'] or url.scheme not in ['http', 'https']:
            continue
        checked += 1
        path = ROOT / unquote(url.path).lstrip('/')
        candidates = [path] if path.suffix else [path, path / 'index.html', path.with_suffix('.html')]
        target = next((p for p in candidates if p.is_file()), None)
        reason = 'Missing file' if target is None else 'Empty file' if target.stat().st_size == 0 else None
        if not reason and url.fragment and target.suffix == '.html':
            document = docs.get(target) or Document(target.read_text())
            if unquote(url.fragment) not in document.ids:
                reason = 'Missing anchor'
        if reason:
            issues.append({'page': file.relative_to(ROOT).as_posix(), 'target': href, 'reason': reason})
report = {'pages': len(files), 'internal_targets_checked': checked, 'issues': issues}
print(json.dumps(report, indent=2))
raise SystemExit(bool(issues))
