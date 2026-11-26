// ==UserScript==
// @name         OPMAS — Opening Master
// @namespace    https://github.com/VoNguyenPhong-Kids11Ages/OPMAS
// @version      2.9.0
// @description  Read-only opening identification for completed Lichess and Chess.com games.
// @author       OPMAS
// @match        https://lichess.org/*
// @match        https://www.chess.com/*
// @match        https://*.chess.com/*
// @connect      lichess.org
// @connect      chess.com
// @connect      www.chess.com
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(() => {
  'use strict';
  const VERSION = '2.9.0';
  const GITHUB = 'https://github.com/VoNguyenPhong-Kids11Ages/OPMAS';
  const ID = 'opmas-290';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function request(url) {
    return new Promise((resolve, reject) => {
      const opts = {method:'GET',url,timeout:15000,headers:{Accept:'application/json'},onload:r=>r.status>=200&&r.status<300?resolve(r.responseText):reject(new Error('HTTP '+r.status)),onerror:()=>reject(new Error('Lỗi mạng/CORS')),ontimeout:()=>reject(new Error('Hết thời gian chờ'))};
      if (typeof GM_xmlhttpRequest === 'function') GM_xmlhttpRequest(opts);
      else if (typeof GM !== 'undefined' && GM.xmlHttpRequest) GM.xmlHttpRequest(opts);
      else fetch(url).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.text();}).then(resolve,reject);
    });
  }
  function parseUrl(raw) {
    let u; try {u=new URL(raw);} catch {throw new Error('Link không hợp lệ.');}
    const h=u.hostname.toLowerCase();
    if(h==='lichess.org'||h.endsWith('.lichess.org')) {const m=u.pathname.match(/^\/([A-Za-z0-9]{8})(?:\/|$)/);if(!m)throw new Error('Không tìm thấy mã ván Lichess.');return {site:'lichess',id:m[1]};}
    if(h==='chess.com'||h.endsWith('.chess.com')) {const live=u.pathname.match(/\/game\/live\/(\d+)/),daily=u.pathname.match(/\/game\/daily\/(\d+)/),other=u.pathname.match(/\/game\/(\d+)/),m=live||daily||other;if(!m)throw new Error('Link Chess.com không đúng định dạng ván cờ.');return {site:'chesscom',id:m[1],kind:daily?'daily':'live'};}
    throw new Error('Chỉ hỗ trợ Lichess và Chess.com.');
  }
  async function load(raw) {
    const ref=parseUrl(raw);
    if(ref.site==='lichess') {
      const d=JSON.parse(await request('https://lichess.org/game/export/'+encodeURIComponent(ref.id)+'?clocks=false&evals=false&opening=true'));
      if(d.variant&&d.variant!=='standard')throw new Error('Chỉ hỗ trợ cờ tiêu chuẩn.');
      if(['created','started'].includes(d.status))throw new Error('Ván đang diễn ra. OPMAS chỉ đọc ván đã kết thúc.');
      if(!new Set(['mate','resign','stalemate','timeout','draw','outoftime','cheat','unknownFinish','variantEnd']).has(d.status))throw new Error('Không xác minh được ván đã kết thúc.');
      return {site:'Lichess',white:d.players?.[0]?.user?.name||'Trắng',black:d.players?.[1]?.user?.name||'Đen',eco:d.opening?.eco||'',opening:d.opening?.name||'',result:d.winner==='white'?'1-0':d.winner==='black'?'0-1':d.status==='draw'||d.status==='stalemate'?'½-½':'Không rõ',plies:(d.moves||'').trim().split(/\s+/).filter(Boolean).length};
    }
    const d=JSON.parse(await request('https://www.chess.com/callback/'+ref.kind+'/game/'+encodeURIComponent(ref.id))),g=d.game||{},h=g.pgnHeaders||{},res=h.Result||'';
    if(g.isFinished!==true&&!['1-0','0-1','1/2-1/2'].includes(res))throw new Error(g.isFinished===false?'Ván đang diễn ra. OPMAS chỉ đọc ván đã kết thúc.':'Không xác minh được trạng thái ván.');
    return {site:'Chess.com',white:h.White||'Trắng',black:h.Black||'Đen',eco:h.ECO||'',opening:h.Opening||'',result:res||'Không rõ',plies:Math.floor((g.moveList||'').length/2)};
  }
  function mount() {
    if(!document.body||document.getElementById(ID+'-panel'))return;
    const css=document.createElement('style');css.textContent='#'+ID+'-panel{position:fixed;right:16px;bottom:68px;z-index:2147483647;width:min(350px,calc(100vw - 28px));display:none;background:#151b29;color:#eef2ff;border:1px solid #46536b;border-radius:13px;padding:13px;font:13px/1.45 system-ui;box-shadow:0 10px 35px #0008}#'+ID+'-panel input{width:100%;padding:9px;margin:7px 0;background:#0c1320;color:white;border:1px solid #53617a;border-radius:8px}#'+ID+'-panel button,#'+ID+'-toggle{padding:9px 12px;border:0;border-radius:8px;background:#3978dc;color:white;cursor:pointer;font-weight:700}#'+ID+'-panel .out{margin-top:10px;background:#222d40;border-radius:8px;padding:10px;overflow-wrap:anywhere}#'+ID+'-panel .muted{color:#afbdd2;font-size:11px}';document.head.append(css);
    const p=document.createElement('section');p.id=ID+'-panel';p.innerHTML='<b>♟ OPMAS v'+VERSION+'</b> <button data-x style="float:right;background:#354157">Đóng</button><p class="muted">Nhận diện khai cuộc từ ván đã kết thúc.</p><input data-url placeholder="Dán link Lichess / Chess.com"><button data-current style="background:#354157">Dùng link trang này</button> <button data-load>Đọc ván cờ</button><div class="out" data-out>Chưa tải ván.</div><p class="muted">Không gợi ý nước đi, không chạy engine và không phân tích ván đang chơi. Endpoint Chess.com không chính thức, có thể thay đổi.</p>';
    document.body.append(p);const t=document.createElement('button');t.id=ID+'-toggle';t.textContent='♟ OPMAS';t.style.cssText='position:fixed;right:16px;bottom:16px;z-index:2147483646';document.body.append(t);
    const input=p.querySelector('[data-url]'),out=p.querySelector('[data-out]');const current=()=>{try{parseUrl(location.href);return location.href;}catch{return '';}};if(current())input.value=current();
    t.onclick=()=>p.style.display=p.style.display==='block'?'none':'block';p.querySelector('[data-x]').onclick=()=>p.style.display='none';p.querySelector('[data-current]').onclick=()=>{input.value=current();if(!input.value)out.textContent='Trang hiện tại không phải link ván được hỗ trợ.';};
    p.querySelector('[data-load]').onclick=async e=>{const b=e.currentTarget;b.disabled=true;b.textContent='Đang tải…';out.textContent='Đang kiểm tra ván…';try{const g=await load(input.value.trim());out.innerHTML='<b>'+esc(g.site)+'</b><h3>'+esc(g.eco||'Chưa có ECO')+' '+esc(g.opening||'Chưa rõ khai cuộc')+'</h3>'+esc(g.white)+' — '+esc(g.black)+'<br>Kết quả: '+esc(g.result)+'<br>Số nửa nước: '+esc(g.plies)+'<p class="muted">Dữ liệu nhận diện từ ván đã kết thúc; không có engine.</p>';}catch(err){out.textContent=err.message||'Không tải được ván.';}finally{b.disabled=false;b.textContent='Đọc ván cờ';}};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  let href=location.href;setInterval(()=>{if(location.href!==href){href=location.href;const i=document.querySelector('#'+ID+'-panel [data-url]');if(i&&(()=>{try{parseUrl(location.href);return true;}catch{return false;}})())i.value=location.href;}if(!document.getElementById(ID+'-panel'))mount();},1200);
})();