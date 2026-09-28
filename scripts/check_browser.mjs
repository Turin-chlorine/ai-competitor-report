import {browser} from './browser.mjs';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const b=await browser();
const checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);};
const evaluate=expr=>b.evaluate(expr);
const click=selector=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.focus();e.click()})()`);
const screenshot=async(name)=>{
  const shot=await b.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(path.resolve('.qa',name+'.png'),Buffer.from(shot.data,'base64'));
};
try {
  await mkdir('.qa/downloads',{recursive:true});
  await b.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:path.resolve('.qa/downloads')});
  await b.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await b.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await b.navigate(pathToFileURL(path.resolve('index.html')).href);
  await b.delay(300);
  check('offline file:// renders 40 comparison cells',await evaluate("document.querySelectorAll('#comparisonTable .cell-button').length===40"));
  check('21 source records render offline',await evaluate("document.querySelectorAll('.source-item').length===21"));
  check('four known representative monthly bars; unknown price excluded',await evaluate("document.querySelectorAll('.bar-fill').length===4"));
  check('no duplicate HTML IDs',await evaluate("(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return ids.length===new Set(ids).size})()"));
  await screenshot('desktop');
  // Open every comparison entry. Each dialogue must resolve all its references.
  const cells=await evaluate("[...document.querySelectorAll('#comparisonTable .cell-button')].map(b=>({p:b.dataset.product,d:b.dataset.dimension}))");
  for(const {p,d} of cells) {
    await click(`#comparisonTable [data-product="${p}"][data-dimension="${d}"]`);
    assert.ok(await evaluate("document.querySelector('dialog').open && document.querySelectorAll('.dialog-evidence').length>0"),p+'/'+d);
    await click('#closeDialog');
  }
  checks.push('all 40 comparison entries resolve to evidence dialogs');
  const refs=await evaluate("[...document.querySelectorAll('button[data-evidence]')].map(b=>b.dataset.evidence)");
  for(const ref of new Set(refs)) {
    await click(`[data-evidence="${ref}"]`);
    assert.ok(await evaluate("document.querySelector('dialog').open && document.querySelectorAll('.dialog-evidence blockquote').length>0"),ref);
    await click('#closeDialog');
  }
  checks.push('all visible source buttons resolve quote references');
  await click('[data-filter-product="gemini"]');await click('[data-filter-product="kimi"]');await click('[data-filter-product="perplexity"]');
  check('two products produce sixteen comparison cells',await evaluate("document.querySelectorAll('#comparisonTable .cell-button').length===16"));
  await click('[data-group="research"]');
  check('stage filtering produces four cells',await evaluate("document.querySelectorAll('#comparisonTable .cell-button').length===4"));
  await click('[data-filter-product="chatgpt"]');await click('[data-filter-product="claude"]');
  check('empty selection explains recovery',await evaluate("document.querySelector('.empty-cell').textContent.includes('请选择至少')"));
  await click('#resetFilters');
  await click('[data-scenario="materials"]');
  check('scenario switches product recommendations',await evaluate("document.querySelector('#scenarioPanel').textContent.includes('Claude') && document.querySelector('#scenarioPanel').textContent.includes('ChatGPT')"));
  await evaluate("document.querySelector('[data-scenario=materials]').focus()");
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});
  check('scenario tabs support arrow-key navigation',await evaluate("document.querySelector('[data-scenario=revision]').getAttribute('aria-selected')==='true'"));
  await click('[data-billing="annual"]');
  check('unknown annual prices not coerced to zero',await evaluate("document.querySelectorAll('.bar-fill').length===2 && document.querySelectorAll('.price-absent').length===2"));
  check('annual math: Claude 200/12=16.67; Kimi 468/12=39',await evaluate("document.querySelector('#priceCharts').textContent.includes('US$16.67') && document.querySelector('#priceCharts').textContent.includes('¥39')"));
  await evaluate("document.querySelector('#calcMonths').value=10;document.querySelector('#calcMonths').dispatchEvent(new Event('input'))");
  check('Claude breakeven at ten months',await evaluate("document.querySelector('#calcResult').textContent.includes('两种方式支出相同')"));
  await evaluate("document.querySelector('#calcPlan').value='kimi-go';document.querySelector('#calcPlan').dispatchEvent(new Event('change'));document.querySelector('#calcMonths').value=12;document.querySelector('#calcMonths').dispatchEvent(new Event('input'))");
  check('Kimi twelve-month budget saves CNY120 on annual billing',await evaluate("document.querySelector('#calcResult').textContent.includes('年付少支出 ¥120')"));
  await evaluate("document.querySelector('#sourceSearch').value='Kimi';document.querySelector('#sourceSearch').dispatchEvent(new Event('input'))");
  check('source search finds five Kimi records',await evaluate("document.querySelectorAll('.source-item').length===5"));
  await evaluate("document.querySelector('#sourceSearch').value='zzzz-no-source';document.querySelector('#sourceSearch').dispatchEvent(new Event('input'))");
  check('source search has meaningful empty state',await evaluate("document.querySelector('#sourceSearchStatus').textContent.includes('未找到')"));
  await evaluate("document.querySelector('#sourceSearch').value='';document.querySelector('#sourceSearch').dispatchEvent(new Event('input'))");
  await click('#taskButton');
  check('task card labels unperformed benchmark',await evaluate("document.querySelector('#dialogContent').textContent.includes('未把任务设计当作实测')"));
  await b.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await b.delay(50);
  const dialogState=await evaluate("({open:document.querySelector('dialog').open,focus:document.activeElement.id})");
  check('Escape closes dialog and restores focus '+JSON.stringify(dialogState),!dialogState.open&&dialogState.focus==='taskButton');
  await click('#downloadData');await click('#downloadTask');await b.delay(700);
  const downloads=await readdir('.qa/downloads');
  const jsonName=downloads.find(x=>x.endsWith('.json'));
  check('offline JSON and task downloads complete',!!jsonName&&downloads.some(x=>x.endsWith('.txt')));
  assert.deepEqual(JSON.parse(await readFile(path.join('.qa/downloads',jsonName),'utf8')),JSON.parse(await readFile('data/research.json','utf8')));
  checks.push('downloaded research data matches source dataset exactly');
  await click('[data-billing="monthly"]');
  for(const id of ['compare','pricing','evidence']) {
    await evaluate(`document.getElementById('${id}').scrollIntoView({behavior:'instant'})`);await b.delay(100);await screenshot('desktop-'+id);
  }
  for(const width of [768,390,320]) {
    await b.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:false});
    await evaluate("scrollTo({top:0,behavior:'instant'})");await b.delay(150);
    const sizes=await evaluate('({scroll:document.documentElement.scrollWidth,width:innerWidth})');
    check(`no page-level horizontal overflow at ${width}px`,sizes.scroll<=sizes.width);
    await screenshot('mobile-'+width);
  }
  await evaluate("document.querySelector('#compare').scrollIntoView({behavior:'instant'});document.querySelector('#comparisonTable').parentElement.scrollLeft=9999");await b.delay(100);
  check('mobile table scroll reaches final product',await evaluate("(()=>{const e=document.querySelector('#comparisonTable').parentElement;return e.scrollLeft>0&&e.scrollWidth-e.scrollLeft-e.clientWidth<2})()"));
  await screenshot('mobile-compare');
  check('last mobile product is not covered by sticky first column',await evaluate("(()=>{const h=document.querySelectorAll('#comparisonTable thead th');return h[h.length-1].getBoundingClientRect().left>=h[0].getBoundingClientRect().right-1})()"));
  await b.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await click('[data-filter-product="kimi"]');await click('[data-group="write"]');await click('[data-billing="annual"]');
  await evaluate("window.dispatchEvent(new Event('beforeprint'))");
  check('print expands all products, scenarios and evidence',await evaluate("document.querySelectorAll('#comparisonTable .cell-button').length===40 && document.querySelectorAll('.print-scenario').length===4 && document.querySelectorAll('.source-item[open]').length===21"));
  await b.send('Emulation.setEmulatedMedia',{media:'print'});
  await evaluate("scrollTo({top:0,behavior:'instant'})");await screenshot('print-preview');
  const pdf=await b.send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true});
  await writeFile('.qa/report.pdf',Buffer.from(pdf.data,'base64'));
  await evaluate("window.dispatchEvent(new Event('afterprint'))");
  check('print restores previous selection and billing state',await evaluate("document.querySelectorAll('#comparisonTable .cell-button').length===8 && document.querySelector('[data-billing=annual]').getAttribute('aria-pressed')==='true'"));
  const errors=b.events.filter(e=>e.method==='Runtime.exceptionThrown');
  check('no browser JavaScript errors',errors.length===0);
  const remote=b.events.filter(e=>e.method==='Network.requestWillBeSent'&&/^https?:/.test(e.params.request.url));
  check('report makes no network requests',remote.length===0);
  await writeFile('.qa/checks.json',JSON.stringify({passed:checks.length,checks},null,2));
  console.log(JSON.stringify({passed:checks.length,checks},null,2));
} catch(error) {
  await screenshot('failure').catch(()=>{});
  console.error(JSON.stringify({passed:checks.length,checks,error:error.message},null,2));
  process.exitCode=1;
} finally {await b.close();}
