"""Check excerpt identity against local captures, without making new network calls."""
import hashlib
import json
import re
from pathlib import Path
from build import ROOT, validate

data = json.loads((ROOT / 'data/research.json').read_text(encoding='utf-8'))
count = validate(data)
cache = {}
for path in (ROOT / '.research-cache').glob('*.json'):
    capture = json.loads(path.read_text(encoding='utf-8'))
    if capture.get('text'):
        normalized = re.sub(r'\s+', ' ', capture['text']).strip()
        cache[hashlib.sha256(normalized.encode()).hexdigest()] = normalized
missing = []
checked = 0
for source in data['sources']:
    raw = cache.get(source['text_sha256'])
    if raw is None:
        missing.append(source['id'])
        continue
    for quote in source['quotes']:
        assert re.sub(r'\s+', ' ', quote['text']).strip() in raw, quote['id']
        checked += 1
print(f'Reference integrity: {count} excerpts. Exact capture matches: {checked}.')
if missing:
    print('Original captures unavailable for: ' + ', '.join(missing))
    print('Excerpt verification incomplete. Published excerpts remain in data/research.json.')
    raise SystemExit(1)
print('All excerpts match recorded captures. This checks transcription, not product performance.')
