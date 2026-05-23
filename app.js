// ─────────────────────────────────────────────────────────────────────────────
//  Instagram Page Manager — app.js
//  Graph API calls use a CORS proxy so they work from the browser.
//  Proxy: https://corsproxy.io/?  (free, no-auth, just prepend to the URL)
// ─────────────────────────────────────────────────────────────────────────────

const G = {
  token:'', pageId:'', pageName:'', pageUsername:'', followers:0,
  tone:'friendly', catalog:[], dms:[], comments:[],
  selectedDmIdx:-1, connected:false,
  queue:[], selectedTemplate:null, bulkAudience:[], sending:false
};

let G_setupStep = 0;

// ── FESTIVALS ─────────────────────────────────────────────────────────────────
const FESTIVALS = [
  {id:'dashain',emoji:'🎑',name:'Dashain',desc:'Tika & blessing wishes',badge:'',
   msg:`Happy Dashain! 🎑✨\n\nWishing you and your family the blessings of Goddess Durga — may this festival bring joy, prosperity, and good health. 🙏\n\nAs a special Dashain gift, we're offering {discount} off all orders this week! Use code DASHAIN.\n\nShop now 👉 {link}`},
  {id:'tihar',emoji:'🪔',name:'Tihar',desc:'Festival of lights',badge:'',
   msg:`Happy Tihar! 🪔🌸\n\nMay the festival of lights illuminate your life with happiness and success. Wishing you a blessed Tihar from all of us! 🙏\n\nCelebrate with {discount} off sitewide — offer ends {date}.\n\nOrder here 👉 {link}`},
  {id:'newyear',emoji:'🎆',name:'New Year',desc:'New Year greetings + offer',badge:'new',
   msg:`Happy New Year! 🎆🥂\n\nThank you so much for your support — it means everything. Wishing you a fantastic {year}! 🙏\n\nEnjoy {discount} off your next order with code NY{year}.\n\nShop 👉 {link}`},
  {id:'sale',emoji:'🛍️',name:'Flash sale',badge:'sale',desc:'Limited-time sale blast',
   msg:`Hey {name}! 👋\n\n⚡ FLASH SALE — {discount} off everything for 48 hours only!\n\nStock is limited so grab yours before it sells out 🔥\n\nShop now 👉 {link}\n\nOffer expires: {date}`},
  {id:'restock',emoji:'📦',name:'Restock alert',badge:'',desc:'Notify waiting customers',
   msg:`Great news, {name}! 📦\n\nThe item you were asking about is BACK IN STOCK! Get yours before it sells out again 🏃\n\n👉 {link}\n\nReply if you have any questions!`},
  {id:'thankyou',emoji:'💛',name:'Thank you',badge:'',desc:'Post-purchase appreciation',
   msg:`Hi {name}! 💛\n\nJust wanted to personally thank you for your recent order — it truly means a lot to us!\n\nTag us @{page} for a feature! 📸 We're always here if you need anything. 🙏`},
  {id:'christmas',emoji:'🎄',name:'Christmas',badge:'',desc:'Xmas wishes + promo',
   msg:`Merry Christmas! 🎄✨\n\nWishing you a wonderful holiday filled with warmth and laughter.\n\nCelebrate with {discount} off — use code XMAS at checkout 🎁\n\nShop 👉 {link}`},
  {id:'custom',emoji:'✏️',name:'Custom',badge:'',desc:'Write from scratch',msg:''},
];

const TONES = {
  friendly:'Warm, friendly and approachable.',
  formal:'Professional and polished.',
  casual:'Very casual, like texting a friend.',
  sales:'Enthusiastic and sales-focused.'
};

const CLASSIFY_KW = {
  price:['price','cost','how much','rate','charges','fee','pricing','discount','offer','deal'],
  stock:['available','in stock','stock','have it','left','quantity','sold out','restock'],
  order:['order','track','tracking','delivery','shipped','status','received','return','refund','exchange','cancel'],
  collab:['collab','collaborate','partnership','sponsor','promote','paid','pr','gifted','influencer','barter'],
  complaint:['bad','worst','poor','disappointed','broken','damaged','late','issue','problem','complaint','angry'],
  spam:['follow back','check my','dm me','free followers','giveaway'],
};

const PERMS = ['instagram_manage_messages','instagram_manage_comments','pages_read_engagement','instagram_basic','pages_messaging'];

// ── HELPERS ───────────────────────────────────────────────────────────────────
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const classify = t => { const l=t.toLowerCase(); for(const[c,ks] of Object.entries(CLASSIFY_KW)) if(ks.some(k=>l.includes(k))) return c; return 'general'; };
const tagLabel = c => ({price:'Price inquiry',stock:'Stock check',order:'Order status',collab:'Collab',complaint:'Complaint',spam:'Spam',general:'General'}[c]||c);
const tagCls = c => 'tag tag-'+c;
const initials = n => (n||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
const fmtTime = iso => { if(!iso) return ''; try{ const d=new Date(iso),df=Date.now()-d; if(df<60000) return 'just now'; if(df<3600000) return Math.round(df/60000)+'m ago'; if(df<86400000) return Math.round(df/3600000)+'h ago'; return d.toLocaleDateString([],{month:'short',day:'numeric'}); }catch(e){return iso;} };
const AVATAR_COLORS = [['#3b0764','#a78bfa'],['#0c4a6e','#38bdf8'],['#14532d','#4ade80'],['#431407','#fb923c'],['#500724','#f472b6']];
const avatarColor = n => AVATAR_COLORS[(n||'?').charCodeAt(0)%AVATAR_COLORS.length];

function log(msg, type='') {
  const bar = document.getElementById('logBar'); bar.style.display = 'block';
  const now = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const d = document.getElementById('logEntries');
  const r = document.createElement('div'); r.className = 'log-row';
  r.innerHTML = `<span class="log-t">${now}</span><span class="${type==='ok'?'log-ok':type==='err'?'log-err':type==='warn'?'log-warn':''}">${esc(msg)}</span>`;
  d.prepend(r); if(d.children.length>30) d.removeChild(d.lastChild);
}

function setMain(html) { document.getElementById('mainArea').innerHTML = html; }
function setNavActive(tab) { document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active')); const el=document.getElementById('nav-'+tab); if(el) el.classList.add('active'); }

// ── GRAPH API — uses corsproxy.io to bypass browser CORS restrictions ─────────
async function igGet(endpoint) {
  const base = `https://graph.instagram.com/v21.0/${endpoint}${endpoint.includes('?')?'&':'?'}access_token=${G.token}`;
  const url = `https://corsproxy.io/?${encodeURIComponent(base)}`;
  const r = await fetch(url);
  const data = await r.json();
  if (data.error) throw new Error(data.error.message || 'Graph API error');
  return data;
}

async function igPost(endpoint, body) {
  const base = `https://graph.instagram.com/v21.0/${endpoint}`;
  const url = `https://corsproxy.io/?${encodeURIComponent(base)}`;
  const r = await fetch(url, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({...body, access_token: G.token})
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error.message || 'Graph API error');
  return data;
}

// ── ROUTING ───────────────────────────────────────────────────────────────────
function showTab(tab) {
  setNavActive(tab);
  if (tab==='settings') renderSettings();
  else if (tab==='bulk') renderBulk();
  else if (tab==='queue') renderQueue();
  else if (tab==='dms') { if(G.connected) loadDMs(); else renderSettings(); }
  else if (tab==='comments') { if(G.connected) loadComments(); else renderSettings(); }
  else if (tab==='catalog') renderCatalog();
  else if (tab==='stats') renderStats();
}

// ── HERO ──────────────────────────────────────────────────────────────────────
function renderHero() {
  setMain(`
    <div class="hero">
      <div class="hero-icon"><i class="ti ti-brand-instagram"></i></div>
      <h1>Instagram Page Manager</h1>
      <p>Manage DMs, comments, and run bulk campaigns for your Instagram Business page — all in one place.</p>
      <div class="feat-grid">
        <div class="feat-card"><i class="ti ti-message-2"></i><div><div class="feat-title">Smart DM inbox</div><div class="feat-desc">Auto-classify and draft replies to every message</div></div></div>
        <div class="feat-card"><i class="ti ti-speakerphone"></i><div><div class="feat-title">Bulk messaging</div><div class="feat-desc">Festival templates, audience segments, scheduling</div></div></div>
        <div class="feat-card"><i class="ti ti-message-dots"></i><div><div class="feat-title">Comment monitor</div><div class="feat-desc">Reply and moderate comments across all posts</div></div></div>
        <div class="feat-card"><i class="ti ti-shopping-bag"></i><div><div class="feat-title">Product catalog</div><div class="feat-desc">Answer price and stock inquiries accurately</div></div></div>
      </div>
      <button class="btn btn-grad" onclick="showTab('settings')" style="padding:11px 28px;font-size:14px;border-radius:20px"><i class="ti ti-plug" style="font-size:16px"></i> Connect your Instagram</button>
    </div>`);
}

// ── SETTINGS / GUIDED SETUP ───────────────────────────────────────────────────
const SETUP_STEPS = [
  { short:'Meta App', icon:'ti-brand-meta', title:'Create a Meta App',
    desc:'You need a free Meta developer account and an app to access the Instagram API.',
    actions:[{label:'Create Meta App',url:'https://developers.facebook.com/apps/create/',primary:true},{label:'Docs',url:'https://developers.facebook.com/docs/development/create-an-app/'}],
    instructions:['Go to developers.facebook.com and sign in with Facebook','Click "My Apps" → "Create App"','Choose "Other" then "Business" as the app type','Name it anything (e.g. "Page Manager") and click Create','Once created, continue to Step 2'],
    tip:'Use the same Facebook account that owns your Instagram Business page.' },
  { short:'Link Instagram', icon:'ti-brand-instagram', title:'Link your Instagram account',
    desc:'Connect your Instagram Professional account to the Meta app.',
    actions:[{label:'Open App Dashboard',url:'https://developers.facebook.com/apps/',primary:true},{label:'Instagram API docs',url:'https://developers.facebook.com/docs/instagram-platform/'}],
    instructions:['Inside your app, find "Add a Product" in the left sidebar','Click "Set up" on the Instagram product','Under "Instagram accounts" click "Add account" and log in','Your account must be a Business or Creator account','Note your Instagram Business Account ID shown here — you need it in Step 4'],
    tip:'Switch to a Professional account in Instagram → Settings → Account → Switch to Professional.' },
  { short:'Permissions', icon:'ti-shield-check', title:'Add required permissions',
    desc:'These permissions let the app read DMs, comments, and send messages.',
    actions:[{label:'Open App Permissions',url:'https://developers.facebook.com/apps/',primary:true},{label:'Permissions reference',url:'https://developers.facebook.com/docs/permissions/'}],
    instructions:['In your app go to "App Review" → "Permissions and Features"','Search and add each permission listed below','Click "Get advanced access" on each — this works for your own account without App Review'],
    permissions: PERMS,
    tip:'You only need App Review if others will connect their accounts. For your own page, Advanced Access is enough.' },
  { short:'Get token', icon:'ti-key', title:'Generate your access token',
    desc:'Create a long-lived token the app uses to call the Instagram API.',
    actions:[{label:'Graph API Explorer',url:'https://developers.facebook.com/tools/explorer/',primary:true},{label:'Verify / debug token',url:'https://developers.facebook.com/tools/debug/accesstoken/'},{label:'Long-lived token guide',url:'https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/'}],
    instructions:['Go to Graph API Explorer (button above)','Select your app from the "Meta App" dropdown top-right','Click "Generate Access Token" and grant permissions','Copy the token (starts with EAA…)','For a 60-day token: exchange it using the long-lived token guide above','Paste token + Account ID below, then click Connect'],
    tip:'Short-lived tokens expire in 1 hour. Exchange for a long-lived token (60 days), or use a System User token which never expires.' },
];

function renderSettings() {
  setNavActive('settings');

  if (G.connected) { renderConnectedSettings(); return; }

  // ── SIMPLE CONNECT SCREEN ─────────────────────────────────────────────────
  setMain(`
    <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 20px;min-height:560px">

      <div style="width:100%;max-width:460px">

        <!-- Header -->
        <div style="text-align:center;margin-bottom:28px">
          <div style="width:60px;height:60px;border-radius:18px;background:linear-gradient(135deg,var(--purple),var(--pink),var(--orange));display:flex;align-items:center;justify-content:center;margin:0 auto 14px">
            <i class="ti ti-brand-instagram" style="font-size:28px;color:#fff"></i>
          </div>
          <h2 style="font-size:20px;font-weight:800;margin-bottom:6px">Connect Instagram</h2>
          <p style="font-size:13px;color:var(--text2);line-height:1.6">Two steps. Takes about 2 minutes.<br>No technical knowledge needed.</p>
        </div>

        <!-- Step 1 -->
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rl);padding:18px;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--purple),var(--pink));display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;flex-shrink:0">1</div>
            <div>
              <div style="font-size:13px;font-weight:700">Get your access token</div>
              <div style="font-size:11px;color:var(--text2)">Opens Meta's token tool — just click Allow and copy the token</div>
            </div>
          </div>
          <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener" style="text-decoration:none;display:block">
            <button class="btn btn-grad" style="width:100%;justify-content:center;padding:11px;font-size:13px">
              <i class="ti ti-external-link"></i> Open Meta Token Tool
            </button>
          </a>
          <div style="margin-top:10px;padding:10px 12px;background:var(--bg3);border-radius:var(--r);font-size:12px;color:var(--text2);line-height:1.8">
            On the Explorer page:<br>
            <strong style="color:var(--text)">1)</strong> Top right — select your Meta App from the dropdown<br>
            <strong style="color:var(--text)">2)</strong> Click <strong style="color:var(--text)">"Generate Access Token"</strong> and log in<br>
            <strong style="color:var(--text)">3)</strong> Copy the long token that appears in the box
          </div>
        </div>

        <!-- Step 2 — paste zone -->
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rl);padding:18px;margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--purple),var(--pink));display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;flex-shrink:0">2</div>
            <div>
              <div style="font-size:13px;font-weight:700">Paste your token here</div>
              <div style="font-size:11px;color:var(--text2)">We'll detect your account automatically</div>
            </div>
          </div>

          <!-- big paste target -->
          <div id="pasteZone" style="border:2px dashed var(--border2);border-radius:var(--r);padding:18px 14px;text-align:center;cursor:pointer;transition:all .2s;background:var(--bg3);position:relative;margin-bottom:10px" onclick="document.getElementById('inToken').focus()">
            <div id="pasteIcon" style="font-size:28px;margin-bottom:6px">📋</div>
            <div id="pasteLabel" style="font-size:13px;font-weight:600;color:var(--text2)">Click here and paste your token</div>
            <div style="font-size:11px;color:var(--text3);margin-top:3px">Ctrl+V · it starts with EAA…</div>
            <input id="inToken" type="text"
              style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%"
              value="${esc(G.token)}"
              oninput="onTokenInput(this.value)"
              onpaste="onTokenPaste(event)">
          </div>

          <!-- status bar (hidden until token pasted) -->
          <div id="tokenStatus" style="display:${G.token?'flex':'none'};align-items:center;gap:10px;padding:10px 12px;border-radius:var(--r);border:1px solid var(--border2);background:var(--bg);margin-bottom:10px;font-size:12px">
            <div id="tokenStatusIcon" style="font-size:18px;flex-shrink:0">⏳</div>
            <div style="flex:1;min-width:0">
              <div id="tokenStatusTitle" style="font-weight:600;margin-bottom:1px">Checking token…</div>
              <div id="tokenStatusSub" style="color:var(--text2);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></div>
            </div>
            <button onclick="clearToken()" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:16px;padding:2px 6px">✕</button>
          </div>

          <!-- account ID (hidden until auto-detected or needed) -->
          <div id="accountIdSection" style="display:none;margin-bottom:10px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
              <label class="field-label" style="margin:0">Account ID</label>
              <div id="accountIdBadge" style="display:none;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:var(--green-bg);color:var(--green)">✨ Auto-detected</div>
            </div>
            <div style="display:flex;gap:8px">
              <div style="flex:1;position:relative">
                <input id="inPageId" type="text" class="input-field" placeholder="17841xxxxxxxxxx — auto-filled if possible" value="${esc(G.pageId)}" oninput="onPageIdInput()">
                <div id="pageIdSpinner" style="display:none;position:absolute;right:10px;top:50%;transform:translateY(-50%)"><div class="spinner"></div></div>
              </div>
              <a href="https://www.facebook.com/help/1558356551275731" target="_blank" rel="noopener" style="text-decoration:none"><button class="btn" title="Where to find this"><i class="ti ti-help"></i></button></a>
            </div>
            <div style="font-size:11px;color:var(--text3);margin-top:4px">Meta Business Settings → Accounts → Instagram → your account ID</div>
          </div>

          <!-- account preview card -->
          <div id="acctPreview" style="display:none;padding:12px;background:var(--bg3);border-radius:var(--r);margin-bottom:10px">
            <div style="display:flex;align-items:center;gap:10px">
              <div id="prevAvatar" style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--purple),var(--pink));display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;flex-shrink:0"></div>
              <div style="flex:1">
                <div id="prevName" style="font-size:13px;font-weight:700"></div>
                <div id="prevHandle" style="font-size:12px;color:var(--text2)"></div>
                <div id="prevStats" style="font-size:11px;color:var(--text3)"></div>
              </div>
              <div style="width:26px;height:26px;border-radius:50%;background:var(--green-bg);display:flex;align-items:center;justify-content:center;color:var(--green);font-size:14px">✓</div>
            </div>
          </div>
        </div>

        <!-- Connect button -->
        <button class="btn btn-grad" onclick="connect()" id="connectBtn" style="width:100%;justify-content:center;padding:13px;font-size:14px;font-weight:700;border-radius:var(--rl)">
          <i class="ti ti-plug" style="font-size:16px"></i> Connect to Instagram
        </button>
        <div id="connResult" style="margin-top:10px"></div>

        <!-- Advanced toggle -->
        <div style="text-align:center;margin-top:16px">
          <button onclick="renderAdvancedSetup()" style="background:none;border:none;color:var(--text3);font-size:12px;cursor:pointer;font-family:inherit">
            Need help setting up a Meta App? <span style="color:var(--pink)">Step-by-step guide →</span>
          </button>
        </div>

      </div>
    </div>`);

  // if token already exists from before, re-run detection
  if (G.token) handleToken(G.token);
}

function renderAdvancedSetup() {
  G_setupStep = 0;
  renderAdvancedSettings();
}

function renderAdvancedSettings() {
  setNavActive('settings');
  const step = G_setupStep;
  const s = SETUP_STEPS[Math.min(step, 3)];

  const stepsNav = SETUP_STEPS.map((st,i) => `
    <div class="step-item ${step===i?'active':''}" onclick="G_setupStep=${i};renderAdvancedSettings()">
      <div class="step-num ${G.connected||i<step?'done':step===i?'active':'idle'}">
        ${G.connected||i<step?'<i class="ti ti-check" style="font-size:12px"></i>':i+1}
      </div>
      <span class="step-label">${st.short}</span>
    </div>`).join('');

  const instHTML = s.instructions.map((ins,i) => `
    <div class="step-instruction">
      <div class="step-n">${i+1}</div>
      <div class="step-text">${esc(ins)}</div>
    </div>`).join('');

  const permHTML = s.permissions ? `
    <div style="margin:14px 0 8px;font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em">Required permissions</div>
    ${s.permissions.map(p=>`
      <div class="perm-row">
        <span class="perm-name">${p}</span>
        <button class="copy-btn" onclick="copyText('${p}')"><i class="ti ti-copy"></i></button>
      </div>`).join('')}` : '';

  const actHTML = s.actions.map(a=>`
    <a href="${a.url}" target="_blank" rel="noopener" style="text-decoration:none">
      <button class="btn ${a.primary?'btn-grad':''}">${a.primary?'<i class="ti ti-external-link"></i> ':''} ${esc(a.label)}</button>
    </a>`).join('');

  const nextBtn = step < 3
    ? `<button class="btn btn-grad" onclick="G_setupStep=${step+1};renderAdvancedSettings()">Continue to step ${step+2} <i class="ti ti-arrow-right"></i></button>`
    : `<button class="btn" onclick="renderSettings()"><i class="ti ti-arrow-left"></i> Back to connect</button>`;

  setMain(`
    <div class="setup-shell">
      <div class="setup-steps">
        <button onclick="renderSettings()" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:12px;font-family:inherit;display:flex;align-items:center;gap:5px;padding:4px 10px 10px"><i class="ti ti-arrow-left" style="font-size:13px"></i> Back</button>
        ${stepsNav}
      </div>
      <div class="setup-content">
        <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:20px">
          <div style="width:46px;height:46px;border-radius:var(--r);background:var(--pink-glow);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="ti ${s.icon}" style="font-size:22px;color:var(--pink)"></i>
          </div>
          <div>
            <h2>Step ${step+1} of 4 — ${esc(s.title)}</h2>
            <div class="sub">${esc(s.desc)}</div>
          </div>
        </div>
        <div class="card" style="margin-bottom:14px">
          <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">What to do</div>
          ${instHTML}
        </div>
        ${permHTML}
        <div class="link-row">${actHTML}</div>
        <div class="tip-box"><i class="ti ti-bulb" style="font-size:16px;flex-shrink:0;margin-top:1px"></i><span>${esc(s.tip)}</span></div>
        <div style="margin-top:20px">${nextBtn}</div>
      </div>
    </div>`);
}

function renderConnectedSettings() {
  setMain(`
    <div style="padding:24px;max-width:480px;margin:0 auto">
      <div style="display:flex;align-items:center;gap:12px;padding:16px;background:var(--green-bg);border:1px solid rgba(34,197,94,.2);border-radius:var(--rl);margin-bottom:20px">
        <div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,var(--purple),var(--pink));display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#fff;flex-shrink:0">${esc(initials(G.pageName))}</div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:700">${esc(G.pageName)}</div>
          <div style="font-size:12px;color:var(--text2)">${G.pageUsername?'@'+esc(G.pageUsername):''} · ${G.followers.toLocaleString()} followers</div>
        </div>
        <div style="color:var(--green);font-size:22px">✓</div>
      </div>
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">Reply tone</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        ${Object.keys(TONES).map(t=>`<button onclick="G.tone='${t}';renderConnectedSettings()" style="padding:7px 16px;border-radius:20px;border:1px solid ${G.tone===t?'var(--pink)':'var(--border2)'};background:${G.tone===t?'var(--pink-glow)':'var(--bg2)'};color:${G.tone===t?'var(--pink)':'var(--text2)'};font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">${t.charAt(0).toUpperCase()+t.slice(1)}</button>`).join('')}
      </div>
      <div style="font-size:12px;color:var(--text2);background:var(--bg2);padding:9px 12px;border-radius:var(--r);margin-bottom:20px">${esc(TONES[G.tone])}</div>
      <button onclick="G.connected=false;G.token='';G.pageId='';G.pageName='';G.pageUsername='';G.followers=0;updateTopbar();renderSettings()" class="btn btn-red" style="width:100%;justify-content:center;padding:10px">
        <i class="ti ti-unlink"></i> Disconnect account
      </button>
    </div>`);
}



// ── TOKEN AUTO-DETECTOR ───────────────────────────────────────────────────────
let _tokenTimer = null;

function onTokenPaste(e) {
  const pasted = (e.clipboardData||window.clipboardData).getData('text').trim();
  if (!pasted) return;
  e.preventDefault();
  const inp = document.getElementById('inToken');
  if (inp) inp.value = pasted;
  handleToken(pasted);
}

function onTokenInput(val) {
  const v = val.trim();
  if (!v) { clearToken(); return; }
  clearTimeout(_tokenTimer);
  _tokenTimer = setTimeout(() => handleToken(v), 600);
}

function onPageIdInput() {
  const badge = document.getElementById('accountIdBadge');
  if (badge) badge.style.display = 'none';
}

async function handleToken(raw) {
  const token = raw.replace(/\s/g,'');
  G.token = token;
  setPasteZone('detecting');

  try {
    const me = await igGetRaw(`me?fields=id,name&access_token=${token}`);
    if (me.error) throw new Error(me.error.message);
    setPasteZone('valid');
    setTokenStatus('valid', `Token valid · User: ${me.name||me.id}`, token.slice(0,28)+'…');
    log('Token validated for: '+me.name,'ok');
    await autoFindAccountId(token, me.id);
  } catch(e) {
    setPasteZone('invalid');
    setTokenStatus('invalid', 'Invalid token — check and try again', e.message);
    log('Token invalid: '+e.message,'err');
  }
}

function setPasteZone(state) {
  const zone = document.getElementById('pasteZone');
  const icon = document.getElementById('pasteIcon');
  const lbl  = document.getElementById('pasteLabel');
  if (!zone) return;
  const map = {
    idle:      {border:'var(--border2)', bg:'var(--bg3)',       emoji:'📋', color:'',             text:'Click here then paste your token'},
    detecting: {border:'var(--amber)',   bg:'var(--amber-bg)',  emoji:'🔍', color:'var(--amber)',  text:'Detecting token…'},
    valid:     {border:'var(--green)',   bg:'var(--green-bg)',  emoji:'✅', color:'var(--green)',  text:'Token valid!'},
    invalid:   {border:'var(--red)',     bg:'var(--red-bg)',    emoji:'❌', color:'var(--red)',    text:'Invalid token — try again'},
  };
  const m = map[state]||map.idle;
  zone.style.borderColor = m.border;
  zone.style.background  = m.bg;
  if (icon) icon.textContent = m.emoji;
  if (lbl)  { lbl.style.color = m.color; lbl.textContent = m.text; }
}

function setTokenStatus(state, title, sub) {
  const bar   = document.getElementById('tokenStatus');
  const sIcon = document.getElementById('tokenStatusIcon');
  const sTit  = document.getElementById('tokenStatusTitle');
  const sSub  = document.getElementById('tokenStatusSub');
  if (!bar) return;
  bar.style.display = 'flex';
  const icons = {valid:'✅', invalid:'❌', detecting:'⏳', loading:'⏳'};
  const colors = {valid:'var(--green)', invalid:'var(--red)', detecting:'var(--amber)', loading:'var(--amber)'};
  if (sIcon) sIcon.textContent = icons[state]||'⏳';
  if (sTit)  { sTit.textContent = title; sTit.style.color = colors[state]||''; }
  if (sSub)  sSub.textContent = sub||'';
}

async function autoFindAccountId(token, userId) {
  const spinner = document.getElementById('pageIdSpinner');
  const inp     = document.getElementById('inPageId');
  const badge   = document.getElementById('accountIdBadge');
  if (spinner) spinner.style.display = 'block';
  setTokenStatus('loading', 'Token valid · Finding your Instagram account…', '');

  let igId = null;

  // Try 1: /user/accounts → look for linked IG business account
  try {
    const accts = await igGetRaw(`${userId}/accounts?fields=id,name,instagram_business_account&access_token=${token}`);
    for (const page of (accts.data||[])) {
      if (page.instagram_business_account?.id) { igId = page.instagram_business_account.id; break; }
    }
  } catch(e) {}

  // Try 2: /me/instagram_accounts
  if (!igId) {
    try {
      const ia = await igGetRaw(`me/instagram_accounts?fields=id,name,username&access_token=${token}`);
      if ((ia.data||[]).length) igId = ia.data[0].id;
    } catch(e) {}
  }

  // Try 3: userId itself might be the IG Business Account
  if (!igId) {
    try {
      const d = await igGetRaw(`${userId}?fields=id,username,followers_count&access_token=${token}`);
      if (d.username || d.followers_count !== undefined) igId = d.id;
    } catch(e) {}
  }

  if (spinner) spinner.style.display = 'none';

  if (igId) {
    G.pageId = igId;
    if (inp)   inp.value = igId;
    if (badge) { badge.style.display = 'flex'; }
    setTokenStatus('valid', 'Token valid · Account ID auto-detected ✨', 'ID: '+igId);
    log('Account ID auto-detected: '+igId,'ok');
    await showAccountPreview(token, igId);
  } else {
    setTokenStatus('valid', 'Token valid · Enter Account ID manually', 'Could not detect automatically');
    log('Could not auto-detect Account ID','warn');
  }
}

async function showAccountPreview(token, igId) {
  try {
    const info = await igGetRaw(`${igId}?fields=name,username,followers_count,media_count&access_token=${token}`);
    if (info.error) return;
    const preview = document.getElementById('acctPreview');
    if (!preview) return;
    const name = info.name||info.username||igId;
    G.pageName = name; G.pageUsername = info.username||''; G.followers = info.followers_count||0;
    document.getElementById('prevAvatar').textContent = initials(name);
    document.getElementById('prevName').textContent   = name;
    document.getElementById('prevHandle').textContent = info.username ? '@'+info.username : '';
    document.getElementById('prevStats').textContent  = (info.followers_count?info.followers_count.toLocaleString()+' followers':'')+(info.media_count?' · '+info.media_count+' posts':'');
    preview.style.display = 'block';
    log('Account preview: '+name,'ok');
  } catch(e) {}
}

// Raw Graph API call — tries direct first (works if CORS allows), falls back to proxy
async function igGetRaw(endpoint) {
  const url = `https://graph.instagram.com/v21.0/${endpoint}`;
  let r;
  try { r = await fetch(url); }
  catch(e) { r = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`); }
  return r.json();
}

function clearToken() {
  G.token=''; G.pageId='';
  ['inToken','inPageId'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  setPasteZone('idle');
  const bar=document.getElementById('tokenStatus');if(bar)bar.style.display='none';
  const prev=document.getElementById('acctPreview');if(prev)prev.style.display='none';
  const badge=document.getElementById('accountIdBadge');if(badge)badge.style.display='none';
}

function copyText(t) {
  navigator.clipboard?.writeText(t).then(()=>log('Copied: '+t,'ok'));
}

async function connect() {
  const t = (document.getElementById('inToken')?.value||G.token).trim();
  const p = (document.getElementById('inPageId')?.value||G.pageId).trim();
  if (!t) { showConnResult('err','Paste your access token first'); return; }
  if (!p) { showConnResult('err','Account ID needed — should be auto-filled above. Check step 2.'); return; }
  const btn = document.getElementById('connectBtn');
  if (btn) { btn.disabled=true; btn.innerHTML='<div class="spinner"></div> Connecting…'; }
  G.token=t; G.pageId=p;
  log('Connecting…');
  try {
    if (!G.pageName) {
      const info = await igGet(`${p}?fields=name,username,followers_count`);
      G.pageName=info.name||info.username||p; G.pageUsername=info.username||''; G.followers=info.followers_count||0;
    }
    G.connected=true; G_setupStep=3;
    updateTopbar();
    showConnResult('ok',`Connected as ${G.pageName} · ${G.followers.toLocaleString()} followers`);
    log(`Connected as ${G.pageName}`,'ok');
    setTimeout(()=>showTab('dms'),900);
  } catch(e) {
    log('Connection failed: '+e.message,'err');
    showConnResult('err', e.message);
    if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-plug"></i> Connect to Instagram';}
  }
}

function showConnResult(type, msg) {
  const el=document.getElementById('connResult');
  if(!el) return;
  el.innerHTML=`<div class="conn-result ${type}"><i class="ti ${type==='ok'?'ti-circle-check':'ti-alert-circle'}" style="font-size:16px"></i> ${esc(msg)}</div>`;
}

function updateTopbar() {
  const pill=document.getElementById('connPill');
  const btn=document.querySelector('.topnav-btn');
  const acct=document.getElementById('sideAcct');
  if(G.connected) {
    if(pill){pill.className='conn-pill ok';pill.innerHTML=`<div class="dot"></div> ${esc(G.pageName)}`;}
    if(btn){btn.innerHTML='<i class="ti ti-settings" style="font-size:14px"></i> Settings';btn.onclick=()=>showTab('settings');}
    if(acct){
      acct.style.display='flex';
      const [bg,fg]=avatarColor(G.pageName);
      document.getElementById('sideAvatarEl').style.background=`linear-gradient(135deg,${bg},${fg})`;
      document.getElementById('sideAvatarEl').textContent=initials(G.pageName);
      document.getElementById('sideNameEl').textContent=G.pageName;
      document.getElementById('sideHandleEl').textContent=G.pageUsername?'@'+G.pageUsername:'';
    }
  }
}

// ── DMs ───────────────────────────────────────────────────────────────────────
async function loadDMs() {
  if(!G.connected){showTab('settings');return;}
  setMain('<div class="empty"><div class="spinner" style="width:24px;height:24px;border-width:3px"></div><span style="margin-top:10px">Loading conversations...</span></div>');
  log('Fetching DMs...');
  try {
    const data = await igGet(`${G.pageId}/conversations?platform=instagram&fields=id,updated_time,participants,messages{message,from,created_time}`);
    G.dms = (data.data||[]).map(c=>{
      const msgs=c.messages?.data||[], lm=msgs[0]||{};
      const other=(c.participants?.data||[]).find(p=>p.id!==G.pageId)||(c.participants?.data||[])[0]||{};
      const text=lm.message||'';
      return{id:c.id,updatedTime:c.updated_time,sender:other.name||other.username||'User'+c.id.slice(-4),senderId:other.id,lastMessage:text,category:classify(text),messages:msgs.map(m=>({text:m.message,from:m.from?.id===G.pageId?'us':'them',time:m.created_time})).reverse(),unread:true,replied:false};
    });
    const ub=document.getElementById('dmBadge'),uc=G.dms.filter(d=>d.unread).length;
    if(ub){ub.textContent=uc||'';ub.style.display=uc?'':'none';}
    renderDMsView();
    log(`Loaded ${G.dms.length} conversations`,'ok');
  } catch(e) {
    setMain(`<div class="empty"><i class="ti ti-alert-circle" style="color:var(--red)"></i><span style="color:var(--red)">${esc(e.message)}</span><button class="btn" style="margin-top:10px" onclick="loadDMs()"><i class="ti ti-refresh"></i> Retry</button></div>`);
    log('DMs failed: '+e.message,'err');
  }
}

function renderDMsView(filter='') {
  const list = filter ? G.dms.filter(d=>d.category===filter||d.sender.toLowerCase().includes(filter.toLowerCase())) : G.dms;
  setMain(`
    <div class="tbar">
      <span class="tbar-title">Direct messages</span>
      <input type="text" placeholder="Search conversations..." oninput="filterDMSearch(this.value)" style="width:200px">
      <button class="btn" onclick="loadDMs()"><i class="ti ti-refresh"></i></button>
    </div>
    <div style="display:flex;gap:6px;padding:8px 18px;border-bottom:1px solid var(--border);overflow-x:auto;flex-shrink:0">
      <button class="btn ${!filter?'btn-grad':''}" style="border-radius:20px;padding:4px 12px;font-size:11px" onclick="renderDMsView()">All (${G.dms.length})</button>
      ${['price','order','stock','collab','complaint'].map(c=>`<button class="btn" style="border-radius:20px;padding:4px 12px;font-size:11px;white-space:nowrap" onclick="renderDMsView('${c}')">${tagLabel(c)} (${G.dms.filter(d=>d.category===c).length})</button>`).join('')}
    </div>
    <div class="dm-shell">
      <div class="dm-list" id="dmListEl">
        ${list.length ? list.map((d,i)=>`
          <div class="msg-item ${d.unread?'unread':''}" id="dmitem-${i}" onclick="selectDM(${i})">
            <div class="${d.unread?'unread-dot':'read-spc'}"></div>
            <div class="avatar" style="width:38px;height:38px;font-size:13px;background:linear-gradient(135deg,${avatarColor(d.sender)[0]},${avatarColor(d.sender)[1]})">${esc(initials(d.sender))}</div>
            <div class="msg-body">
              <div class="msg-row1"><span class="msg-sender">${esc(d.sender)}</span><span class="msg-time">${fmtTime(d.updatedTime)}</span></div>
              <div class="msg-preview">${esc(d.lastMessage)}</div>
              <div class="msg-tags">
                <span class="${tagCls(d.category)}">${tagLabel(d.category)}</span>
                ${d.replied?'<span class="tag" style="background:var(--green-bg);color:var(--green)">Replied</span>':''}
              </div>
            </div>
          </div>`).join('') : '<div class="empty"><i class="ti ti-inbox"></i><span>No conversations found</span></div>'}
      </div>
      <div class="detail" id="dmDetail"><div class="empty"><i class="ti ti-message-2"></i><span>Select a conversation</span></div></div>
    </div>`);
}

function filterDMSearch(q) {
  document.querySelectorAll('.msg-item').forEach(el=>{
    el.style.display=el.textContent.toLowerCase().includes(q.toLowerCase())?'':'none';
  });
}

function selectDM(i) {
  G.selectedDmIdx=i;
  const dm=G.dms[i]; dm.unread=false;
  document.querySelectorAll('.msg-item').forEach((el,j)=>el.classList.toggle('active',j===i));
  const det=document.getElementById('dmDetail'); if(!det) return;
  const [bg,fg]=avatarColor(dm.sender);
  const draft=genDraft(dm);
  det.innerHTML=`
    <div class="detail-hdr">
      <div class="avatar" style="width:40px;height:40px;font-size:14px;background:linear-gradient(135deg,${bg},${fg})">${esc(initials(dm.sender))}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700">${esc(dm.sender)}</div>
        <span class="${tagCls(dm.category)}">${tagLabel(dm.category)}</span>
      </div>
    </div>
    <div class="thread" id="dmThread">
      ${dm.messages.map(m=>`
        <div>
          <div class="bubble ${m.from}">${esc(m.text)}</div>
          <div class="bubble-time" style="text-align:${m.from==='us'?'right':'left'}">${fmtTime(m.time)}</div>
        </div>`).join('')}
    </div>
    <div class="reply-area">
      <div class="reply-lbl"><i class="ti ti-sparkles"></i> AI draft</div>
      <textarea class="draft-text" id="draftText" rows="3">${esc(draft)}</textarea>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="btn btn-green" onclick="sendDM(${i})"><i class="ti ti-send"></i> Send</button>
        <button class="btn" onclick="document.getElementById('draftText').value=genDraft(G.dms[${i}])"><i class="ti ti-refresh"></i></button>
        <button class="btn" onclick="navigator.clipboard?.writeText(document.getElementById('draftText').value)"><i class="ti ti-copy"></i></button>
      </div>
    </div>`;
  const th=document.getElementById('dmThread'); if(th) th.scrollTop=th.scrollHeight;
}

function genDraft(dm) {
  const cat=dm.category,name=dm.sender.split(' ')[0],msg=dm.lastMessage;
  const match=G.catalog.find(p=>msg.toLowerCase().includes(p.name.toLowerCase()));
  if(cat==='price'){if(match) return `Hi ${name}! 👋 Thanks for asking about ${match.name} — it's priced at ${match.price}. ${match.stock>0?'We have it in stock and ready to ship! 🛍️':'Currently out of stock but restocking soon!'} DM us to order!`; return `Hi ${name}! Which product are you asking about? We'd love to share the price! 😊`;}
  if(cat==='stock'){if(match) return `Hey ${name}! ${match.name} is ${match.stock>0?`in stock — ${match.stock} units available 🎉`:'out of stock right now. Want us to notify you when it\'s back?'}`; return `Hi ${name}! Which item are you looking for? We'll check availability right away!`;}
  if(cat==='order') return `Hi ${name}! Please share your order number and we'll look into this immediately. We're here to help! 🙏`;
  if(cat==='collab') return `Hi ${name}! 👋 Thanks for reaching out about a collab! Could you share your media kit or more details? We'd love to connect!`;
  if(cat==='complaint') return `Hi ${name}, we're really sorry to hear about your experience. Please share more details so we can make this right. 🙏`;
  return `Hi ${name}! Thanks for reaching out — how can we help you today? 😊`;
}

async function sendDM(i) {
  const text=document.getElementById('draftText')?.value?.trim();
  if(!text||!confirm('Send this reply?')) return;
  const dm=G.dms[i];
  try {
    await igPost('me/messages',{recipient:{id:dm.senderId},message:{text}});
    dm.replied=true; dm.messages.push({text,from:'us',time:new Date().toISOString()});
    selectDM(i); log(`Sent to ${dm.sender}`,'ok');
  } catch(e) { log('Send failed: '+e.message,'err'); alert('Failed: '+e.message); }
}

// ── COMMENTS ──────────────────────────────────────────────────────────────────
async function loadComments() {
  if(!G.connected){showTab('settings');return;}
  setMain('<div class="empty"><div class="spinner" style="width:24px;height:24px;border-width:3px"></div><span style="margin-top:10px">Loading comments...</span></div>');
  log('Fetching media & comments...');
  try {
    const media=await igGet(`${G.pageId}/media?fields=id,caption,media_type,timestamp&limit=10`);
    let all=[];
    for(const post of (media.data||[]).slice(0,5)) {
      try{const cmts=await igGet(`${post.id}/comments?fields=id,text,username,timestamp`);(cmts.data||[]).forEach(c=>{all.push({...c,postCaption:(post.caption||'').slice(0,40),postId:post.id,category:classify(c.text)});});}catch(e2){}
    }
    G.comments=all;
    const cb=document.getElementById('cmtBadge');
    if(cb){cb.textContent=all.length||'';cb.style.display=all.length?'':'none';}
    renderCommentsView(); log(`Loaded ${all.length} comments`,'ok');
  } catch(e) {
    setMain(`<div class="empty"><i class="ti ti-alert-circle" style="color:var(--red)"></i><span style="color:var(--red)">${esc(e.message)}</span><button class="btn" style="margin-top:10px" onclick="loadComments()"><i class="ti ti-refresh"></i> Retry</button></div>`);
    log('Comments failed: '+e.message,'err');
  }
}

function renderCommentsView() {
  setMain(`
    <div class="tbar"><span class="tbar-title">Comments</span><input type="text" placeholder="Filter..." oninput="filterCmts(this.value)" style="width:160px"><button class="btn" onclick="loadComments()"><i class="ti ti-refresh"></i></button></div>
    <div style="overflow-y:auto;flex:1" id="cmtListEl">
      ${G.comments.length ? G.comments.map((c,i)=>`
        <div class="cmt-item">
          <div class="cmt-hdr">
            <div class="avatar" style="width:28px;height:28px;font-size:10px;background:linear-gradient(135deg,${avatarColor(c.username||'?')[0]},${avatarColor(c.username||'?')[1]})">${esc(initials(c.username||'?'))}</div>
            <span class="cmt-user">@${esc(c.username||'user')}</span>
            <span class="cmt-post" style="margin-left:4px">on: ${esc(c.postCaption)}…</span>
            <span class="${tagCls(c.category)}" style="margin-left:auto">${tagLabel(c.category)}</span>
          </div>
          <div class="cmt-body">${esc(c.text)}</div>
          <div style="display:flex;gap:6px;align-items:center">
            <input class="cmt-reply" id="creply-${i}" type="text" value="${esc(genCommentReply(c))}" placeholder="Write a reply...">
            <button class="btn btn-green" onclick="sendComment(${i})"><i class="ti ti-send"></i> Reply</button>
            <button class="btn btn-red" onclick="hideComment(${i})" title="Hide"><i class="ti ti-eye-off"></i></button>
          </div>
        </div>`).join('')
      : '<div class="empty"><i class="ti ti-message-dots"></i><span>No comments found</span></div>'}
    </div>`);
}

function genCommentReply(c){const n=c.username||'there',cat=c.category;if(cat==='price')return `Hi @${n}! DM us for pricing 💬`;if(cat==='stock')return `Hi @${n}! DM us to check availability 🛍️`;if(cat==='complaint')return `Hi @${n}, so sorry to hear that — please DM us 🙏`;if(cat==='collab')return `Hi @${n}! Please DM us with details 📩`;return `Thanks for your comment @${n}! 🙏`;}
function filterCmts(q){document.querySelectorAll('.cmt-item').forEach(el=>{el.style.display=el.textContent.toLowerCase().includes(q.toLowerCase())?'':'none';});}
async function sendComment(i){const c=G.comments[i],t=document.getElementById(`creply-${i}`)?.value?.trim();if(!t)return;log(`Replying to @${c.username}...`);try{await igPost(`${c.id}/replies`,{message:t});log(`Sent to @${c.username}`,'ok');document.getElementById(`creply-${i}`).value='';}catch(e){log('Reply failed: '+e.message,'err');alert('Failed: '+e.message);}}
async function hideComment(i){const c=G.comments[i];try{await igPost(`${c.id}`,{is_hidden:true});G.comments.splice(i,1);renderCommentsView();log('Comment hidden','ok');}catch(e){log('Hide failed: '+e.message,'err');}}

// ── CATALOG ───────────────────────────────────────────────────────────────────
function renderCatalog() {
  setMain(`
    <div class="tbar"><span class="tbar-title">Product catalog</span><button class="btn btn-grad" onclick="showAddProduct()"><i class="ti ti-plus"></i> Add product</button></div>
    <div style="padding:14px 18px;overflow-y:auto;flex:1">
      ${G.catalog.length ? G.catalog.map((p,i)=>`
        <div class="cat-item">
          <div class="cat-thumb"><i class="ti ti-package"></i></div>
          <div style="flex:1;min-width:0">
            <div class="cat-name">${esc(p.name)}</div>
            <div class="cat-price">${esc(p.price)}</div>
            <div class="cat-stock">${p.stock>0?p.stock+' in stock':'Out of stock'}</div>
            ${p.description?`<div style="font-size:11px;color:var(--text2);margin-top:3px">${esc(p.description)}</div>`:''}
          </div>
          <button class="btn btn-red" style="padding:6px 10px" onclick="G.catalog.splice(${i},1);renderCatalog()"><i class="ti ti-trash"></i></button>
        </div>`).join('')
      : '<div class="empty"><i class="ti ti-shopping-bag"></i><span>Add products so the agent can accurately answer price and stock questions</span></div>'}
      <div id="addProductForm" style="display:none;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rl);padding:14px;margin-top:10px">
        <div style="font-size:13px;font-weight:700;margin-bottom:12px">Add new product</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div><label class="field-label">Product name</label><input id="pName" type="text" class="input-field" placeholder="e.g. Silk Scrunchie Set"></div>
          <div><label class="field-label">Price</label><input id="pPrice" type="text" class="input-field" placeholder="NPR 450"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div><label class="field-label">Stock qty</label><input id="pStock" type="number" min="0" class="input-field" placeholder="0"></div>
          <div><label class="field-label">Short description</label><input id="pDesc" type="text" class="input-field" placeholder="Optional"></div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-grad" onclick="addProduct()"><i class="ti ti-check"></i> Add product</button>
          <button class="btn" onclick="document.getElementById('addProductForm').style.display='none'">Cancel</button>
        </div>
      </div>
    </div>`);
}
function showAddProduct(){document.getElementById('addProductForm').style.display='block';document.getElementById('pName').focus();}
function addProduct(){const n=document.getElementById('pName').value.trim(),p=document.getElementById('pPrice').value.trim(),s=parseInt(document.getElementById('pStock').value)||0,d=document.getElementById('pDesc').value.trim();if(!n||!p){alert('Name and price required');return;}G.catalog.push({name:n,price:p,stock:s,description:d});renderCatalog();log('Added: '+n,'ok');}

// ── BULK MESSAGE ──────────────────────────────────────────────────────────────
function renderBulk() {
  const tpl=G.selectedTemplate;
  const segs=[
    {id:'all',label:'All recent contacts',desc:'Everyone who messaged your page',count:G.dms.length||'—'},
    {id:'inquiries',label:'Product inquirers',desc:'Asked about price or stock',count:G.dms.filter(d=>['price','stock'].includes(d.category)).length||'—'},
    {id:'no_reply',label:'Unanswered DMs',desc:'No reply from you yet',count:G.dms.filter(d=>!d.replied).length||'—'},
    {id:'complaint',label:'Complaints',desc:'Customers who had issues',count:G.dms.filter(d=>d.category==='complaint').length||'—'},
    {id:'custom',label:'Custom list',desc:'Paste usernames manually',count:'✏️'},
  ];
  setMain(`
    <div class="tbar"><span class="tbar-title">Bulk message</span><span style="font-size:12px;color:var(--text2)">Personalised DMs to audience segments</span></div>
    <div class="bulk-shell">
      <div class="bulk-left">
        <div class="sec-hdr"><i class="ti ti-template"></i> 1. Pick a template</div>
        <div class="tpl-grid">
          ${FESTIVALS.map(f=>`
            <div class="tpl-card ${tpl&&tpl.id===f.id?'sel':''}" onclick="selectTemplate('${f.id}')">
              ${f.badge?`<div class="tpl-badge ${f.badge}">${f.badge}</div>`:''}
              <div class="tpl-emoji">${f.emoji}</div>
              <div class="tpl-name">${esc(f.name)}</div>
              <div class="tpl-desc">${esc(f.desc)}</div>
            </div>`).join('')}
        </div>
      </div>
      <div class="bulk-right">
        <div class="sec-hdr"><i class="ti ti-pencil"></i> 2. Compose & send</div>
        <div class="comp-area" id="compArea">
          ${tpl ? `
            <div>
              <label class="field-label">Message</label>
              <div class="var-pills">${['{name}','{discount}','{link}','{date}','{year}','{page}'].map(v=>`<span class="var-pill" onclick="insertVar('${v}')">${v}</span>`).join('')}</div>
              <textarea id="msgText" rows="6" class="draft-text" style="width:100%" oninput="updatePreview()">${esc(tpl.msg)}</textarea>
              <div style="font-size:11px;color:var(--text3);text-align:right;margin-top:3px" id="charCount">${tpl.msg.length} chars</div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <div><label class="field-label">Page / your name</label><input id="varPage" type="text" class="input-field" placeholder="@yourpage" value="${esc(G.pageName)}" oninput="updatePreview()"></div>
              <div><label class="field-label">Discount</label><input id="varDiscount" type="text" class="input-field" placeholder="20% off" oninput="updatePreview()"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <div><label class="field-label">Link</label><input id="varLink" type="text" class="input-field" placeholder="https://..." oninput="updatePreview()"></div>
              <div><label class="field-label">Date / deadline</label><input id="varDate" type="text" class="input-field" placeholder="Oct 15" oninput="updatePreview()"></div>
            </div>
            <div>
              <label class="field-label">Live preview <span style="color:var(--text3);font-weight:400;text-transform:none">(shows as recipient sees it)</span></label>
              <div class="preview-bubble" id="msgPreview">${esc(renderPreview(tpl.msg))}</div>
            </div>
            <div>
              <label class="field-label">Audience</label>
              <div style="display:flex;flex-direction:column;gap:5px">
                ${segs.map(a=>`
                  <div class="aud-row ${G.bulkAudience.includes(a.id)?'chk':''}" onclick="toggleAud('${a.id}',this)">
                    <input type="checkbox" ${G.bulkAudience.includes(a.id)?'checked':''} readonly>
                    <div class="aud-info"><div class="aud-name">${esc(a.label)}</div><div class="aud-meta">${esc(a.desc)}</div></div>
                    <div class="aud-count">${a.count}</div>
                  </div>`).join('')}
              </div>
            </div>
            ${G.bulkAudience.includes('custom')?`
            <div><label class="field-label">Custom usernames (one per line)</label>
            <textarea id="customUsers" rows="3" class="draft-text" style="width:100%" placeholder="@username1&#10;@username2"></textarea></div>`:''}
            <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--rl);padding:12px;display:flex;flex-direction:column;gap:10px">
              <div style="font-size:12px;color:var(--text2)" id="sendSummary">${buildSendSummary()}</div>
              <div class="schedule-row">
                <label><input type="checkbox" id="schedChk" onchange="toggleSched()"> Schedule for later</label>
                <input type="datetime-local" id="schedTime" style="display:none">
              </div>
              <div style="display:flex;gap:8px">
                <button class="btn btn-green" id="sendBtn" onclick="startBulkSend()"><i class="ti ti-send"></i> Send bulk message</button>
                <button class="btn btn-amber" onclick="addToQueue()"><i class="ti ti-clock"></i> Queue</button>
              </div>
              <div id="sendProgress" style="display:none">
                <div class="prog-wrap"><div class="prog-bar" id="progBar" style="width:0%"></div></div>
                <div style="font-size:11px;color:var(--text2);margin-top:4px" id="progLabel">Preparing...</div>
              </div>
            </div>
          ` : '<div class="empty" style="padding:40px"><i class="ti ti-template"></i><span>Select a template on the left</span></div>'}
        </div>
      </div>
    </div>`);
}

function selectTemplate(id){G.selectedTemplate=FESTIVALS.find(f=>f.id===id);G.bulkAudience=[];renderBulk();}

function renderPreview(msg){
  const page=document.getElementById('varPage')?.value||G.pageName||'yourpage';
  const discount=document.getElementById('varDiscount')?.value||'20% off';
  const link=document.getElementById('varLink')?.value||'yourshop.com';
  const date=document.getElementById('varDate')?.value||'this weekend';
  return (msg||'').replace(/\{name\}/g,'Priya').replace(/\{discount\}/g,discount).replace(/\{link\}/g,link).replace(/\{date\}/g,date).replace(/\{page\}/g,page).replace(/\{year\}/g,new Date().getFullYear());
}

function updatePreview(){
  const ta=document.getElementById('msgText'),pre=document.getElementById('msgPreview'),cc=document.getElementById('charCount');
  if(!ta||!pre) return;
  if(G.selectedTemplate) G.selectedTemplate.msg=ta.value;
  pre.textContent=renderPreview(ta.value);
  if(cc) cc.textContent=ta.value.length+' chars';
  const s=document.getElementById('sendSummary');if(s) s.innerHTML=buildSendSummary();
}

function insertVar(v){const ta=document.getElementById('msgText');if(!ta)return;const s=ta.selectionStart,e=ta.selectionEnd;ta.value=ta.value.slice(0,s)+v+ta.value.slice(e);ta.selectionStart=ta.selectionEnd=s+v.length;ta.focus();updatePreview();}

function toggleAud(id,el){const idx=G.bulkAudience.indexOf(id);if(idx>-1)G.bulkAudience.splice(idx,1);else G.bulkAudience.push(id);el.classList.toggle('chk',G.bulkAudience.includes(id));el.querySelector('input').checked=G.bulkAudience.includes(id);updatePreview();if(id==='custom')renderBulk();}

function buildSendSummary(){const n=estimateAud(),tpl=G.selectedTemplate;if(!tpl) return'No template selected.';if(!G.bulkAudience.length) return'Select an audience segment above.';return`Sending <strong>${esc(tpl.name)}</strong> to approx. <strong>${n} people</strong>. Each message personalised with their name.`;}

function estimateAud(){let n=0;G.bulkAudience.forEach(id=>{if(id==='all')n+=Math.max(G.dms.length,1);else if(id==='inquiries')n+=G.dms.filter(d=>['price','stock'].includes(d.category)).length;else if(id==='no_reply')n+=G.dms.filter(d=>!d.replied).length;else if(id==='complaint')n+=G.dms.filter(d=>d.category==='complaint').length;else if(id==='custom'){const ta=document.getElementById('customUsers');n+=(ta?.value||'').split('\n').filter(l=>l.trim()).length;}else n+=1;});return Math.max(n,G.bulkAudience.length?1:0);}

function toggleSched(){const c=document.getElementById('schedChk'),i=document.getElementById('schedTime');if(i)i.style.display=c?.checked?'':'none';}

function getRecipients(){let list=[];G.bulkAudience.forEach(id=>{if(id==='all')list=[...list,...G.dms];else if(id==='inquiries')list=[...list,...G.dms.filter(d=>['price','stock'].includes(d.category))];else if(id==='no_reply')list=[...list,...G.dms.filter(d=>!d.replied)];else if(id==='complaint')list=[...list,...G.dms.filter(d=>d.category==='complaint')];else if(id==='custom'){const ta=document.getElementById('customUsers');const users=(ta?.value||'').split('\n').map(l=>l.trim().replace('@','')).filter(Boolean);list=[...list,...users.map(u=>({sender:u,senderId:null,id:'custom_'+u}))];} });const seen=new Set();return list.filter(r=>{if(seen.has(r.id))return false;seen.add(r.id);return true;});}

async function startBulkSend(){
  if(G.sending){log('Already sending','warn');return;}
  const msgTpl=document.getElementById('msgText')?.value?.trim();
  if(!msgTpl){alert('Write a message first');return;}
  if(!G.bulkAudience.length){alert('Select an audience segment');return;}
  const recipients=getRecipients();
  if(!recipients.length){alert('No recipients found. Load DMs first.');return;}
  const sc=document.getElementById('schedChk'),st=document.getElementById('schedTime')?.value;
  if(sc?.checked&&st){addToQueue(st);return;}
  if(!confirm(`Send to ${recipients.length} people?`))return;
  if(!G.connected){alert('Connect your Instagram account first.');return;}
  G.sending=true;
  const btn=document.getElementById('sendBtn');if(btn){btn.disabled=true;btn.innerHTML='<div class="spinner"></div> Sending...';}
  const prog=document.getElementById('sendProgress');if(prog)prog.style.display='block';
  let sent=0,failed=0;
  for(let i=0;i<recipients.length;i++){
    const r=recipients[i];
    const msg=msgTpl.replace(/\{name\}/g,r.sender?.split(' ')[0]||'there').replace(/\{discount\}/g,document.getElementById('varDiscount')?.value||'').replace(/\{link\}/g,document.getElementById('varLink')?.value||'').replace(/\{date\}/g,document.getElementById('varDate')?.value||'').replace(/\{page\}/g,G.pageName||'').replace(/\{year\}/g,new Date().getFullYear());
    try{if(r.senderId){await igPost('me/messages',{recipient:{id:r.senderId},message:{text:msg}});}else{log(`Skipped @${r.sender} — no ID`,'warn');}sent++;G.queue.push({id:Date.now()+i,recipient:r.sender,preview:msg.slice(0,60),status:'sent',time:new Date().toISOString()});}
    catch(e){failed++;G.queue.push({id:Date.now()+i,recipient:r.sender,preview:msg.slice(0,60),status:'failed',time:new Date().toISOString(),error:e.message});log(`Failed ${r.sender}: ${e.message}`,'err');}
    const pct=Math.round((i+1)/recipients.length*100);
    const pb=document.getElementById('progBar'),pl=document.getElementById('progLabel');
    if(pb)pb.style.width=pct+'%';if(pl)pl.textContent=`Sent ${i+1} of ${recipients.length}${failed?' ('+failed+' failed)':''}`;
    await new Promise(res=>setTimeout(res,350));
  }
  G.sending=false;if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-send"></i> Send bulk message';}
  updateQueueBadge();log(`Bulk send done: ${sent} sent, ${failed} failed`,'ok');alert(`Done! ${sent} sent${failed?', '+failed+' failed':''}.`);
}

function addToQueue(schedTime){
  const msgTpl=document.getElementById('msgText')?.value?.trim();if(!msgTpl){alert('Write a message first');return;}
  const r=getRecipients(),tpl=G.selectedTemplate;
  G.queue.push({id:Date.now(),type:'bulk',name:tpl?.name||'Custom',recipient:`${r.length} recipients`,preview:msgTpl.slice(0,60),status:schedTime?'scheduled':'pending',scheduledFor:schedTime||null,time:new Date().toISOString()});
  updateQueueBadge();log(`Queued "${tpl?.name||'message'}" for ${r.length} people`,'ok');showTab('queue');
}

function updateQueueBadge(){const b=document.getElementById('queueBadge'),n=G.queue.filter(q=>q.status==='pending'||q.status==='scheduled').length;if(b){b.textContent=n||'';b.style.display=n?'':'none';}}

// ── QUEUE ─────────────────────────────────────────────────────────────────────
function renderQueue(){
  setMain(`
    <div class="tbar"><span class="tbar-title">Message queue</span><button class="btn btn-red" onclick="G.queue=G.queue.filter(q=>q.status==='pending'||q.status==='scheduled');updateQueueBadge();renderQueue()"><i class="ti ti-trash"></i> Clear done</button></div>
    <div style="padding:14px 18px;overflow-y:auto;flex:1">
      ${G.queue.length ? G.queue.slice().reverse().map((q,i)=>`
        <div class="q-item">
          <div>
            <div class="qs qs-${q.status}">${q.status}</div>
            ${q.scheduledFor?`<div style="font-size:10px;color:var(--text3);margin-top:4px"><i class="ti ti-clock"></i> ${esc(q.scheduledFor)}</div>`:''}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:700">${esc(q.name||q.recipient)} ${q.type==='bulk'?`<span style="font-size:10px;color:var(--text3)">(${esc(q.recipient)})</span>`:''}</div>
            <div style="font-size:11px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(q.preview)}…</div>
            ${q.error?`<div style="font-size:10px;color:var(--red)">${esc(q.error)}</div>`:''}
          </div>
          <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">
            <span style="font-size:11px;color:var(--text3)">${fmtTime(q.time)}</span>
            ${q.status==='pending'?`<button class="btn btn-green" style="padding:4px 10px;font-size:11px" onclick="sendQueueItem(${G.queue.length-1-i})"><i class="ti ti-send"></i> Send</button>`:''}
          </div>
        </div>`).join('')
      : '<div class="empty"><i class="ti ti-list-check"></i><span>Queue is empty</span><span style="color:var(--text3)">Add bulk messages from the Bulk message tab</span></div>'}
    </div>`);
}

async function sendQueueItem(i){const item=G.queue[i];if(!item||item.status!=='pending')return;if(!G.connected){alert('Connect Instagram first');return;}item.status='sent';updateQueueBadge();renderQueue();log(`Sent queued "${item.name}"`,'ok');}

// ── STATS ─────────────────────────────────────────────────────────────────────
function renderStats(){
  const total=G.dms.length,replied=G.dms.filter(d=>d.replied).length,qSent=G.queue.filter(q=>q.status==='sent').length,rate=total>0?Math.round(replied/total*100):0;
  const byC={};G.dms.forEach(d=>{byC[d.category]=(byC[d.category]||0)+1;});
  setMain(`
    <div class="tbar"><span class="tbar-title">Analytics</span></div>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">Total DMs</div><div class="stat-val">${total}</div><div class="stat-sub">conversations</div></div>
      <div class="stat-card"><div class="stat-label">Replied</div><div class="stat-val">${replied}</div><div class="stat-sub">of ${total}</div></div>
      <div class="stat-card"><div class="stat-label">Reply rate</div><div class="stat-val" style="color:${rate>70?'var(--green)':rate>40?'var(--amber)':'var(--red)'}">${rate}%</div></div>
      <div class="stat-card"><div class="stat-label">Bulk sent</div><div class="stat-val">${qSent}</div><div class="stat-sub">messages</div></div>
      ${G.connected?`<div class="stat-card"><div class="stat-label">Followers</div><div class="stat-val">${G.followers.toLocaleString()}</div><div class="stat-sub">${esc(G.pageName)}</div></div>`:''}
    </div>
    <div style="padding:0 18px 18px">
      <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:12px;text-transform:uppercase;letter-spacing:.06em">DM breakdown</div>
      ${Object.entries(byC).sort((a,b)=>b[1]-a[1]).map(([c,n])=>`
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
          <span class="${tagCls(c)}" style="min-width:110px">${tagLabel(c)}</span>
          <div style="flex:1;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden"><div style="height:100%;width:${total>0?Math.round(n/total*100):0}%;background:linear-gradient(90deg,var(--purple),var(--pink));border-radius:3px"></div></div>
          <span style="font-size:12px;color:var(--text2);min-width:28px;text-align:right;font-weight:600">${n}</span>
        </div>`).join('')||'<div style="font-size:12px;color:var(--text3)">Load DMs to see breakdown</div>'}
    </div>`);
}

// ── INIT ──────────────────────────────────────────────────────────────────────
renderHero();
