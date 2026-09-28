// Minimal Chrome DevTools client. No npm dependencies; uses a locally installed Chrome.
import {spawn} from 'node:child_process';
import {mkdir, readFile} from 'node:fs/promises';
import path from 'node:path';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function browser() {
  const profile = path.resolve('.qa', 'chrome-' + Date.now());
  await mkdir(profile, {recursive:true});
  const child = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],
    {windowsHide:true, stdio:'ignore'});
  let port;
  for(let i=0;i<100;i++) { try { port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]; break; } catch {await delay(100);} }
  if(!port) {child.kill(); throw new Error('Chrome did not start');}
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const ws = new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let next=1; const pending=new Map(); const events=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}else events.push(m);};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=next++;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  return {send,events, async evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;},
    async navigate(url){await send('Page.navigate',{url});for(let i=0;i<100;i++){await delay(100);try{if(await this.evaluate('document.readyState === "complete"'))return;}catch{}}},
    async close(){try{await send('Browser.close');}catch{} ws.close();child.kill();},delay};
}
