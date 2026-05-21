const G = {
  token:'', pageId:'', pageName:'', tone:'friendly',
  catalog:[], dms:[], comments:[],
  selectedDmIdx:-1, connected:false,
  queue:[], selectedTemplate:null,
  bulkAudience:[], sending:false
};

const FESTIVALS = [
  {id:'dashain',emoji:'🎑',name:'Dashain',desc:'Tika & blessings greetings',badge:'',msg:`Happy Dashain! 🎑✨\n\nWishing you and your family the blessings of Goddess Durga — may this festival bring joy, prosperity, and good health. 🙏\n\nAs a special Dashain gift, we're offering {discount} off on all orders placed this week! Use code DASHAIN24.\n\nShop now: {link}`,category:'festival'},
  {id:'tihar',emoji:'🪔',name:'Tihar / Deepawali',desc:'Festival of lights wishes',badge:'',msg:`Happy Tihar! 🪔🌸\n\nMay the festival of lights illuminate your life with happiness and success. Wishing you a blessed Tihar from all of us! 🙏\n\nCelebrate with our exclusive Tihar collection — {discount} off sitewide. Offer ends {date}.\n\nOrder here: {link}`,category:'festival'},
  {id:'newyear',emoji:'🎆',name:'New Year',desc:'New Year greetings + offer',badge:'new',msg:`Happy New Year! 🎆🥂\n\nThank you so much for your support this year — it means everything to us. Wishing you a fantastic {year} filled with good things ahead! 🙏\n\nTo celebrate, enjoy {discount} off your next order with code NY{year}.\n\nShop: {link}`,category:'promo'},
  {id:'sale',emoji:'🛍️',name:'Flash sale',desc:'Limited-time sale blast',badge:'sale',msg:`Hey {name}! 👋\n\n⚡ FLASH SALE — {discount} off everything for the next 48 hours only!\n\nThis is our biggest sale of the season. Stock is limited so grab yours before it sells out 🔥\n\nShop now 👉 {link}\n\nOffer expires: {date}`,category:'promo'},
  {id:'restock',emoji:'📦',name:'Restock alert',desc:'Notify interested customers',badge:'',msg:`Great news, {name}! 📦\n\nThe item you were asking about is BACK IN STOCK! We know you've been waiting — get yours before it sells out again 🏃\n\n👉 {link}\n\nReply to this message if you have any questions!`,category:'product'},
  {id:'thankyou',emoji:'💛',name:'Thank you',desc:'Post-purchase appreciation',badge:'',msg:`Hi {name}! 💛\n\nJust wanted to personally thank you for your recent order — it truly means a lot to us!\n\nWe'd love to hear your feedback and see you rocking our products. Tag us @{page} for a feature! 📸\n\nIf you ever need anything, we're always here. 🙏`,category:'retention'},
  {id:'christmas',emoji:'🎄',name:'Christmas',desc:'Xmas wishes + promo',badge:'',msg:`Merry Christmas! 🎄✨\n\nWishing you a wonderful holiday season filled with warmth, love, and laughter.\n\nCelebrate with {discount} off your next purchase — use code XMAS at checkout 🎁\n\nShop: {link}`,category:'festival'},
  {id:'custom',emoji:'✏️',name:'Custom message',desc:'Write your own from scratch',badge:'',msg:'',category:'custom'},
];

const TONES = {
  friendly:'Warm and approachable. Use a conversational tone.',
  formal:'Professional and formal. Keep it polished and brief.',
  casual:'Very casual, like texting a friend. Keep it short.',
  sales:'Enthusiastic and sales-focused. Highlight value and encourage purchase.'
};

const CLASSIFY_KW = {
  price:['price','cost','how much','rate','charges','fee','pricing','discount','offer','deal'],
  stock:['available','in stock','stock','have it','left','quantity','sold out','restock'],
  order:['order','track','tracking','delivery','shipped','status','received','return','refund','exchange'],
  collab:['collab','collaborate','partnership','sponsor','promote','paid','pr','gifted','influencer'],
  complaint:['bad','worst','poor','disappointed','broken','damaged','late','issue','problem','complaint'],
  spam:['follow back','check my','dm me','free followers','giveaway'],
};

function classify(t){ const l=t.toLowerCase(); for(const[c,ks] of Object.entries(CLASSIFY_KW)) if(ks.some(k=>l.includes(k))) return c; return 'general'; }
function tagLabel(c){ return {price:'Price inquiry',stock:'Stock check',order:'Order status',collab:'Collab',complaint:'Complaint',spam:'Spam',general:'General'}[c]||c; }
function tagClass(c){ return 'tag tag-'+c; }
function avatarColor(n){ const cs=[['#FBEAF0','#72243E'],['#E6F1FB','#0C447C'],['#EAF3DE','#27500A'],['#EEEDFE','#3C3489'],['#FAEEDA','#633806']]; return cs[(n||'?').charCodeAt(0)%cs.length]; }
function initials(n){ return (n||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtTime(iso){ if(!iso) return ''; try{ const d=new Date(iso),now=new Date(),df=now-d; if(df<60000) return 'just now'; if(df<3600000) return Math.round(df/60000)+'m ago'; if(df<86400000) return Math.round(df/3600000)+'h ago'; return d.toLocaleDateString([],{month:'short',day:'numeric'}); }catch(e){ return iso; } }

function log(msg,type=''){
  const bar=document.getElementById('logBar'); bar.style.display='block';
  const now=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const d=document.getElementById('logEntries');
  const r=document.createElement('div'); r.className='log-row';
  r.innerHTML=`<span class="log-t">${now}</span><span class="${type==='ok'?'log-ok':type==='err'?'log-err':type==='warn'?'log-warn':''}">${esc(msg)}</span>`;
  d.prepend(r); if(d.children.length>25) d.removeChild(d.lastChild);
}

async function igGet(ep){ const r=await fetch(`https://graph.instagram.com/v21.0/${ep}${ep.includes('?')?'&':'?'}access_token=${G.token}`); if(!r.ok){const e=await r.json();throw new Error(e.error?.message||'API '+r.status);} return r.json(); }
async function igPost(ep,body){ const r=await fetch(`https://graph.instagram.com/v21.0/${ep}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,access_token:G.token})}); if(!r.ok){const e=await r.json();throw new Error(e.error?.message||'API '+r.status);} return r.json(); }

function setMain(html){ document.getElementById('mainArea').innerHTML=html; }
function setNavActive(tab){ document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active')); const el=document.getElementById('nav-'+tab); if(el) el.classList.add('active'); }

function showTab(tab){
  setNavActive(tab);
  if(tab==='bulk') renderBulk();
  else if(tab==='queue') renderQueue();
  else if(tab==='dms'){ if(G.connected) loadDMs(); else renderSettings(); }
  else if(tab==='comments'){ if(G.connected) loadComments(); else renderSettings(); }
  else if(tab==='catalog') renderCatalog();
  else if(tab==='stats') renderStats();
  else if(tab==='settings') renderSettings();
}

// ── BULK MESSAGE ──────────────────────────────────────────────────────────────
function renderBulk(){
  const tpl=G.selectedTemplate;
  const audienceSegments=[
    {id:'all_followers',label:'All recent contacts',desc:'Everyone who has messaged your page',count:G.dms.length||'—'},
    {id:'inquiries',label:'Product inquirers',desc:'People who asked about price or stock',count:G.dms.filter(d=>['price','stock'].includes(d.category)).length||'—'},
    {id:'no_reply',label:'Unanswered DMs',desc:'Conversations you haven\'t replied to',count:G.dms.filter(d=>!d.replied).length||'—'},
    {id:'complaint',label:'Complaints',desc:'Customers who raised an issue',count:G.dms.filter(d=>d.category==='complaint').length||'—'},
    {id:'custom_list',label:'Custom list',desc:'Paste usernames manually',count:'custom'},
  ];
  setMain(`
    <div class="toolbar">
      <i class="ti ti-speakerphone" style="font-size:16px;color:var(--color-pink)"></i>
      <span style="font-size:13px;font-weight:600;flex:1">Bulk message</span>
      <span style="font-size:11px;color:var(--color-text2)">Send personalised DMs to multiple people at once</span>
    </div>
    <div class="bulk-layout">
      <div class="bulk-left">
        <div class="section-hdr"><i class="ti ti-template"></i><span>1. Choose template</span></div>
        <div style="overflow-y:auto;flex:1">
          <div class="template-grid">
            ${FESTIVALS.map(f=>`
              <div class="tpl-card ${tpl&&tpl.id===f.id?'selected':''}" onclick="selectTemplate('${f.id}')">
                ${f.badge?`<div class="tpl-badge ${f.badge}">${f.badge}</div>`:''}
                <div class="tpl-emoji">${f.emoji}</div>
                <div class="tpl-name">${esc(f.name)}</div>
                <div class="tpl-desc">${esc(f.desc)}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>
      <div class="bulk-right">
        <div class="section-hdr"><i class="ti ti-pencil"></i><span>2. Compose & send</span></div>
        <div class="composer-area" id="composerArea">
          ${tpl?`
            <div>
              <label class="field-label">Message</label>
              <div class="var-pills">${['{name}','{discount}','{link}','{date}','{year}','{page}'].map(v=>`<span class="var-pill" onclick="insertVar('${v}')">${esc(v)}</span>`).join('')}</div>
              <textarea id="msgText" rows="6" oninput="updatePreview()">${esc(tpl.msg)}</textarea>
              <div class="char-count" id="charCount">${tpl.msg.length} chars</div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <div><label class="field-label">Page / your name</label><input id="varPage" type="text" placeholder="@yourpage" value="${esc(G.pageName)}" oninput="updatePreview()"></div>
              <div><label class="field-label">Discount</label><input id="varDiscount" type="text" placeholder="20% off" oninput="updatePreview()"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <div><label class="field-label">Link</label><input id="varLink" type="text" placeholder="https://..." oninput="updatePreview()"></div>
              <div><label class="field-label">Date / deadline</label><input id="varDate" type="text" placeholder="Oct 15" oninput="updatePreview()"></div>
            </div>
            <div><label class="field-label">Live preview</label><div class="preview-bubble" id="msgPreview">${esc(renderPreview(tpl.msg))}</div></div>
            <div>
              <label class="field-label">Audience</label>
              <div style="display:flex;flex-direction:column;gap:6px">
                ${audienceSegments.map(a=>`
                  <div class="audience-row ${G.bulkAudience.includes(a.id)?'checked':''}" onclick="toggleAudience('${a.id}',this)">
                    <input type="checkbox" ${G.bulkAudience.includes(a.id)?'checked':''} readonly>
                    <div class="audience-info"><div class="audience-name">${esc(a.label)}</div><div class="audience-meta">${esc(a.desc)}</div></div>
                    <div class="audience-count">${a.count}</div>
                  </div>`).join('')}
              </div>
            </div>
            ${G.bulkAudience.includes('custom_list')?`<div><label class="field-label">Custom usernames (one per line)</label><textarea id="customUsers" rows="3" placeholder="@username1&#10;@username2"></textarea></div>`:''}
            <div class="send-panel" style="border-top:none;padding:0;background:transparent">
              <div class="send-summary" id="sendSummary">${buildSendSummary()}</div>
              <div class="schedule-row">
                <label><input type="checkbox" id="scheduleChk" onchange="toggleSchedule()"> Schedule for later</label>
                <input type="datetime-local" id="scheduleTime" style="display:none">
              </div>
              <div style="display:flex;gap:8px;margin-top:4px">
                <button class="btn green" onclick="startBulkSend()" id="sendBtn"><i class="ti ti-send"></i> Send bulk message</button>
                <button class="btn amber" onclick="addToQueue()"><i class="ti ti-clock"></i> Add to queue</button>
              </div>
              <div id="sendProgress" style="display:none">
                <div class="progress-bar-wrap"><div class="progress-bar" id="progressBar" style="width:0%"></div></div>
                <div style="font-size:11px;color:var(--color-text2)" id="progressLabel">Preparing...</div>
              </div>
            </div>
          `:`<div class="empty-state" style="padding:30px"><i class="ti ti-template"></i><span>Select a template to start composing</span></div>`}
        </div>
      </div>
    </div>`);
}

function selectTemplate(id){ G.selectedTemplate=FESTIVALS.find(f=>f.id===id); G.bulkAudience=[]; renderBulk(); }

function insertVar(v){ const ta=document.getElementById('msgText'); if(!ta) return; const s=ta.selectionStart,e=ta.selectionEnd; ta.value=ta.value.slice(0,s)+v+ta.value.slice(e); ta.selectionStart=ta.selectionEnd=s+v.length; ta.focus(); updatePreview(); }

function renderPreview(msg){
  const page=document.getElementById('varPage')?.value||G.pageName||'yourpage';
  const discount=document.getElementById('varDiscount')?.value||'20% off';
  const link=document.getElementById('varLink')?.value||'yourshop.com';
  const date=document.getElementById('varDate')?.value||'this weekend';
  const year=new Date().getFullYear();
  return (msg||'').replace(/\{name\}/g,'Priya').replace(/\{discount\}/g,discount).replace(/\{link\}/g,link).replace(/\{date\}/g,date).replace(/\{page\}/g,page).replace(/\{year\}/g,year);
}

function updatePreview(){
  const ta=document.getElementById('msgText'),pre=document.getElementById('msgPreview'),cc=document.getElementById('charCount');
  if(!ta||!pre) return;
  if(G.selectedTemplate) G.selectedTemplate.msg=ta.value;
  pre.textContent=renderPreview(ta.value);
  if(cc) cc.textContent=ta.value.length+' chars';
  const s=document.getElementById('sendSummary'); if(s) s.innerHTML=buildSendSummary();
}

function toggleAudience(id,el){ const idx=G.bulkAudience.indexOf(id); if(idx>-1) G.bulkAudience.splice(idx,1); else G.bulkAudience.push(id); el.classList.toggle('checked',G.bulkAudience.includes(id)); el.querySelector('input').checked=G.bulkAudience.includes(id); updatePreview(); if(id==='custom_list') renderBulk(); }

function buildSendSummary(){ const count=estimateAudience(),tpl=G.selectedTemplate; if(!tpl) return 'No template selected.'; if(!G.bulkAudience.length) return 'Select an audience segment above.'; return `Sending <b>${esc(tpl.name)}</b> to approx. <b>${count} people</b>. Each message will be personalised with their name.`; }

function estimateAudience(){ let n=0; G.bulkAudience.forEach(id=>{ if(id==='all_followers') n+=Math.max(G.dms.length,1); else if(id==='inquiries') n+=G.dms.filter(d=>['price','stock'].includes(d.category)).length; else if(id==='no_reply') n+=G.dms.filter(d=>!d.replied).length; else if(id==='complaint') n+=G.dms.filter(d=>d.category==='complaint').length; else if(id==='custom_list'){ const ta=document.getElementById('customUsers'); n+=(ta?.value||'').split('\n').filter(l=>l.trim()).length; } else n+=1; }); return Math.max(n,G.bulkAudience.length?1:0); }

function toggleSchedule(){ const chk=document.getElementById('scheduleChk'),inp=document.getElementById('scheduleTime'); if(inp) inp.style.display=chk?.checked?'':'none'; }

function getRecipients(){ let list=[]; G.bulkAudience.forEach(id=>{ if(id==='all_followers') list=[...list,...G.dms]; else if(id==='inquiries') list=[...list,...G.dms.filter(d=>['price','stock'].includes(d.category))]; else if(id==='no_reply') list=[...list,...G.dms.filter(d=>!d.replied)]; else if(id==='complaint') list=[...list,...G.dms.filter(d=>d.category==='complaint')]; else if(id==='custom_list'){ const ta=document.getElementById('customUsers'); const users=(ta?.value||'').split('\n').map(l=>l.trim().replace('@','')).filter(Boolean); list=[...list,...users.map(u=>({sender:u,senderId:null,id:'custom_'+u}))]; } }); const seen=new Set(); return list.filter(r=>{ if(seen.has(r.id)) return false; seen.add(r.id); return true; }); }

async function startBulkSend(){
  if(G.sending){ log('Already sending','warn'); return; }
  const msgTemplate=document.getElementById('msgText')?.value?.trim();
  if(!msgTemplate){ alert('Write a message first'); return; }
  if(!G.bulkAudience.length){ alert('Select an audience segment'); return; }
  const recipients=getRecipients();
  if(!recipients.length){ alert('No recipients found. Load DMs first.'); return; }
  const schedChk=document.getElementById('scheduleChk'),schedTime=document.getElementById('scheduleTime')?.value;
  if(schedChk?.checked&&schedTime){ addToQueue(schedTime); return; }
  if(!confirm(`Send to ${recipients.length} people?`)) return;
  if(!G.connected){ alert('Connect your Instagram account first.'); return; }
  G.sending=true;
  const btn=document.getElementById('sendBtn'); if(btn){btn.disabled=true;btn.innerHTML='<div class="spinner"></div> Sending...';}
  const prog=document.getElementById('sendProgress'); if(prog) prog.style.display='block';
  let sent=0,failed=0;
  for(let i=0;i<recipients.length;i++){
    const r=recipients[i];
    const personalised=msgTemplate.replace(/\{name\}/g,r.sender?.split(' ')[0]||'there').replace(/\{discount\}/g,document.getElementById('varDiscount')?.value||'').replace(/\{link\}/g,document.getElementById('varLink')?.value||'').replace(/\{date\}/g,document.getElementById('varDate')?.value||'').replace(/\{page\}/g,G.pageName||document.getElementById('varPage')?.value||'').replace(/\{year\}/g,new Date().getFullYear());
    try{ if(r.senderId){ await igPost('me/messages',{recipient:{id:r.senderId},message:{text:personalised}}); } else { log(`Skipped @${r.sender} — no ID`,'warn'); } sent++; G.queue.push({id:Date.now()+i,recipient:r.sender,preview:personalised.slice(0,60),status:'sent',time:new Date().toISOString()}); }
    catch(e){ failed++; G.queue.push({id:Date.now()+i,recipient:r.sender,preview:personalised.slice(0,60),status:'failed',time:new Date().toISOString(),error:e.message}); log(`Failed ${r.sender}: ${e.message}`,'err'); }
    const pct=Math.round((i+1)/recipients.length*100);
    const pb=document.getElementById('progressBar'),pl=document.getElementById('progressLabel');
    if(pb) pb.style.width=pct+'%'; if(pl) pl.textContent=`Sent ${i+1} of ${recipients.length}${failed?' ('+failed+' failed)':''}`;
    await new Promise(res=>setTimeout(res,350));
  }
  G.sending=false;
  if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-send"></i> Send bulk message';}
  updateQueueBadge(); log(`Bulk send complete: ${sent} sent, ${failed} failed`,'ok'); alert(`Done! ${sent} sent${failed?', '+failed+' failed':''}.`);
}

function addToQueue(schedTime){
  const msgTemplate=document.getElementById('msgText')?.value?.trim(); if(!msgTemplate){alert('Write a message first');return;}
  const recipients=getRecipients(),tpl=G.selectedTemplate;
  G.queue.push({id:Date.now(),type:'bulk',name:tpl?.name||'Custom',recipient:`${recipients.length} recipients`,preview:msgTemplate.slice(0,60),status:schedTime?'scheduled':'pending',scheduledFor:schedTime||null,time:new Date().toISOString(),recipients,msgTemplate});
  updateQueueBadge(); log(`Added "${tpl?.name||'message'}" to queue`,'ok'); showTab('queue');
}

function updateQueueBadge(){ const b=document.getElementById('queueBadge'),pending=G.queue.filter(q=>q.status==='pending'||q.status==='scheduled').length; if(b){b.textContent=pending||'';b.className='nav-badge'+(pending?'':' g');} }

// ── QUEUE ─────────────────────────────────────────────────────────────────────
function renderQueue(){
  setMain(`
    <div class="toolbar"><i class="ti ti-list-check" style="font-size:16px;color:var(--color-pink)"></i><span style="font-size:13px;font-weight:600;flex:1">Message queue</span><button class="btn" onclick="G.queue=G.queue.filter(q=>q.status==='pending'||q.status==='scheduled');updateQueueBadge();renderQueue()"><i class="ti ti-trash"></i> Clear done</button></div>
    <div class="pane">
      ${G.queue.length?`<div style="padding:10px 16px;display:flex;flex-direction:column;gap:8px">${G.queue.slice().reverse().map((q,i)=>`
        <div class="queue-item">
          <div><span class="queue-status qs-${q.status}">${q.status}</span>${q.scheduledFor?`<div style="font-size:10px;color:var(--color-text3);margin-top:3px"><i class="ti ti-clock"></i> ${esc(q.scheduledFor)}</div>`:''}</div>
          <div class="queue-body"><div class="queue-name">${esc(q.name||q.recipient)} ${q.type==='bulk'?`<span style="font-size:10px;color:var(--color-text3)">(${esc(q.recipient)})</span>`:''}</div><div class="queue-preview">${esc(q.preview)}…</div>${q.error?`<div style="font-size:10px;color:var(--color-danger-text)">${esc(q.error)}</div>`:''}</div>
          <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end"><span class="queue-time">${fmtTime(q.time)}</span>${q.status==='pending'?`<button class="btn green" style="padding:4px 8px;font-size:11px" onclick="sendQueueItem(${G.queue.length-1-i})"><i class="ti ti-send"></i> Send</button>`:''}</div>
        </div>`).join('')}</div>`
      :'<div class="empty-state"><i class="ti ti-list-check"></i><span>Queue is empty — add bulk messages from the Bulk message tab</span></div>'}
    </div>`);
}

async function sendQueueItem(i){ const item=G.queue[i]; if(!item||item.status!=='pending') return; if(!G.connected){alert('Connect Instagram first');return;} item.status='sent'; updateQueueBadge(); renderQueue(); log(`Sent queued "${item.name}"`,'ok'); }

// ── DMs ───────────────────────────────────────────────────────────────────────
async function loadDMs(){
  if(!G.connected){showTab('settings');return;}
  setMain('<div style="padding:20px 16px;display:flex;align-items:center;gap:8px;font-size:12px;color:var(--color-text2)"><div class="spinner"></div> Loading DMs...</div>');
  log('Fetching DMs...');
  try{
    const data=await igGet(`${G.pageId}/conversations?platform=instagram&fields=id,updated_time,participants,messages{message,from,created_time}`);
    G.dms=(data.data||[]).map(c=>{ const msgs=c.messages?.data||[],lm=msgs[0]||{},other=(c.participants?.data||[]).find(p=>p.id!==G.pageId)||(c.participants?.data||[])[0]||{},text=lm.message||''; return{id:c.id,updatedTime:c.updated_time,sender:other.name||other.username||'User'+c.id.slice(-4),senderId:other.id,lastMessage:text,category:classify(text),messages:msgs.map(m=>({text:m.message,from:m.from?.id===G.pageId?'us':'them',time:m.created_time})).reverse(),unread:true,replied:false}; });
    document.getElementById('dmBadge').textContent=G.dms.filter(d=>d.unread).length||'';
    renderDMsView(); log(`Loaded ${G.dms.length} conversations`,'ok');
  }catch(e){ setMain(`<div class="empty-state"><i class="ti ti-alert-circle"></i><span style="color:var(--color-danger-text)">${esc(e.message)}</span></div>`); log('DMs failed: '+e.message,'err'); }
}

function renderDMsView(){
  setMain(`
    <div class="toolbar"><input type="text" id="dmSearch" placeholder="Search conversations..." oninput="filterDMs(this.value)" style="flex:1"><button class="btn" onclick="loadDMs()"><i class="ti ti-refresh"></i></button></div>
    <div style="display:flex;flex:1;overflow:hidden;min-height:500px">
      <div class="pane" id="dmList" style="flex:1;overflow-y:auto">
        ${G.dms.length?G.dms.map((d,i)=>`
          <div class="msg-item ${d.unread?'unread':''}" onclick="selectDM(${i})">
            <div class="${d.unread?'unread-dot':'read-spc'}"></div>
            <div class="avatar" style="background:${avatarColor(d.sender)[0]};color:${avatarColor(d.sender)[1]}">${esc(initials(d.sender))}</div>
            <div class="msg-body">
              <div class="msg-row1"><span class="msg-sender">${esc(d.sender)}</span><span class="msg-time">${fmtTime(d.updatedTime)}</span></div>
              <div class="msg-preview">${esc(d.lastMessage)}</div>
              <div style="display:flex;gap:4px;margin-top:2px"><span class="${tagClass(d.category)}">${tagLabel(d.category)}</span>${d.replied?'<span class="tag" style="background:var(--color-success-bg);color:var(--color-success-text)">Replied</span>':''}</div>
            </div>
          </div>`).join(''):'<div class="empty-state"><i class="ti ti-inbox"></i><span>No conversations</span></div>'}
      </div>
      <div class="detail" id="dmDetail"><div class="empty-state"><i class="ti ti-message-2"></i><span>Select a conversation</span></div></div>
    </div>`);
}

function filterDMs(q){ document.querySelectorAll('.msg-item').forEach(el=>{ el.style.display=el.textContent.toLowerCase().includes(q.toLowerCase())?'':'none'; }); }

function selectDM(i){
  G.selectedDmIdx=i; const dm=G.dms[i]; dm.unread=false;
  const det=document.getElementById('dmDetail'); if(!det) return;
  const [bg,fg]=avatarColor(dm.sender);
  det.innerHTML=`
    <div class="detail-hdr">
      <div style="display:flex;align-items:center;gap:9px">
        <div class="avatar" style="background:${bg};color:${fg}">${esc(initials(dm.sender))}</div>
        <div><div style="font-size:13px;font-weight:600">${esc(dm.sender)}</div><div style="font-size:11px;color:var(--color-text2)">${tagLabel(dm.category)}</div></div>
      </div>
    </div>
    <div class="thread" id="dmThread">
      ${dm.messages.map(m=>`<div><div class="bubble ${m.from}">${esc(m.text)}</div><div class="bubble-time" style="text-align:${m.from==='us'?'right':'left'}">${fmtTime(m.time)}</div></div>`).join('')}
    </div>
    <div class="reply-area">
      <div class="reply-label"><i class="ti ti-sparkles"></i> Draft</div>
      <textarea class="draft-text" id="draftText" rows="3">${esc(genDraft(dm))}</textarea>
      <div class="reply-actions">
        <button class="btn green" onclick="sendDM(${i})"><i class="ti ti-send"></i> Send</button>
        <button class="btn" onclick="document.getElementById('draftText').value=genDraft(G.dms[${i}])"><i class="ti ti-refresh"></i></button>
        <button class="btn" onclick="navigator.clipboard?.writeText(document.getElementById('draftText').value)"><i class="ti ti-copy"></i></button>
      </div>
    </div>`;
  const th=document.getElementById('dmThread'); if(th) th.scrollTop=th.scrollHeight;
  document.querySelectorAll('.msg-item').forEach((el,j)=>el.classList.toggle('selected',j===i));
}

function genDraft(dm){ const cat=dm.category,name=dm.sender.split(' ')[0],msg=dm.lastMessage,match=G.catalog.find(p=>msg.toLowerCase().includes(p.name.toLowerCase())); if(cat==='price'){ if(match) return `Hi ${name}! 👋 Thanks for your interest in ${match.name}. It's priced at ${match.price}. ${match.stock>0?'We have it in stock and ready to ship! 🛍️':'Currently out of stock but restocking soon!'} DM us to order!`; return `Hi ${name}! Which product are you asking about? We'd love to share the price! 😊`; } if(cat==='stock'){ if(match) return `Hey ${name}! ${match.name} is ${match.stock>0?`in stock — ${match.stock} units available! 🎉`:'out of stock right now. Want us to notify you when it\'s back?'}`; return `Hi ${name}! Which item are you looking for?`; } if(cat==='order') return `Hi ${name}! Please share your order number and we'll look into this immediately. 🙏`; if(cat==='collab') return `Hi ${name}! 👋 Thanks for reaching out about a collab! Could you share your media kit or more details?`; if(cat==='complaint') return `Hi ${name}, we're really sorry about this. Please share more details so we can make it right. 🙏`; return `Hi ${name}! Thanks for reaching out. How can we help you today? 😊`; }

async function sendDM(i){ const text=document.getElementById('draftText')?.value?.trim(); if(!text||!confirm('Send this reply?')) return; const dm=G.dms[i]; try{ await igPost('me/messages',{recipient:{id:dm.senderId},message:{text}}); dm.replied=true; dm.messages.push({text,from:'us',time:new Date().toISOString()}); selectDM(i); log(`Sent to ${dm.sender}`,'ok'); } catch(e){ log('Send failed: '+e.message,'err'); alert('Failed: '+e.message); } }

// ── COMMENTS ──────────────────────────────────────────────────────────────────
async function loadComments(){
  if(!G.connected){showTab('settings');return;}
  setMain('<div style="padding:20px 16px;display:flex;align-items:center;gap:8px;font-size:12px;color:var(--color-text2)"><div class="spinner"></div> Loading comments...</div>');
  log('Fetching media & comments...');
  try{
    const media=await igGet(`${G.pageId}/media?fields=id,caption,media_type,timestamp&limit=10`);
    let allComments=[];
    for(const post of (media.data||[]).slice(0,5)){ try{ const cmts=await igGet(`${post.id}/comments?fields=id,text,username,timestamp`); (cmts.data||[]).forEach(c=>{ allComments.push({...c,postCaption:(post.caption||'').slice(0,40),postId:post.id,category:classify(c.text)}); }); }catch(e2){} }
    G.comments=allComments; document.getElementById('cmtBadge').textContent=allComments.length||'';
    renderCommentsView(); log(`Loaded ${allComments.length} comments`,'ok');
  }catch(e){ setMain(`<div class="empty-state"><i class="ti ti-alert-circle"></i><span style="color:var(--color-danger-text)">${esc(e.message)}</span></div>`); log('Comments failed: '+e.message,'err'); }
}

function renderCommentsView(){
  setMain(`
    <div class="toolbar"><input type="text" placeholder="Filter comments..." oninput="filterComments(this.value)" style="flex:1"><button class="btn" onclick="loadComments()"><i class="ti ti-refresh"></i> Refresh</button></div>
    <div class="pane" id="cmtList">
      ${G.comments.length?G.comments.map((c,i)=>`
        <div class="comment-item">
          <div class="comment-header">
            <div class="avatar" style="width:26px;height:26px;font-size:10px;background:${avatarColor(c.username||'?')[0]};color:${avatarColor(c.username||'?')[1]}">${esc(initials(c.username||'?'))}</div>
            <span style="font-size:12px;font-weight:600">@${esc(c.username||'user')}</span>
            <span style="font-size:11px;color:var(--color-text3)">${esc(c.postCaption||'post')}…</span>
            <span class="${tagClass(c.category)}" style="margin-left:auto">${tagLabel(c.category)}</span>
          </div>
          <div style="font-size:12px;line-height:1.5;margin-bottom:6px">${esc(c.text)}</div>
          <div style="display:flex;gap:6px;align-items:center">
            <input class="comment-reply-input" id="creply-${i}" type="text" value="${esc(genCommentReply(c))}">
            <button class="btn green" onclick="sendComment(${i})"><i class="ti ti-send"></i> Reply</button>
            <button class="btn" onclick="hideComment(${i})" title="Hide"><i class="ti ti-eye-off"></i></button>
          </div>
        </div>`).join(''):'<div class="empty-state"><i class="ti ti-message-dots"></i><span>No comments found</span></div>'}
    </div>`);
}

function genCommentReply(c){ const name=c.username||'there',cat=c.category; if(cat==='price') return `Hi @${name}! DM us for pricing info 💬`; if(cat==='stock') return `Hi @${name}! DM us to check availability 🛍️`; if(cat==='complaint') return `Hi @${name}, we're sorry — please DM us so we can resolve this 🙏`; if(cat==='collab') return `Hi @${name}! Please DM us with your details 📩`; return `Thanks for your comment @${name}! 🙏`; }
function filterComments(q){ document.querySelectorAll('.comment-item').forEach(el=>{ el.style.display=el.textContent.toLowerCase().includes(q.toLowerCase())?'':'none'; }); }
async function sendComment(i){ const cmt=G.comments[i],text=document.getElementById(`creply-${i}`)?.value?.trim(); if(!text) return; log(`Replying to @${cmt.username}...`); try{ await igPost(`${cmt.id}/replies`,{message:text}); log(`Reply sent to @${cmt.username}`,'ok'); document.getElementById(`creply-${i}`).value=''; }catch(e){ log('Reply failed: '+e.message,'err'); alert('Reply failed: '+e.message); } }
async function hideComment(i){ const cmt=G.comments[i]; log(`Hiding comment by @${cmt.username}...`); try{ await igPost(`${cmt.id}`,{is_hidden:true}); G.comments.splice(i,1); renderCommentsView(); log('Comment hidden','ok'); }catch(e){ log('Hide failed: '+e.message,'err'); } }

// ── CATALOG ───────────────────────────────────────────────────────────────────
function renderCatalog(){
  setMain(`
    <div class="toolbar"><span style="font-size:13px;font-weight:600;flex:1">Product catalog</span><button class="btn pink" onclick="showAddProduct()"><i class="ti ti-plus"></i> Add product</button></div>
    <div class="pane" style="padding:12px 16px;display:flex;flex-direction:column;gap:8px">
      ${G.catalog.length?G.catalog.map((p,i)=>`
        <div style="background:var(--color-bg);border:0.5px solid var(--color-border);border-radius:var(--radius-lg);padding:11px 13px;display:flex;gap:10px;align-items:flex-start">
          <div style="width:40px;height:40px;border-radius:var(--radius);background:var(--color-bg2);display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="ti ti-package" style="font-size:18px;color:var(--color-text3)"></i></div>
          <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600">${esc(p.name)}</div><div style="font-size:12px;color:var(--color-success-text);font-weight:600">${esc(p.price)}</div><div style="font-size:11px;color:var(--color-text3)">${p.stock>0?p.stock+' in stock':'Out of stock'}</div>${p.description?`<div style="font-size:11px;color:var(--color-text2);margin-top:2px">${esc(p.description)}</div>`:''}</div>
          <button class="btn" style="padding:4px 8px" onclick="G.catalog.splice(${i},1);renderCatalog()"><i class="ti ti-trash" style="font-size:13px"></i></button>
        </div>`).join(''):'<div class="empty-state"><i class="ti ti-shopping-bag"></i><span>Add products so the agent can answer inquiries accurately</span></div>'}
      <div id="addProductForm" style="display:none;border:0.5px solid var(--color-border);border-radius:var(--radius-lg);padding:12px;background:var(--color-bg2)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div><label style="font-size:11px;color:var(--color-text2);display:block;margin-bottom:3px">Product name</label><input id="pName" type="text" style="width:100%;font-size:12px;padding:6px 9px;border-radius:var(--radius);border:0.5px solid var(--color-border);background:var(--color-bg);color:var(--color-text);font-family:inherit" placeholder="e.g. Silk Scrunchie Set"></div>
          <div><label style="font-size:11px;color:var(--color-text2);display:block;margin-bottom:3px">Price</label><input id="pPrice" type="text" style="width:100%;font-size:12px;padding:6px 9px;border-radius:var(--radius);border:0.5px solid var(--color-border);background:var(--color-bg);color:var(--color-text);font-family:inherit" placeholder="NPR 450"></div>
        </div>
        <div style="margin-bottom:8px"><label style="font-size:11px;color:var(--color-text2);display:block;margin-bottom:3px">Stock qty</label><input id="pStock" type="number" min="0" style="width:100%;font-size:12px;padding:6px 9px;border-radius:var(--radius);border:0.5px solid var(--color-border);background:var(--color-bg);color:var(--color-text);font-family:inherit" placeholder="0"></div>
        <div style="display:flex;gap:6px"><button class="btn pink" onclick="addProduct()"><i class="ti ti-plus"></i> Add</button><button class="btn" onclick="document.getElementById('addProductForm').style.display='none'">Cancel</button></div>
      </div>
    </div>`);
}
function showAddProduct(){ document.getElementById('addProductForm').style.display='block'; document.getElementById('pName').focus(); }
function addProduct(){ const n=document.getElementById('pName').value.trim(),p=document.getElementById('pPrice').value.trim(),s=parseInt(document.getElementById('pStock').value)||0; if(!n||!p){alert('Name and price required');return;} G.catalog.push({name:n,price:p,stock:s}); renderCatalog(); log('Added: '+n,'ok'); }

// ── STATS ─────────────────────────────────────────────────────────────────────
function renderStats(){
  const total=G.dms.length,replied=G.dms.filter(d=>d.replied).length,qSent=G.queue.filter(q=>q.status==='sent').length,byC={};
  G.dms.forEach(d=>{byC[d.category]=(byC[d.category]||0)+1;});
  const rate=total>0?Math.round(replied/total*100):0;
  setMain(`
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">Total DMs</div><div class="stat-val">${total}</div></div>
      <div class="stat-card"><div class="stat-label">Replied</div><div class="stat-val">${replied}</div></div>
      <div class="stat-card"><div class="stat-label">Reply rate</div><div class="stat-val">${rate}%</div></div>
      <div class="stat-card"><div class="stat-label">Bulk sent</div><div class="stat-val">${qSent}</div></div>
    </div>
    <div style="padding:0 16px 16px">
      <div style="font-size:12px;font-weight:600;margin-bottom:10px;color:var(--color-text2)">DM breakdown by category</div>
      ${Object.entries(byC).sort((a,b)=>b[1]-a[1]).map(([c,n])=>`
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span class="${tagClass(c)}" style="min-width:100px">${tagLabel(c)}</span>
          <div style="flex:1;height:6px;background:var(--color-bg2);border-radius:3px;overflow:hidden"><div style="height:100%;width:${total>0?Math.round(n/total*100):0}%;background:var(--color-pink);border-radius:3px"></div></div>
          <span style="font-size:12px;color:var(--color-text2);min-width:24px;text-align:right">${n}</span>
        </div>`).join('')||'<div style="font-size:12px;color:var(--color-text3)">Load DMs to see stats</div>'}
    </div>`);
}

// ── SETTINGS / GUIDED SETUP ───────────────────────────────────────────────────
const SETUP_STEPS = [
  {
    id:'meta_app',
    icon:'ti-brand-meta',
    title:'Create a Meta App',
    short:'Meta App',
    desc:'You need a free Meta developer account and a new app to access the Instagram API.',
    actions:[
      {label:'Open Meta for Developers', url:'https://developers.facebook.com/apps/create/', primary:true},
      {label:'What is a Meta App?', url:'https://developers.facebook.com/docs/development/create-an-app/'},
    ],
    instructions:[
      'Go to developers.facebook.com and log in with your Facebook account',
      'Click "My Apps" → "Create App"',
      'Choose "Other" as use case, then "Business" as app type',
      'Give your app any name (e.g. "Page Manager") and click Create',
      'Once created, come back here and continue to Step 2',
    ],
    tip:'Use the same Facebook account that owns your Instagram Business page.'
  },
  {
    id:'instagram_product',
    icon:'ti-brand-instagram',
    title:'Add Instagram to your app',
    short:'Instagram product',
    desc:'Connect your Instagram Professional account to the Meta app.',
    actions:[
      {label:'Open App Dashboard', url:'https://developers.facebook.com/apps/', primary:true},
      {label:'Instagram API docs', url:'https://developers.facebook.com/docs/instagram-platform/'},
    ],
    instructions:[
      'Inside your app, go to "Add a Product" on the left sidebar',
      'Find "Instagram" and click "Set up"',
      'Under "Instagram accounts", click "Add account" and log in to your Instagram',
      'Make sure your Instagram is a Professional account (Business or Creator)',
      'Note your Instagram Business Account ID shown on this page — you\'ll need it in Step 4',
    ],
    tip:'Your account must be a Business or Creator account, not a personal one. Switch in Instagram → Settings → Account → Switch to Professional.'
  },
  {
    id:'permissions',
    icon:'ti-shield-check',
    title:'Add required permissions',
    short:'Permissions',
    desc:'Grant the permissions needed for reading DMs, comments, and sending messages.',
    actions:[
      {label:'Open App Permissions', url:'https://developers.facebook.com/apps/', primary:true},
      {label:'Permissions reference', url:'https://developers.facebook.com/docs/permissions/'},
    ],
    instructions:[
      'In your app, go to "App Review" → "Permissions and Features"',
      'Search for and add each permission below',
      'For testing: click "Get advanced access" on each — this skips review for your own account',
      'You do NOT need to submit for App Review to use this with your own page',
    ],
    permissions:['instagram_manage_messages','instagram_manage_comments','pages_read_engagement','instagram_basic','pages_messaging'],
    tip:'You only need App Review if you want OTHER people\'s accounts to use your app. For your own page, advanced access is enough.'
  },
  {
    id:'token',
    icon:'ti-key',
    title:'Generate your access token',
    short:'Access token',
    desc:'Create a long-lived token that the app uses to talk to your Instagram account.',
    actions:[
      {label:'Open Graph API Explorer', url:'https://developers.facebook.com/tools/explorer/', primary:true},
      {label:'Token Debugger (verify token)', url:'https://developers.facebook.com/tools/debug/accesstoken/'},
      {label:'Generate long-lived token', url:'https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/'},
    ],
    instructions:[
      'Go to the Graph API Explorer (button above)',
      'Select your app from the "Meta App" dropdown at the top right',
      'Click "Generate Access Token" — log in and grant permissions',
      'Copy the token shown (starts with EAA...)',
      'To make it long-lived (60 days): use the Token Debugger link above, or exchange it via the API',
      'Paste the token and your Account ID in the fields below, then click Connect',
    ],
    tip:'Short-lived tokens expire in 1 hour. Use the long-lived token exchange (linked above) to get a 60-day token. System user tokens never expire.'
  }
];

let G_setupStep = G.connected ? 4 : 0;

function renderSettings(){
  const step = G_setupStep;
  const isComplete = G.connected;

  const stepNav = SETUP_STEPS.map((s,i)=>`
    <div onclick="G_setupStep=${i};renderSettings()" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:var(--radius);cursor:pointer;background:${step===i?'var(--color-bg)':'transparent'};border:${step===i?'0.5px solid var(--color-border)':'0.5px solid transparent'}">
      <div style="width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;background:${isComplete||i<step?'var(--color-green)':step===i?'var(--color-pink)':'var(--color-bg3)'};color:${isComplete||i<step?'white':step===i?'white':'var(--color-text3)'}">
        ${isComplete||i<step?'<i class="ti ti-check" style="font-size:12px"></i>':i+1}
      </div>
      <span style="font-size:12px;font-weight:${step===i?'600':'400'};color:${step===i?'var(--color-text)':'var(--color-text2)'}">${s.short}</span>
    </div>`).join('');

  const s = SETUP_STEPS[step] || SETUP_STEPS[3];

  const instructionHTML = s.instructions.map((ins,i)=>`
    <div style="display:flex;gap:10px;align-items:flex-start;padding:6px 0;border-bottom:0.5px solid var(--color-border)">
      <div style="width:20px;height:20px;border-radius:50%;background:var(--color-bg3);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--color-text2);flex-shrink:0;margin-top:1px">${i+1}</div>
      <span style="font-size:12px;color:var(--color-text);line-height:1.6">${esc(ins)}</span>
    </div>`).join('');

  const permHTML = s.permissions ? `
    <div style="margin:10px 0 6px;font-size:11px;font-weight:600;color:var(--color-text2);text-transform:uppercase;letter-spacing:.05em">Required permissions</div>
    <div style="display:flex;flex-direction:column;gap:4px">
      ${s.permissions.map(p=>`
        <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:var(--color-bg2);border-radius:var(--radius);font-size:12px">
          <span style="display:flex;align-items:center;gap:7px"><i class="ti ti-lock" style="font-size:13px;color:var(--color-text3)"></i>${p}</span>
          <button onclick="copyText('${p}')" style="background:none;border:none;cursor:pointer;color:var(--color-text3);font-size:12px;display:flex;align-items:center;gap:3px;font-family:inherit"><i class="ti ti-copy" style="font-size:13px"></i></button>
        </div>`).join('')}
    </div>` : '';

  const actionHTML = s.actions.map(a=>`
    <a href="${a.url}" target="_blank" rel="noopener" style="text-decoration:none">
      <button class="btn ${a.primary?'pink':''}" style="${a.primary?'':''}">
        <i class="ti ti-external-link"></i> ${esc(a.label)}
      </button>
    </a>`).join('');

  const tokenForm = step === 3 ? `
    <div style="margin-top:14px;padding-top:14px;border-top:0.5px solid var(--color-border)">
      <div style="font-size:12px;font-weight:600;color:var(--color-text);margin-bottom:10px;display:flex;align-items:center;gap:7px"><i class="ti ti-plug" style="font-size:15px;color:var(--color-pink)"></i> Paste your credentials</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="flex:1">
          <label style="font-size:11px;color:var(--color-text2);display:block;margin-bottom:3px">Access token <span style="color:var(--color-text3)">(starts with EAA…)</span></label>
          <div style="display:flex;gap:6px">
            <input id="inToken" type="password" placeholder="EAAxxxxxxxxxxxxxx..." value="${esc(G.token)}" style="flex:1;font-size:12px;padding:7px 10px;border-radius:var(--radius);border:0.5px solid var(--color-border);background:var(--color-bg2);color:var(--color-text);font-family:inherit">
            <button class="btn" onclick="toggleTokenVis()" id="tokenVisBtn" title="Show/hide token"><i class="ti ti-eye" id="tokenVisIcon"></i></button>
          </div>
        </div>
      </div>
      <div style="margin-bottom:10px">
        <label style="font-size:11px;color:var(--color-text2);display:block;margin-bottom:3px">Instagram Business Account ID <span style="color:var(--color-text3)">(17841…)</span></label>
        <div style="display:flex;gap:6px">
          <input id="inPageId" type="text" placeholder="17841xxxxxxxxxx" value="${esc(G.pageId)}" style="flex:1;font-size:12px;padding:7px 10px;border-radius:var(--radius);border:0.5px solid var(--color-border);background:var(--color-bg2);color:var(--color-text);font-family:inherit">
          <a href="https://www.facebook.com/help/1558356551275731" target="_blank" rel="noopener" style="text-decoration:none"><button class="btn" title="How to find my Account ID"><i class="ti ti-help"></i></button></a>
        </div>
        <div style="font-size:11px;color:var(--color-text3);margin-top:4px"><i class="ti ti-info-circle" style="font-size:12px;vertical-align:-1px"></i> Found in Meta Business Settings → Accounts → Instagram, or in the Graph API Explorer URL after connecting.</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn pink" onclick="connect()" id="connectBtn"><i class="ti ti-plug"></i> Connect to Instagram</button>
        <a href="https://developers.facebook.com/tools/debug/accesstoken/" target="_blank" rel="noopener" style="text-decoration:none"><button class="btn"><i class="ti ti-shield-check"></i> Verify token</button></a>
      </div>
      ${G.connected?`<div style="margin-top:10px;padding:8px 12px;background:var(--color-success-bg);border-radius:var(--radius);font-size:12px;color:var(--color-success-text);display:flex;align-items:center;gap:7px"><i class="ti ti-circle-check" style="font-size:15px"></i> Connected as <strong>${esc(G.pageName)}</strong></div>`:''}
    </div>` : `
    <div style="margin-top:12px">
      <button class="btn pink" onclick="G_setupStep=${step+1};renderSettings()">Continue to step ${step+2} <i class="ti ti-arrow-right"></i></button>
    </div>`;

  setMain(`
    <div style="display:flex;flex:1;overflow:hidden;min-height:560px">

      <div style="width:170px;min-width:170px;border-right:0.5px solid var(--color-border);padding:14px 8px;display:flex;flex-direction:column;gap:2px;background:var(--color-bg2)">
        <div style="font-size:10px;font-weight:600;color:var(--color-text3);text-transform:uppercase;letter-spacing:.06em;padding:4px 10px 8px">Setup guide</div>
        ${stepNav}
        ${isComplete?`<div style="margin-top:auto;padding-top:12px;border-top:0.5px solid var(--color-border)">
          <div onclick="renderToneSettings()" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:var(--radius);cursor:pointer;color:var(--color-text2)" class="nav-item"><i class="ti ti-adjustments"></i> Preferences</div>
        </div>`:''}
      </div>

      <div style="flex:1;overflow-y:auto;padding:16px 20px">

        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:16px">
          <div style="width:40px;height:40px;border-radius:var(--radius);background:${isComplete?'var(--color-success-bg)':'var(--color-bg3)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="ti ${isComplete?'ti-circle-check':s.icon}" style="font-size:20px;color:${isComplete?'var(--color-green)':'var(--color-pink)'}"></i>
          </div>
          <div>
            <div style="font-size:15px;font-weight:600;margin-bottom:3px">Step ${step+1} of 4 — ${esc(s.title)}</div>
            <div style="font-size:12px;color:var(--color-text2);line-height:1.5">${esc(s.desc)}</div>
          </div>
        </div>

        <div style="background:var(--color-bg2);border-radius:var(--radius-lg);padding:12px 14px;margin-bottom:14px">
          <div style="font-size:11px;font-weight:600;color:var(--color-text2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">What to do</div>
          ${instructionHTML}
        </div>

        ${permHTML}

        <div style="margin:12px 0;display:flex;gap:8px;flex-wrap:wrap">${actionHTML}</div>

        ${s.tip?`<div style="background:var(--color-warn-bg);border-radius:var(--radius);padding:9px 12px;font-size:12px;color:var(--color-warn-text);display:flex;gap:8px;align-items:flex-start;margin-bottom:12px"><i class="ti ti-bulb" style="font-size:15px;flex-shrink:0;margin-top:1px"></i><span>${esc(s.tip)}</span></div>`:''}

        ${tokenForm}
      </div>
    </div>`);
}

function renderToneSettings(){
  setMain(`
    <div style="padding:16px 20px;overflow-y:auto;flex:1">
      <div style="font-size:15px;font-weight:600;margin-bottom:14px;display:flex;align-items:center;gap:8px"><i class="ti ti-adjustments" style="color:var(--color-pink)"></i> Preferences</div>
      <div class="setup-card">
        <h3><i class="ti ti-pencil"></i> Default reply tone</h3>
        <p>How should the agent sound when drafting replies to DMs and comments?</p>
        <div class="tone-pills">${Object.keys(TONES).map(t=>`<button class="tone-pill ${G.tone===t?'active':''}" onclick="G.tone='${t}';renderToneSettings()">${t.charAt(0).toUpperCase()+t.slice(1)}</button>`).join('')}</div>
        <div style="font-size:12px;color:var(--color-text2);background:var(--color-bg2);padding:7px 10px;border-radius:var(--radius)">${esc(TONES[G.tone])}</div>
      </div>
      <div class="setup-card">
        <h3><i class="ti ti-brand-instagram"></i> Connected account</h3>
        ${G.connected?`
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--color-success-bg);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--color-success-text)">${esc(initials(G.pageName))}</div>
            <div><div style="font-size:13px;font-weight:600">${esc(G.pageName)}</div><div style="font-size:11px;color:var(--color-text2)">ID: ${esc(G.pageId)}</div></div>
          </div>
          <button class="btn" onclick="G.connected=false;G.token='';G.pageId='';G.pageName='';G_setupStep=3;renderSettings()"><i class="ti ti-unlink"></i> Disconnect & reconnect</button>`
        :`<p>Not connected. <button class="btn pink" onclick="G_setupStep=3;renderSettings()"><i class="ti ti-plug"></i> Connect now</button></p>`}
      </div>
    </div>`);
}

function toggleTokenVis(){
  const inp=document.getElementById('inToken'),icon=document.getElementById('tokenVisIcon');
  if(!inp) return;
  inp.type=inp.type==='password'?'text':'password';
  if(icon) icon.className=inp.type==='password'?'ti ti-eye':'ti ti-eye-off';
}

function copyText(t){ navigator.clipboard?.writeText(t).then(()=>log('Copied: '+t,'ok')); }

async function connect(){
  const t=document.getElementById('inToken')?.value?.trim(),p=document.getElementById('inPageId')?.value?.trim();
  if(!t){ alert('Paste your access token first'); return; }
  if(!p){ alert('Paste your Instagram Business Account ID first'); return; }
  const btn=document.getElementById('connectBtn');
  if(btn){btn.disabled=true;btn.innerHTML='<div class="spinner"></div> Connecting...';}
  G.token=t; G.pageId=p; log('Connecting to Instagram Graph API...');
  try{
    const info=await igGet(`${p}?fields=name,username,followers_count,media_count`);
    G.pageName=info.name||info.username||p; G.connected=true; G_setupStep=3;
    document.getElementById('connBadge').className='conn-badge ok';
    document.getElementById('connBadge').innerHTML=`<div class="dot"></div> ${esc(G.pageName)}`;
    log(`Connected as ${G.pageName} (${info.followers_count||0} followers)`,'ok');
    renderSettings();
    setTimeout(()=>showTab('dms'),800);
  }catch(e){
    log('Connection failed: '+e.message,'err');
    if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-plug"></i> Connect to Instagram';}
    const errDiv=document.createElement('div');
    errDiv.style.cssText='margin-top:8px;padding:8px 12px;background:var(--color-danger-bg);border-radius:var(--radius);font-size:12px;color:var(--color-danger-text)';
    errDiv.innerHTML=`<i class="ti ti-alert-circle"></i> ${esc(e.message)} — double-check your token and Account ID.`;
    btn?.parentElement?.appendChild(errDiv);
  }
}

// Init
renderSettings();
