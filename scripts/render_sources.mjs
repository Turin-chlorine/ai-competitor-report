import {browser} from './browser.mjs';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
const b=await browser();
try {
  await mkdir('.research-cache',{recursive:true});
  for(const url of process.argv.slice(2)) {
    await b.navigate(url); await b.delay(5000);
    const page=await b.evaluate('({title:document.title,text:document.body.innerText,links:[...document.links].map(a=>a.href),final_url:location.href})');
    const key=createHash('sha256').update(url).digest('hex').slice(0,12);
    const record={url,retrieved_at:new Date().toISOString(),...page};
    await writeFile(`.research-cache/${key}-rendered.json`,JSON.stringify(record,null,2));
    console.log(JSON.stringify({key,url,title:page.title,length:page.text.length,text:page.text.slice(0,14000)}));
    if(url==='https://www.kimi.com/membership/pricing') {
      await b.evaluate("[...document.querySelectorAll('button,span,div')].filter(e=>e.textContent.trim()==='连续包月').at(-1)?.click()");
      await b.delay(1500);
      const monthly=await b.evaluate('({title:document.title,text:document.body.innerText,final_url:location.href})');
      await writeFile(`.research-cache/${key}-monthly.json`,JSON.stringify({url,retrieved_at:new Date().toISOString(),...monthly},null,2));
      console.log(JSON.stringify({key,billing:'monthly',text:monthly.text.slice(0,2600)}));
    }
  }
} finally {await b.close();}
