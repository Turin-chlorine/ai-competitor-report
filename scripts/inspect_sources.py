"""Inspect cached evidence: python scripts/inspect_sources.py KEY [search terms]."""
import base64
import json
import re
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.stdout.reconfigure(encoding='utf-8')
for file in sorted((Path(__file__).resolve().parents[1] / '.research-cache').glob(sys.argv[1] + '*.json')):
    data = json.loads(file.read_text(encoding='utf-8'))
    print('\nSOURCE', file.stem, data.get('url'))
    text = data.get('text', '')
    if len(sys.argv) == 2:
        print(text[:18000])
    else:
        for term in sys.argv[2:]:
            for match in list(re.finditer(re.escape(term), text, re.I))[:5]:
                print(repr(text[max(0, match.start()-120):match.end()+400]))
    if 'bing.com' in data.get('url', ''):
        for link in data.get('links', []):
            value = parse_qs(urlparse(link).query).get('u', [''])[0]
            if value.startswith('a1'):
                try:
                    result = base64.urlsafe_b64decode(value[2:] + '===').decode()
                    if result.startswith('https://') and not any(s in result for s in ['microsoft.com','bing.com']):
                        print('RESULT', result)
                except Exception:
                    pass
