(() => {
  'use strict';
  const D = JSON.parse(document.getElementById('researchData').textContent);
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const products = new Map(D.products.map(p => [p.id, p]));
  const sources = new Map(D.sources.map(s => [s.id,s]));
  const quotes = new Map(D.sources.flatMap(s => s.quotes.map(q => [q.id,{...q,source:s}])));
  const status = {documented:'有公开说明',conditional:'附条件 / 入口差异',historical:'历史二手记录',unconfirmed:'本次未确认'};
  const kinds = {official:'官方文档',publisher:'开发者公开说明',secondary:'历史二手资料'};
  const groups = {all:'全部环节',research:'搜集资料',verify:'核对依据',write:'写作改稿',deliver:'交付与限制'};
  const state = {selected:new Set(D.products.map(p=>p.id)), group:'all', scenario:D.scenarios[0].id, billing:'monthly'};
  const date = D.meta.date.replaceAll('-','.');
  const sourceIds = refs => [...new Set(refs.map(r=>r.split('.')[0]))];
  const refs = items => `<div class="refs" aria-label="支持此项的来源">${sourceIds(items).map(id=>`<button type="button" class="ref-btn" data-evidence="${esc(items.filter(q=>q.startsWith(id+'.')).join('|'))}" aria-label="查看 ${esc(id)} ${esc(sources.get(id).title)}">${esc(id)} ↗</button>`).join('')}</div>`;
  const money = (n,currency) => `${currency==='USD'?'US$':'¥'}${n.toLocaleString('en-US',{minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:2})}`;
  const dot = s => `<span class="map-dot ${esc(s)}" aria-hidden="true"></span>`;
  const scope = (p,c) => c.scope || `${p.entry}；${p.region}`;
  function openDialog(title,body,eyebrow='EVIDENCE NOTE') {
    $('dialogEyebrow').textContent=eyebrow;
    $('dialogContent').innerHTML=`<h2 id="dialogTitle">${esc(title)}</h2>${body}`;
    if(!$('detailDialog').open)$('detailDialog').showModal();
    $('detailDialog').scrollTop=0;
  }
  function evidenceBlocks(items) {
    return sourceIds(items).map(id=>{
      const s=sources.get(id), qs=items.filter(q=>q.startsWith(id+'.'));
      return `<section class="dialog-evidence"><h3>${esc(id)} · ${esc(s.title)}</h3><p>${esc(kinds[s.kind])} · ${esc(s.publisher)} · 采集 ${esc(s.retrieved_at.slice(0,10))}${s.published?' · 原文日期 '+esc(s.published):''}</p><p>适用口径：${esc(s.scope)}</p>${qs.map(q=>`<blockquote><small>${esc(q)} · 原文摘录</small><br>${esc(quotes.get(q).text)}…</blockquote>`).join('')}${s.note?`<p>核验备注：${esc(s.note)}</p>`:''}<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">查看原始页面 ↗<br>${esc(s.url)}</a></section>`;
    }).join('');
  }
  function showCell(product,dimension) {
    const p=products.get(product), dim=D.dimensions.find(d=>d.id===dimension), c=p.cells[dimension];
    openDialog(`${p.name} · ${dim.label}`,`<span class="cell-status">${dot(c.status)}${esc(status[c.status])}</span><p><strong>${esc(c.text)}</strong></p><p>${esc(c.detail)}</p><p class="dialog-scope">适用入口：${esc(scope(p,c))}<br>记录日期：${esc(D.meta.date)}。公开说明不等于本项目实测结果。</p>${evidenceBlocks(c.evidence)}`);
  }
  function renderTable() {
    const ps=D.products.filter(p=>state.selected.has(p.id));
    const dims=D.dimensions.filter(d=>state.group==='all'||d.group===state.group);
    $('comparisonTable').style.minWidth=`${Math.max(320,150+ps.length*185)}px`;
    $('comparisonTable').style.setProperty('--columns',ps.length);
    $('comparisonTable').innerHTML=`<caption class="sr-only">研究型写作工作流功能对照，资料快照 ${esc(D.meta.date)}</caption><thead><tr><th scope="col">工作环节<small>点开能力，查看证据</small></th>${ps.map(p=>`<th scope="col">${esc(p.name)}<small>${esc(p.entry)}</small></th>`).join('')}</tr></thead><tbody>${ps.length?dims.map(d=>`<tr><th scope="row">${esc(d.label)}<small>${esc(d.question)}</small></th>${ps.map(p=>{const c=p.cells[d.id];return `<td><button type="button" class="cell-button" data-product="${p.id}" data-dimension="${d.id}" aria-label="${esc(p.name+'，'+d.label+'，'+c.text+'。查看证据')} "><span class="cell-status">${dot(c.status)}${esc(status[c.status])}</span><strong>${esc(c.text)}</strong><span class="cell-reference">${esc(sourceIds(c.evidence).join(' · '))} ↗</span></button></td>`;}).join('')}</tr>`).join(''):'<tr><td class="empty-cell">请选择至少一款产品，或点击“恢复全部产品与环节”。</td></tr>'}</tbody>`;
    $('comparisonCount').textContent=`当前 ${ps.length} 款产品 · ${dims.length} 个维度 · ${ps.length*dims.length} 项记录`;
    document.querySelectorAll('[data-group]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.group===state.group)));
    document.querySelectorAll('[data-filter-product]').forEach(input=>input.checked=state.selected.has(input.dataset.filterProduct));
  }
  function scenarioHTML(s) {
    return `<h3>${esc(s.title)}</h3><div class="pick-tags">${s.pick.map(id=>`<span class="pick-tag">${esc(products.get(id).name)}</span>`).join('')}</div><p>${esc(s.reason)}</p><p class="scenario-boundary">试用时检查：${esc(s.boundary)}</p>${refs(s.evidence)}`;
  }
  function renderScenario() {
    const s=D.scenarios.find(s=>s.id===state.scenario);
    document.querySelectorAll('[data-scenario]').forEach(b=>{const selected=b.dataset.scenario===s.id;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;});
    $('scenarioPanel').setAttribute('aria-labelledby','scenario-'+s.id);
    $('scenarioPanel').innerHTML=scenarioHTML(s);
  }
  function renderPrices() {
    document.querySelectorAll('[data-billing]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.billing===state.billing)));
    const annual=state.billing==='annual';
    $('priceCharts').innerHTML=['USD','CNY'].map(currency=>{
      const list=D.plans.filter(p=>p.representative&&p.currency===currency);
      // Both modes use the same scale within each currency. Unknown prices never become zero.
      const max=Math.ceil(Math.max(...list.map(p=>p.monthly))/5)*5;
      return `<div class="price-group ${currency.toLowerCase()}" aria-label="${currency} 套餐月费图"><div class="price-group-head"><strong>${currency==='USD'?'美元 USD':'人民币 CNY'}</strong><span>${annual?'年价 ÷ 12；实际按年付款':'月付方案的每月付款额'}</span></div>${list.map(p=>{
        const value=annual?(p.annual===null?null:p.annual/12):p.monthly;
        return `<div class="price-row"><div class="price-name">${esc(products.get(p.product).name)}<small>${esc(p.name)}</small></div>${value===null?`<div class="price-absent">${esc(p.annual_note)}</div>`:`<div class="bar-track" aria-hidden="true"><span class="bar-fill" style="width:${(value/max*100).toFixed(4)}%"></span></div><div class="price-amount">${money(value,currency)}<small>${annual?'年付折算 / 月':'/ 月'}</small></div>`}</div>`;
      }).join('')}<div class="chart-axis" aria-hidden="true"><span>0</span><span>${max/2}</span><span>${max}</span></div><p class="micro">横轴：${currency} / 月；纵轴：所选套餐。${currency==='USD'?'美元公开报价，地区及税费见明细。':'中国大陆报价，与美元图独立刻度。'}采集 ${esc(D.meta.date)}。</p>${refs(list.flatMap(p=>p.evidence))}</div>`;
    }).join('');
  }
  function renderCalculator() {
    const p=D.plans.find(p=>p.id===$('calcPlan').value);
    const months=Number($('calcMonths').value);
    $('monthValue').textContent=months;
    const monthlyTotal=Math.round(p.monthly*100)*months/100;
    const difference=Math.round((monthlyTotal-p.annual)*100)/100;
    const verdict=difference===0?'两种方式支出相同。':difference>0?`年付少支出 ${money(difference,p.currency)}。`:`按月付款少支出 ${money(-difference,p.currency)}。`;
    $('calcResult').innerHTML=`<div class="calc-line"><span>月付 × ${months} 个月</span><strong>${money(monthlyTotal,p.currency)}</strong></div><div class="calc-line"><span>年付一次支付</span><strong>${money(p.annual,p.currency)}</strong></div><p class="calc-verdict">${esc(verdict)}</p><p class="micro">计算不含额外用量、税费、优惠或退款；不是产品效果比较。</p>${refs(p.evidence)}`;
  }
  function sourceHTML(s) {
    return `<details class="source-item" id="source-${s.id}"><summary><span class="source-id">${esc(s.id)}</span><span class="source-title">${esc(s.title)}<span class="source-kind">${esc(kinds[s.kind])} · ${esc(s.publisher)}${s.published?' · 原文 '+esc(s.published):''}</span></span><span class="source-toggle" aria-hidden="true">＋</span></summary><div class="source-body"><p>适用口径：${esc(s.scope)}</p><p>访问时间：${esc(s.retrieved_at)}<br>采集方式：${esc(s.capture)}</p>${s.note?`<p>处理说明：${esc(s.note)}</p>`:''}<a class="source-url" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.url)} ↗</a>${s.quotes.map(q=>`<blockquote><span class="quote-id">${esc(q.id)} · 原文摘录</span>${esc(q.text)}…</blockquote>`).join('')}</div></details>`;
  }
  function renderSources() {
    const query=$('sourceSearch').value.trim().toLocaleLowerCase();
    const list=D.sources.filter(s=>JSON.stringify(s).toLocaleLowerCase().includes(query));
    $('sourceList').innerHTML=list.map(sourceHTML).join('');
    $('sourceSearchStatus').textContent=list.length?`显示 ${list.length} / ${D.sources.length} 条来源记录`:'未找到匹配来源。可尝试产品名、来源编号或清空搜索。';
  }
  function download(filename,text,type) {
    const url=URL.createObjectURL(new Blob([text],{type}));
    const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const downloadTask=()=>download('研究型写作-统一复测任务卡.txt',D.task_prompt,'text/plain;charset=utf-8');

  // Render the document from the embedded research data, without network requests.
  $('editionDate').textContent=`资料快照 ${date}`;
  $('snapshotDate').textContent=D.meta.date;$('footerDate').textContent=date;
  const distinctURLs=new Set(D.sources.map(s=>s.url)).size;
  $('researchMeta').innerHTML=`<div class="meta-item"><strong>${D.products.length.toString().padStart(2,'0')}</strong><span>研究型助手<br>同一写作任务</span></div><div class="meta-item"><strong>${D.dimensions.length.toString().padStart(2,'0')}</strong><span>工作流维度<br>逐项对照</span></div><div class="meta-item"><strong>${distinctURLs}</strong><span>公开资料页面<br>可展开原文摘录</span></div><div class="meta-method"><b>${esc(D.meta.method)}</b><span>快照 ${date} · 非同题性能实测</span></div>`;
  $('findingsList').innerHTML=D.findings.map(f=>`<article class="finding"><div class="finding-num">${esc(f.number)}</div><h3>${esc(f.title)}</h3><p>${esc(f.body)}</p>${refs(f.evidence)}</article>`).join('');
  const stages=[['research','01 搜集'],['citations','02 查据'],['editing','03 改稿'],['export','04 交付']];
  $('workflowMap').innerHTML=`<table class="map-table"><caption class="sr-only">研究流程能力地图；来源与条件可点击展开</caption><thead><tr><th scope="col">产品 / 工作环节</th>${stages.map(([,label])=>`<th scope="col">${esc(label)}</th>`).join('')}</tr></thead><tbody>${D.products.map(p=>`<tr><th scope="row">${esc(p.name)}</th>${stages.map(([id])=>{const c=p.cells[id];return `<td><button class="map-cell" type="button" data-product="${p.id}" data-dimension="${id}" aria-label="${esc(p.name+'：'+c.text+'；'+status[c.status])}"><span>${esc(c.text)}<small style="display:block;font-size:9px;color:var(--muted);margin-top:4px">${esc(status[c.status])}</small></span>${dot(c.status)}</button></td>`;}).join('')}</tr>`).join('')}</tbody></table>`;
  $('productStrip').innerHTML=D.products.map(p=>`<article><div class="product-monogram" aria-hidden="true">${esc(p.initial)}</div><h4>${esc(p.name)}</h4><p>${esc(p.intro)}</p>${refs(p.evidence)}</article>`).join('');
  $('productFilters').insertAdjacentHTML('beforeend',D.products.map(p=>`<label class="product-filter"><input type="checkbox" checked data-filter-product="${p.id}">${esc(p.name)}</label>`).join(''));
  $('groupFilters').innerHTML=Object.entries(groups).map(([id,label])=>`<button class="group-button" type="button" data-group="${id}" aria-pressed="${id==='all'}">${esc(label)}</button>`).join('');
  $('statusLegend').innerHTML=Object.entries(status).map(([id,label])=>`<span>${dot(id)}${esc(label)}</span>`).join('');
  renderTable();
  $('scenarioTabs').innerHTML=D.scenarios.map((s,i)=>`<button class="scenario-tab" id="scenario-${s.id}" type="button" role="tab" data-scenario="${s.id}" aria-controls="scenarioPanel" aria-selected="${i===0}" tabindex="${i===0?0:-1}"><span>0${i+1}</span>${esc(s.label)}<span aria-hidden="true">↗</span></button>`).join('');
  renderScenario();renderPrices();
  $('priceNote').innerHTML=`<h4>Perplexity：保留价格空缺</h4><p>本次未取得当前 Web 套餐价。开发者在美国 App Store 列出的内购金额没有标明周期，不能直接进入月费图。</p><p class="micro">它仍参加能力比较；价格未知不等于免费。2025 年文章的报价也未当作当前报价。</p>${refs(['P01.4','P02.4'])}`;
  $('planTable').innerHTML=`<caption class="sr-only">已采集个人套餐价格，均保留币种与计费口径</caption><thead><tr><th scope="col">产品 / 套餐</th><th scope="col">按月付款</th><th scope="col">年付总额</th><th scope="col">年付折算 / 月</th><th scope="col">适用口径</th><th scope="col">来源</th></tr></thead><tbody>${D.plans.map(p=>`<tr><td>${esc(products.get(p.product).name)}<small>${esc(p.name)}</small></td><td>${money(p.monthly,p.currency)}</td><td>${p.annual===null?'未收录':money(p.annual,p.currency)}</td><td>${p.annual===null?'—':money(p.annual/12,p.currency)}</td><td>${esc(p.region)}<small>${esc(p.tax)}；${esc(p.annual_note)}</small></td><td>${refs(p.evidence)}</td></tr>`).join('')}</tbody>`;
  $('calcPlan').innerHTML=D.plans.filter(p=>p.annual!==null).map(p=>`<option value="${p.id}">${esc(products.get(p.product).name+' '+p.name)}</option>`).join('');
  renderCalculator();
  $('auditList').innerHTML=D.audit.map((a,i)=>`<article class="audit-item"><span class="audit-number">0${i+1}</span><div><h3>${esc(a.title)}</h3><p>${esc(a.observation)}</p>${refs(a.evidence)}</div><div class="audit-decision"><strong>采用口径</strong><p>${esc(a.decision)}</p><p class="audit-impact">${esc(a.impact)}</p></div></article>`).join('');
  $('opportunities').innerHTML=D.opportunities.map(o=>`<article class="opportunity"><span class="priority">${esc(o.priority)} · 验证优先级</span><h3>${esc(o.title)}</h3><dl><dt>观察到什么</dt><dd>${esc(o.observation)}</dd><dt>如何判断</dt><dd>${esc(o.judgment)}</dd><dt>下一步怎样验证</dt><dd>${esc(o.proposal)}</dd></dl>${refs(o.evidence)}<p class="micro">${esc(o.boundary)}</p></article>`).join('');
  $('limitations').innerHTML=D.limitations.map(l=>`<li>${esc(l)}</li>`).join('');
  $('sourceCount').textContent=`${distinctURLs} 个页面，${D.sources.length} 条采集记录；同一套餐页的月付、年付分别留档。`;
  renderSources();

  document.addEventListener('click',event=>{
    const cell=event.target.closest('[data-product][data-dimension]');
    if(cell){showCell(cell.dataset.product,cell.dataset.dimension);return;}
    const evidence=event.target.closest('[data-evidence]');
    if(evidence){openDialog('来源与原文摘录',evidenceBlocks(evidence.dataset.evidence.split('|')));return;}
    const group=event.target.closest('[data-group]');if(group){state.group=group.dataset.group;renderTable();return;}
    const scenario=event.target.closest('[data-scenario]');if(scenario){state.scenario=scenario.dataset.scenario;renderScenario();return;}
    const billing=event.target.closest('[data-billing]');if(billing){state.billing=billing.dataset.billing;renderPrices();}
  });
  $('productFilters').addEventListener('change',event=>{
    const id=event.target.dataset.filterProduct;if(!id)return;
    event.target.checked?state.selected.add(id):state.selected.delete(id);renderTable();
  });
  $('resetFilters').addEventListener('click',()=>{state.selected=new Set(D.products.map(p=>p.id));state.group='all';renderTable();});
  $('scenarioTabs').addEventListener('keydown',event=>{
    if(!['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    event.preventDefault();let index=D.scenarios.findIndex(s=>s.id===state.scenario);
    if(event.key==='Home')index=0;else if(event.key==='End')index=D.scenarios.length-1;else index=(index+(['ArrowRight','ArrowDown'].includes(event.key)?1:-1)+D.scenarios.length)%D.scenarios.length;
    state.scenario=D.scenarios[index].id;renderScenario();$('scenario-'+state.scenario).focus();
  });
  $('closeDialog').addEventListener('click',()=>$('detailDialog').close());
  $('detailDialog').addEventListener('click',e=>{if(e.target===$('detailDialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  $('taskButton').addEventListener('click',()=>openDialog('统一复测任务卡',`<p>此任务卡用于后续五款产品的同题研究。执行时应记录账号套餐、模型、日期、原始结果和实际消耗；当前报告未把任务设计当作实测。</p><pre class="task-text">${esc(D.task_prompt)}</pre>`,'REPRODUCIBLE TASK'));
  $('downloadTask').addEventListener('click',downloadTask);
  $('downloadData').addEventListener('click',()=>download('research-'+D.meta.date+'.json',JSON.stringify(D,null,2),'application/json;charset=utf-8'));
  $('calcPlan').addEventListener('change',renderCalculator);$('calcMonths').addEventListener('input',renderCalculator);
  $('sourceSearch').addEventListener('input',renderSources);
  $('printButton').addEventListener('click',()=>window.print());
  let savedPrintState=null;
  window.addEventListener('beforeprint',()=>{
    if(savedPrintState)return;
    savedPrintState={selected:new Set(state.selected),group:state.group,billing:state.billing,search:$('sourceSearch').value,open:[...document.querySelectorAll('.source-item[open]')].map(e=>e.id),plans:document.querySelector('.plan-details').open};
    state.selected=new Set(D.products.map(p=>p.id));state.group='all';state.billing='monthly';$('sourceSearch').value='';renderTable();renderPrices();renderSources();
    $('scenarioPanel').innerHTML=D.scenarios.map(s=>`<article class="print-scenario">${scenarioHTML(s)}</article>`).join('');
    document.querySelectorAll('.source-item,.plan-details').forEach(e=>e.open=true);
  });
  window.addEventListener('afterprint',()=>{
    if(!savedPrintState)return;
    const saved=savedPrintState;savedPrintState=null;state.selected=saved.selected;state.group=saved.group;state.billing=saved.billing;$('sourceSearch').value=saved.search;
    renderTable();renderPrices();renderSources();renderScenario();saved.open.forEach(id=>{if($(id))$(id).open=true;});document.querySelector('.plan-details').open=saved.plans;
  });
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting)document.querySelectorAll('.nav-inner a').forEach(a=>a.classList.toggle('active',a.hash==='#'+entry.target.id));
  }),{rootMargin:'-12% 0px -62% 0px',threshold:0});
  document.querySelectorAll('section[id]').forEach(s=>observer.observe(s));
})();
