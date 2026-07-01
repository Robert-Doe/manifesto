// NeuralTab — tab_manager.js (Module 07 — unchanged from M06)
'use strict';

let allTabs={},tabAccessTimes={},filterIdle=false,filterAudible=false;

async function init(){
  const has=await chrome.permissions.contains({permissions:['tabs']});
  if(!has){document.getElementById('permission-banner').classList.add('visible');renderEmptyState('Grant tabs permission.');return;}
  document.getElementById('permission-banner').classList.remove('visible');
  const s=await StorageManager.get(['tabAccessTimes']);
  tabAccessTimes=s.tabAccessTimes||{};
  await loadTabs();wireControls();
}
async function loadTabs(){showLoading();allTabs=await chrome.tabs.query({});renderStats();renderTabGroups();}
function showLoading(){document.getElementById('tab-groups-container').innerHTML='<div class="loading-state">Loading tabs…</div>';}
function renderEmptyState(msg){document.getElementById('tab-groups-container').innerHTML=`<div class="empty-state">${msg}</div>`;}
function renderStats(){
  const domains=new Set(allTabs.map(t=>extractDomain(t.url)));
  const idle=allTabs.filter(t=>!t.active&&!t.audible&&!t.pinned).length;
  document.getElementById('stat-total').textContent=allTabs.length;
  document.getElementById('stat-domains').textContent=domains.size;
  document.getElementById('stat-idle').textContent=idle;
  document.getElementById('stat-pinned').textContent=allTabs.filter(t=>t.pinned).length;
}
function renderTabGroups(){
  let tabs=[...allTabs];
  if(filterIdle) tabs=tabs.filter(t=>!t.active&&!t.audible&&!t.pinned);
  if(filterAudible) tabs=tabs.filter(t=>t.audible);
  const groups=new Map();
  for(const t of tabs){const d=extractDomain(t.url);if(!groups.has(d))groups.set(d,[]);groups.get(d).push(t);}
  const sorted=[...groups.entries()].sort((a,b)=>b[1].length-a[1].length);
  const c=document.getElementById('tab-groups-container');c.innerHTML='';
  if(!sorted.length){renderEmptyState('No tabs match filter.');return;}
  for(const[domain,dt]of sorted)c.appendChild(buildGroupEl(domain,dt));
}
function buildGroupEl(domain,tabs){
  const g=document.createElement('div');g.className='tab-group';
  const h=document.createElement('div');h.className='tab-group-header';
  h.innerHTML=`<span class="tab-group-domain">${escHtml(domain)}</span>
    <div style="display:flex;gap:8px;align-items:center;">
      <span class="tab-group-count">${tabs.length} tab${tabs.length!==1?'s':''}</span>
      <div class="tab-group-actions">
        <button class="btn btn-sm btn-ghost btn-group-tabs" data-domain="${escHtml(domain)}">Group</button>
        <button class="btn btn-sm btn-danger btn-close-domain" data-domain="${escHtml(domain)}">Close all</button>
      </div></div>`;
  const tl=document.createElement('div');tl.className='tab-list';
  h.addEventListener('click',e=>{if(e.target.closest('button'))return;tl.style.display=tl.style.display==='none'?'':'none';});
  for(const t of tabs)tl.appendChild(buildTabEl(t));
  h.querySelector('.btn-group-tabs').addEventListener('click',async e=>{
    e.stopPropagation();
    await chrome.runtime.sendMessage({action:'groupTabsByDomain',tabIds:tabs.map(t=>t.id),domain});
    await loadTabs();
  });
  h.querySelector('.btn-close-domain').addEventListener('click',async e=>{
    e.stopPropagation();
    if(!confirm(`Close ${tabs.length} tab(s) from ${domain}?`))return;
    await chrome.tabs.remove(tabs.map(t=>t.id));await loadTabs();
  });
  g.appendChild(h);g.appendChild(tl);return g;
}
function buildTabEl(tab){
  const isActive=tab.active,isAudible=tab.audible,isIdle=!tab.active&&!tab.audible&&!tab.pinned,isPinned=tab.pinned;
  const lastAccess=tabAccessTimes[tab.id];
  const agoMin=lastAccess?Math.floor((Date.now()-lastAccess)/60000):null;
  const isStale=agoMin!==null&&agoMin>30;
  let cls='tab-item';
  if(isActive)cls+=' active-tab';else if(isAudible)cls+=' audible-tab';else if(isIdle)cls+=' idle-tab';
  const el=document.createElement('div');el.className=cls;el.dataset.tabId=tab.id;
  let favicon;
  if(tab.favIconUrl){favicon=document.createElement('img');favicon.className='tab-favicon';favicon.src=tab.favIconUrl;favicon.onerror=()=>favicon.replaceWith(placeholderFavicon());}
  else{favicon=placeholderFavicon();}
  const info=document.createElement('div');info.className='tab-info';
  const lastHtml=lastAccess?`<div class="tab-last-access${isStale?' stale':''}">Last active: ${agoMin===0?'just now':`${agoMin}m ago`}${isStale?' ⚠':''}</div>`:'';
  info.innerHTML=`<div class="tab-title">${escHtml(tab.title||'(no title)')}</div><div class="tab-url">${escHtml(tab.url||'')}</div>${lastHtml}`;
  const badges=document.createElement('div');badges.className='tab-badges';
  if(isActive)badges.innerHTML+='<span class="badge badge-active">active</span>';
  if(isAudible)badges.innerHTML+='<span class="badge badge-audible">♪ audio</span>';
  if(isIdle)badges.innerHTML+='<span class="badge badge-idle">idle</span>';
  if(isPinned)badges.innerHTML+='<span class="badge badge-pinned">pinned</span>';
  const actions=document.createElement('div');actions.className='tab-actions';
  const sw=document.createElement('button');sw.className='tab-action-btn';sw.textContent='Switch';
  sw.addEventListener('click',async()=>{await chrome.tabs.update(tab.id,{active:true});await chrome.windows.update(tab.windowId,{focused:true}).catch(()=>{});});
  const bk=document.createElement('button');bk.className='tab-action-btn';bk.textContent='★ Save';
  bk.addEventListener('click',()=>bookmarkTab(tab));
  const cl=document.createElement('button');cl.className='tab-action-btn close-btn';cl.textContent='✕';
  cl.addEventListener('click',async()=>{await chrome.tabs.remove(tab.id);el.style.opacity='0.3';el.style.pointerEvents='none';setTimeout(()=>el.remove(),300);allTabs=allTabs.filter(t=>t.id!==tab.id);renderStats();});
  actions.appendChild(sw);actions.appendChild(bk);actions.appendChild(cl);
  el.appendChild(favicon);el.appendChild(info);el.appendChild(badges);el.appendChild(actions);return el;
}
function placeholderFavicon(){const d=document.createElement('div');d.className='tab-favicon-placeholder';d.textContent='🌐';return d;}
async function closeAllIdleTabs(){
  const idle=allTabs.filter(t=>!t.active&&!t.audible&&!t.pinned);
  if(!idle.length){alert('No idle tabs.');return;}
  if(!confirm(`Close ${idle.length} idle tab(s)?`))return;
  await chrome.tabs.remove(idle.map(t=>t.id));await loadTabs();
}
async function groupAllByDomain(){
  const map=new Map();
  for(const t of allTabs){const d=extractDomain(t.url);if(!map.has(d))map.set(d,[]);map.get(d).push(t.id);}
  for(const[domain,ids]of map){if(ids.length<2)continue;await chrome.runtime.sendMessage({action:'groupTabsByDomain',tabIds:ids,domain});}
  await loadTabs();
}
async function searchHistory(q){
  const has=await chrome.permissions.contains({permissions:['history']});
  const c=document.getElementById('history-results');
  if(!has){c.innerHTML='<div style="color:var(--muted);font-size:12px;">Grant history permission.</div>';return;}
  const r=await chrome.history.search({text:q,maxResults:10});
  c.innerHTML='';
  if(!r.length){c.innerHTML='<div style="color:var(--muted);font-size:12px;">No results.</div>';return;}
  for(const item of r){const el=document.createElement('div');el.className='history-item';el.innerHTML=`<div>${escHtml(item.title||item.url)}</div><div class="history-url">${escHtml(item.url)}</div>`;el.addEventListener('click',()=>chrome.tabs.create({url:item.url}));c.appendChild(el);}
}
async function loadRecentBookmarks(){
  const has=await chrome.permissions.contains({permissions:['bookmarks']});
  const c=document.getElementById('bookmark-results');
  if(!has){c.innerHTML='<div style="color:var(--muted);font-size:12px;">Grant bookmarks permission.</div>';return;}
  const r=await chrome.bookmarks.getRecent(10);c.innerHTML='';
  for(const bm of r){if(!bm.url)continue;const el=document.createElement('div');el.className='bookmark-item';el.innerHTML=`<div>★ ${escHtml(bm.title||bm.url)}</div><div class="bookmark-url">${escHtml(bm.url)}</div>`;el.addEventListener('click',()=>chrome.tabs.create({url:bm.url}));c.appendChild(el);}
}
async function bookmarkTab(tab){
  const has=await chrome.permissions.contains({permissions:['bookmarks']});
  if(!has){alert('Grant bookmarks permission.');return;}
  const{bookmarkFolderName}=await StorageManager.get(['bookmarkFolderName']);
  const results=await chrome.bookmarks.search({title:bookmarkFolderName});
  const folder=results.find(r=>!r.url)||await chrome.bookmarks.create({title:bookmarkFolderName});
  await chrome.bookmarks.create({parentId:folder.id,title:tab.title||tab.url,url:tab.url});
}
function wireControls(){
  document.getElementById('btn-refresh').addEventListener('click',loadTabs);
  document.getElementById('btn-close-idle').addEventListener('click',closeAllIdleTabs);
  document.getElementById('btn-group-domains').addEventListener('click',groupAllByDomain);
  document.getElementById('filter-idle').addEventListener('change',e=>{filterIdle=e.target.checked;renderTabGroups();});
  document.getElementById('filter-audible').addEventListener('change',e=>{filterAudible=e.target.checked;renderTabGroups();});
  document.getElementById('btn-history-search').addEventListener('click',()=>{const q=document.getElementById('history-search').value.trim();if(q)searchHistory(q);});
  document.getElementById('history-search').addEventListener('keydown',e=>{if(e.key==='Enter'){const q=e.target.value.trim();if(q)searchHistory(q);}});
  document.getElementById('btn-load-bookmarks').addEventListener('click',loadRecentBookmarks);
  document.getElementById('btn-grant-tabs').addEventListener('click',async()=>{const g=await chrome.permissions.request({permissions:['tabs']});if(g)init();});
}
function extractDomain(url){if(!url)return'(unknown)';try{const u=new URL(url);if(u.protocol==='chrome:')return'chrome://';if(u.protocol==='chrome-extension:')return'extension://';return u.hostname||url;}catch{return url.slice(0,40);}}
function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
init();
