"""Fetch public source pages into a local, ignored research cache (stdlib only)."""
import concurrent.futures
import hashlib
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.research-cache'

class Reader(HTMLParser):
    def __init__(self):
        super().__init__()
        self.skip = 0
        self.parts = []
        self.links = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('script', 'style', 'noscript', 'svg'):
            self.skip += 1
        if tag == 'a' and attrs.get('href'):
            self.links.append(attrs['href'])
        if tag in ('p', 'div', 'li', 'h1', 'h2', 'h3', 'tr', 'br'):
            self.parts.append('\n')
    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'noscript', 'svg'):
            self.skip = max(0, self.skip - 1)
    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)

def fetch(url):
    key = hashlib.sha256(url.encode()).hexdigest()[:12]
    path = CACHE / (key + '.json')
    if path.exists() and not url.endswith('.md'):
        record = json.loads(path.read_text(encoding='utf-8'))
    else:
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; PortfolioResearch/1.0)'})
            with urllib.request.urlopen(request, timeout=20) as response:
                html = response.read().decode('utf-8', errors='replace')
                parser = Reader()
                parser.feed(html)
                text = html if url.endswith('.md') else re.sub(r'[ \t\r\f\v]+', ' ', ''.join(parser.parts))
                text = re.sub(r'\n\s*\n+', '\n', text).strip()
                record = {'url': url, 'final_url': response.url, 'status': response.status,
                          'retrieved_at': datetime.now(timezone.utc).isoformat(), 'text': text,
                          'links': sorted(set(urljoin(response.url, link) for link in parser.links if not link.startswith(('javascript:', 'mailto:'))))}
        except Exception as exc:
            record = {'url': url, 'error': str(exc)}
        path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    return {'cache': str(path.relative_to(ROOT)), 'url': url, 'status': record.get('status'), 'error': record.get('error'), 'length': len(record.get('text', ''))}

if __name__ == '__main__':
    CACHE.mkdir(exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        for result in pool.map(fetch, sys.argv[1:]):
            print(json.dumps(result, ensure_ascii=False))
