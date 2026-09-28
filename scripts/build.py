"""Validate research references and build a self-contained offline report."""
import argparse
import json
from pathlib import Path
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[1]

def validate(data):
    assert len(data['products']) == 5, 'Expected five products'
    assert len({p['id'] for p in data['products']}) == 5
    dimensions={d['id'] for d in data['dimensions']}
    source_ids=set()
    quote_ids=set()
    for source in data['sources']:
        assert source['id'] not in source_ids
        source_ids.add(source['id'])
        assert urlparse(source['url']).scheme == 'https'
        assert source['retrieved_at'] and source['scope'] and source['publisher']
        for quote in source['quotes']:
            assert quote['id'] not in quote_ids and quote['text'].strip()
            assert quote['id'].startswith(source['id']+'.')
            quote_ids.add(quote['id'])
    def walk(value):
        if isinstance(value, dict):
            if 'evidence' in value:
                assert value['evidence'], 'Every claim needs evidence or an explicit reviewed-source boundary'
                assert set(value['evidence']) <= quote_ids, value['evidence']
            for item in value.values(): walk(item)
        elif isinstance(value,list):
            for item in value: walk(item)
    walk(data)
    for product in data['products']:
        assert set(product['cells']) == dimensions, product['id']
        for cell in product['cells'].values():
            assert cell['status'] in {'documented','conditional','historical','unconfirmed'}
            assert cell['text'] and cell['detail'] and cell['evidence']
            if cell['status']=='historical':
                assert any(q.startswith('P02.') for q in cell['evidence'])
    product_ids={p['id'] for p in data['products']}
    for plan in data['plans']:
        assert plan['product'] in product_ids and plan['currency'] in {'USD','CNY'}
        assert isinstance(plan['monthly'], (int,float)) and plan['monthly']>0
        assert plan['annual'] is None or plan['annual']>0
    return len(quote_ids)

def build(check=False):
    data=json.loads((ROOT/'data/research.json').read_text(encoding='utf-8'))
    quotes=validate(data)
    template=(ROOT/'src/report.html').read_text(encoding='utf-8')
    payload=json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
    output=template.replace('__STYLE__',(ROOT/'src/styles.css').read_text(encoding='utf-8')).replace('__DATA__',payload).replace('__APP__',(ROOT/'src/app.js').read_text(encoding='utf-8'))
    assert all(x not in output for x in ('__STYLE__','__DATA__','__APP__'))
    if check:
        assert (ROOT/'index.html').read_text(encoding='utf-8')==output, 'index.html is stale; run build.py'
    else:
        (ROOT/'index.html').write_text(output,encoding='utf-8',newline='\n')
    print(f'{"Checked" if check else "Built"} index.html: {len(data["products"])} products, {len(data["sources"])} source records, {quotes} quote references')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--check',action='store_true')
    build(parser.parse_args().check)
