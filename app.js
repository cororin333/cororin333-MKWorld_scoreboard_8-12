(()=> {
  'use strict';

  // 互換破棄（安全優先）
  const VERSION = 'mkworld_8_12_noimg_v2_fixed';
  const LS_KEY = 'mkworld:' + location.pathname;

  const SELECT_COLORS = [
    {name:'未選択', color:''},
    {name:'🔴赤', color:'#FE3C4F'},
    {name:'🔵青', color:'#498CF0'},
    {name:'🟡黄', color:'#FFF200'},
    {name:'🟢緑', color:'#57C544'},
  ];
  const AUTO_COLORS = ['#FF7CD5','#7BE0FF','#FD8600','#AD6BFF','#ACF243','#B58464','#FFB5EC','#CCCCCC'];
  const CPU_COLOR = '#4C4C4C';

  const POINTS_12 = [15,12,10,9,8,7,6,5,4,3,2,1];
  const POINTS_24 = [15,12,10,9,9,8,8,7,7,6,6,6,5,5,5,4,4,4,3,3,3,2,2,1];

  const FORMATS = {
    12: [
      {id:'FFA', label:'FFA', teamCount:12},
      {id:'2v2', label:'2v2', teamCount:6},
      {id:'3v3', label:'3v3', teamCount:4},
      {id:'4v4', label:'4v4', teamCount:3},
      {id:'6v6', label:'6v6', teamCount:2},
    ],
    24: [
      {id:'FFA', label:'FFA', teamCount:24},
      {id:'2v2', label:'2v2', teamCount:12},
      {id:'3v3', label:'3v3', teamCount:8},
      {id:'4v4', label:'4v4', teamCount:6},
      {id:'6v6', label:'6v6', teamCount:4},
      {id:'8v8', label:'8v8', teamCount:3},
      {id:'12v12', label:'12v12', teamCount:2},
    ]
  };

  const MAXDIFF = {
    12: {FFA:14,'2v2':24,'3v3':31,'4v4':36,'6v6':40},
    24: {FFA:14,'2v2':24,'3v3':32,'4v4':38,'6v6':49,'8v8':56,'12v12':62},
  };

  const $ = (s)=>document.querySelector(s);

  const selMode = $('#selMode');
  const inpQualify = $('#inpQualify');
  const btnResetTags = $('#btnResetTags');
  const dupKeyMsg = $('#dupKeyMsg');
  const tagTable = $('#tagTable');

  const cpuMiniBody = $('#cpuMiniBody');

  const btnResetAll = $('#btnResetAll');
  const btnPin = $('#btnPin');
  const pinPreview = $('#pinPreview');
  const pinBar = $('#pinBar');
  const pinBarContent = $('#pinBarContent');
  const btnPinClose = $('#btnPinClose');

  const rankWrap = $('#rankWrap');
  const spMaxDiff = $('#spMaxDiff');

  const outMain = $('#outMain');
  const outOpt = $('#outOpt');
  const btnCopyMain = $('#btnCopyMain');
  const btnCopyOpt = $('#btnCopyOpt');

  const chkShowSum = $('#chkShowSum');
  const chkShowCert = $('#chkShowCert');
  const certText = $('#certText');

  const selView = $('#selView');
  const autoCopyMsg = $('#autoCopyMsg');

  const logAdj = $('#logAdj');
  const logCourse = $('#logCourse');
  const chkShowCourseLog = $('#chkShowCourseLog');

  const btnSpec = $('#btnSpec');
  const modalSpec = $('#modalSpec');
  const btnSpecClose = $('#btnSpecClose');

  const state = {
    players: 12,
    races: 8,
    mode: 'FFA',
    qualify: '',
    cpuCalc: 'MKB',
    teams: [],
    cpuKey: 'y',
    cells: {},
    courses: {},
    locks: {},
    adjLog: [],
    showSum: false,
    showCert: true,          // 初期ON（確定）
    optViewTeam: 'none',     // 集計オプション：初期「表示なし」
    showCourseLog: false,
    lastUpdated: 0,
    autosaveOff: false,

    // 内部：自動コピー失敗メッセージ保持
    autoCopyHoldFail: false,
  };

  function nowMs(){ return Date.now(); }
  function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }

  function toHalfWidth(s){
    return s.replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
            .replace(/　/g, ' ');
  }
  function normalizeKey(s){
    if(!s) return '';
    s = toHalfWidth(String(s)).trim();
    if(!s) return '';
    s = Array.from(s)[0];
    if(/[A-Z]/.test(s)) s = s.toLowerCase();
    return s;
  }
  function sanitizeIntInput(s){
    s = toHalfWidth(String(s ?? ''));
    s = s.replace(/[^0-9+\-\.]/g,'');
    let m = s.match(/^([+\-]?)(\d+)(?:\.(\d*))?$/);
    if(!m){
      m = s.match(/^([+\-]?)(\d+)/);
      if(!m) return '';
      return m[1] + m[2];
    }
    return m[1] + m[2];
  }
  function safeParseInt(s){
    if(s === '' || s == null) return 0;
    const n = parseInt(s,10);
    return Number.isFinite(n) ? n : 0;
  }

  function getPlayers(){ return Number(document.querySelector('input[name="players"]:checked')?.value || 12); }
  function getRaces(){ return Number(document.querySelector('input[name="races"]:checked')?.value || 8); }
  function getCpuCalc(){ return String(document.querySelector('input[name="cpuCalc"]:checked')?.value || 'MKB'); }

  function derived(players, modeId){
    const fmt = FORMATS[players].find(f=>f.id===modeId) || FORMATS[players][0];
    const teams = Array.from({length: fmt.teamCount}, (_,i)=>({id:String(i), name:'', key:'', color:'', adj:''}));
    return {fmt, teams};
  }

  // 色選択あり/なし：チーム数4以下のみ（確定）
  function hasColorSelect(teamCount){
    return teamCount <= 4;
  }

  function teamAutoColor(i){ return AUTO_COLORS[i % AUTO_COLORS.length]; }

  function getTeamColorForScoreCell(teamIndex){
    // 順位入力セルの色：色選択ありなら選択色、なしなら自動色
    const {fmt} = derived(state.players, state.mode);
    const t = state.teams[teamIndex];
    if(!t) return '';
    if(hasColorSelect(fmt.teamCount)){
      return t.color || '';
    }
    // 色選択なしは自動色
    return teamAutoColor(teamIndex);
  }

  let saveTimer = null;
  function scheduleSave(){
    if(state.autosaveOff) return;
    state.lastUpdated = nowMs();
    if(saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, 500);
  }
  function doSave(){
    saveTimer = null;
    if(state.autosaveOff) return;
    try{
      const obj = {
        version: VERSION,
        lastUpdated: state.lastUpdated,
        players: state.players,
        races: state.races,
        mode: state.mode,
        qualify: state.qualify,
        cpuCalc: state.cpuCalc,
        teams: state.teams.map(t=>({name:t.name,key:t.key,color:t.color,adj:t.adj})),
        cpuKey: state.cpuKey,
        cells: state.cells,
        courses: state.courses,
        adjLog: state.adjLog,
        showSum: state.showSum,
        showCert: state.showCert,
        optViewTeam: state.optViewTeam,
        showCourseLog: state.showCourseLog,
      };
      localStorage.setItem(LS_KEY, JSON.stringify(obj));
    }catch(e){
      state.autosaveOff = true;
    }
  }

  function loadSaved(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if(!raw) return false;
      const obj = JSON.parse(raw);

      if(!obj || obj.version !== VERSION){
        localStorage.removeItem(LS_KEY);
        return false;
      }

      state.players = obj.players;
      state.races = obj.races;
      state.mode = obj.mode;
      state.qualify = obj.qualify ?? '';
      state.cpuCalc = obj.cpuCalc ?? 'MKB';

      const d = derived(state.players, state.mode);
      state.teams = d.teams;
      for(let i=0;i<state.teams.length;i++){
        const src = obj.teams?.[i];
        if(src){
          state.teams[i].name = src.name ?? '';
          state.teams[i].key = src.key ?? '';
          state.teams[i].color = src.color ?? '';
          state.teams[i].adj = src.adj ?? '';
        }
      }

      state.cpuKey = obj.cpuKey ?? 'y';
      state.cells = obj.cells ?? {};
      state.courses = obj.courses ?? {};
      state.adjLog = Array.isArray(obj.adjLog) ? obj.adjLog : [];

      state.showSum = !!obj.showSum;
      state.showCert = (obj.showCert !== false); // 初期ONを優先
      state.optViewTeam = obj.optViewTeam ?? 'none';
      state.showCourseLog = !!obj.showCourseLog;

      state.lastUpdated = obj.lastUpdated ?? 0;
      return true;
    }catch(e){
      return false;
    }
  }

  function buildModeOptions(){
    selMode.innerHTML = '';
    for(const f of FORMATS[state.players]){
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.label;
      selMode.appendChild(opt);
    }
    selMode.value = state.mode;
  }

  function checkDuplicateKeys(){
    const keys = state.teams.map(t=>t.key).filter(Boolean);
    const set = new Set();
    let dup = false;
    for(const k of keys){
      if(set.has(k)){ dup = true; break; }
      set.add(k);
    }
    dupKeyMsg.textContent = dup ? '異なるキーを設定してください' : '';
    return !dup;
  }

  function getKeyMap(){
    const m = new Map();
    for(const t of state.teams){
      if(t.key) m.set(t.key, t.id);
    }
    return m;
  }

  function getTeamName(i){
    const t = state.teams[i];
    if(!t) return '';
    const nm = (t.name ?? '').trim();
    return nm ? nm : ('チーム' + (i+1));
  }

  // タグ固定：12+CPUは1段、それ以上は2段（wrap任せ、サイズ固定）
  function renderPinPreview(){
    pinPreview.innerHTML = '';
    for(let i=0;i<state.teams.length;i++){
      pinPreview.appendChild(makeBadge(i, false));
    }
    pinPreview.appendChild(makeCpuBadge(false));
  }

  function buildPinBar(){
    pinBarContent.innerHTML = '';
    for(let i=0;i<state.teams.length;i++){
      pinBarContent.appendChild(makeBadge(i, true));
    }
    pinBarContent.appendChild(makeCpuBadge(true));
  }

  function makeBadge(i, forBar){
    const badge = document.createElement('div');
    badge.className = 'badge';
    const top = document.createElement('div');
    top.className = 'badgeTop';
    top.textContent = getTeamName(i);

    // タグ固定は「タグだけ色」確定
    const {fmt} = derived(state.players, state.mode);
    const bg = hasColorSelect(fmt.teamCount) ? (state.teams[i].color || '') : teamAutoColor(i);
    if(bg){
      top.style.background = bg;
      top.style.color = '#000';
    }

    const bot = document.createElement('div');
    bot.className = 'badgeBot';
    bot.textContent = state.teams[i].key || '';

    badge.appendChild(top);
    badge.appendChild(bot);
    return badge;
  }

  function makeCpuBadge(forBar){
    const badge = document.createElement('div');
    badge.className = 'badge';
    const top = document.createElement('div');
    top.className = 'badgeTop';
    top.textContent = '★CPU';
    top.style.background = CPU_COLOR;
    top.style.color = '#fff';

    const bot = document.createElement('div');
    bot.className = 'badgeBot';
    bot.textContent = state.cpuKey || '';

    badge.appendChild(top);
    badge.appendChild(bot);
    return badge;
  }

  // タグ設定：色は「色選択行のみ」確定
  function buildTagTable(){
    const {fmt} = derived(state.players, state.mode);
    const teamCount = fmt.teamCount;
    const colorOn = hasColorSelect(teamCount);

    tagTable.innerHTML = '';
    const tbody = document.createElement('tbody');

    const rows = [];
    rows.push({head:'タグ', kind:'name'});
    if(colorOn) rows.push({head:'色選択', kind:'color'});
    rows.push({head:'キー', kind:'key'});
    rows.push({head:'点数補正', kind:'adj'});

    for(const row of rows){
      const tr = document.createElement('tr');

      const th = document.createElement('th');
      th.className = 'rowHead';
      th.textContent = row.head;
      tr.appendChild(th);

      for(let i=0;i<teamCount;i++){
        const td = document.createElement('td');

        // タグ行：色は塗らない（白）
        if(row.kind==='name'){
          const inp = document.createElement('input');
          inp.className = 'cellInp smalltxt';
          inp.value = state.teams[i]?.name ?? '';
          inp.maxLength = 12;
          inp.autocomplete = 'off';
          inp.addEventListener('input', ()=>{
            state.teams[i].name = inp.value;
            renderPinPreview();
            buildPinBar();
            recalcAll(true);
            recalcOptIfNeeded(true);
            scheduleSave();
          });
          td.appendChild(inp);
        }

        // 色選択行：ここだけセル背景に色を付ける
        if(row.kind==='color'){
          const sel = document.createElement('select');
          sel.className = 'colorSel';
          sel.tabIndex = -1;
          for(const c of SELECT_COLORS){
            const opt = document.createElement('option');
            opt.value = c.color;
            opt.textContent = c.name;
            sel.appendChild(opt);
          }
          sel.value = state.teams[i]?.color ?? '';
          td.style.background = sel.value || '';
          sel.addEventListener('change', ()=>{
            state.teams[i].color = sel.value;
            td.style.background = sel.value || '';
            renderPinPreview();
            buildPinBar();
            recalcAll(true);
            recalcOptIfNeeded(true);
            scheduleSave();
          });
          td.appendChild(sel);
        }

        if(row.kind==='key'){
          const inp = document.createElement('input');
          inp.className = 'cellInp';
          inp.value = state.teams[i]?.key ?? '';
          inp.maxLength = 2;
          inp.autocomplete = 'off';
          inp.addEventListener('input', ()=>{
            const v = normalizeKey(inp.value);
            inp.value = v;
            state.teams[i].key = v;
            checkDuplicateKeys();
            renderPinPreview();
            buildPinBar();
            recalcAll(true);
            recalcOptIfNeeded(true);
            scheduleSave();
          });
          td.appendChild(inp);
        }

        if(row.kind==='adj'){
          const inp = document.createElement('input');
          inp.className = 'cellInp';
          inp.value = state.teams[i]?.adj ?? '';
          inp.autocomplete = 'off';
          inp.inputMode = 'numeric';
          inp.addEventListener('input', ()=>{
            const v = sanitizeIntInput(inp.value);
            inp.value = v;
            state.teams[i].adj = v;
            recalcAll(true);
            recalcOptIfNeeded(true);
            scheduleSave();
          });
          td.appendChild(inp);
        }

        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }

    tagTable.appendChild(tbody);

    buildCpuMini(colorOn);

    checkDuplicateKeys();
    renderPinPreview();
    buildPinBar();
  }

  // ★CPU：色選択ありなら「タグ/色(グレー)/キー」、なしなら「タグ/キー」
  function buildCpuMini(colorOn){
    cpuMiniBody.innerHTML = '';

    const rTag = document.createElement('div');
    rTag.className = 'cpuRow';
    const tag = document.createElement('div');
    tag.className = 'cpuTag';
    tag.textContent = '★CPU';
    rTag.appendChild(tag);
    cpuMiniBody.appendChild(rTag);

    if(colorOn){
      const rColor = document.createElement('div');
      rColor.className = 'cpuRow cpuColorFixed';
      rColor.title = '固定グレー';
      cpuMiniBody.appendChild(rColor);
    }

    const rKey = document.createElement('div');
    rKey.className = 'cpuRow';
    const inp = document.createElement('input');
    inp.className = 'cpuKeyInp';
    inp.maxLength = 2;
    inp.autocomplete = 'off';
    inp.value = state.cpuKey ?? 'y';
    inp.addEventListener('input', ()=>{
      const v = normalizeKey(inp.value);
      inp.value = v;
      state.cpuKey = v;
      renderPinPreview();
      buildPinBar();
      recalcAll(true);
      recalcOptIfNeeded(true);
      scheduleSave();
    });
    rKey.appendChild(inp);
    cpuMiniBody.appendChild(rKey);
  }

  // 集計オプション：先頭「表示なし」、表示なしなら計算しない
  function buildOptViewOptions(){
    selView.innerHTML = '';

    const o0 = document.createElement('option');
    o0.value = 'none';
    o0.textContent = '表示なし';
    selView.appendChild(o0);

    for(const t of state.teams){
      const o = document.createElement('option');
      o.value = t.id;
      o.textContent = (t.name?.trim() ? t.name.trim() : ('チーム' + (Number(t.id)+1)));
      selView.appendChild(o);
    }

    selView.value = state.optViewTeam;
  }

  function buildRankTable(){
    rankWrap.innerHTML = '';
    const players = state.players;
    const races = state.races;
    const points = (players===12) ? POINTS_12 : POINTS_24;

    const tbl = document.createElement('table');
    tbl.className = 'rankTable';

    // header 1
    const tr0 = document.createElement('tr');
    const thPts = document.createElement('th'); thPts.className='ptsCol headTop'; thPts.textContent='得点';
    const thRank = document.createElement('th'); thRank.className='rankCol headTop'; thRank.textContent='順位';
    tr0.appendChild(thPts); tr0.appendChild(thRank);

    const thRace = document.createElement('th');
    thRace.className='headTop';
    thRace.colSpan = races;
    thRace.textContent='レース';
    tr0.appendChild(thRace);
    tbl.appendChild(tr0);

    // header 2
    const tr1 = document.createElement('tr');
    const thA = document.createElement('th'); thA.className='ptsCol'; thA.textContent='';
    const thB = document.createElement('th'); thB.className='rankCol'; thB.textContent='';
    tr1.appendChild(thA); tr1.appendChild(thB);
    for(let r=0;r<races;r++){
      const th = document.createElement('th');
      th.textContent = String(r+1);
      th.classList.add('thin');
      tr1.appendChild(th);
    }
    tbl.appendChild(tr1);

    // rows
    for(let p=0;p<players;p++){
      const tr = document.createElement('tr');
      if(players===24 && p===12) tr.classList.add('sepRow');

      const tdPts = document.createElement('td'); tdPts.className='ptsCol'; tdPts.textContent = String(points[p]);
      const tdRank = document.createElement('td'); tdRank.className='rankCol'; tdRank.textContent = String(p+1);
      tr.appendChild(tdPts); tr.appendChild(tdRank);

      for(let r=0;r<races;r++){
        const td = document.createElement('td');
        td.classList.add('thin');

        // wrapper
        const box = document.createElement('div');
        box.className = 'rankCell';

        const inp = document.createElement('input');
        inp.className = 'rankKey';
        inp.autocomplete = 'off';
        inp.inputMode = 'text';
        inp.value = state.cells?.[r]?.[p] ?? '';
        inp.dataset.race = String(r);
        inp.dataset.pos = String(p);

        // タブ順は後でまとめて制御
        inp.addEventListener('focus', ()=>{
          // 「タグのまま編集」＝選択して次キーで置換
          try{ inp.select(); }catch(e){}
        });

        inp.addEventListener('input', ()=>{
          const v = normalizeKey(inp.value);
          inp.value = v;
          if(!state.cells[r]) state.cells[r] = {};
          state.cells[r][p] = v;

          // 表示更新
          updateRankCellDisplay(td, r, p);

          // 1文字確定で次セル
          if(v !== '') focusNextCell(r,p);

          // 再計算
          const ok = recalcAll(true);
          if(ok) maybeAutoCopyMain();
          recalcOptIfNeeded(true);
          scheduleSave();
        });

        const disp = document.createElement('div');
        disp.className = 'rankDisp';

        box.appendChild(inp);
        box.appendChild(disp);

        td.appendChild(box);
        tr.appendChild(td);
      }
      tbl.appendChild(tr);
    }

    // course row
    const trC = document.createElement('tr');
    const tdC0 = document.createElement('td'); tdC0.className='ptsCol'; tdC0.textContent='コース'; tdC0.colSpan=2;
    trC.appendChild(tdC0);
    for(let r=0;r<races;r++){
      const td = document.createElement('td');
      td.classList.add('thin');
      const inp = document.createElement('input');
      inp.className='courseInp';
      inp.value = state.courses?.[r] ?? '';
      inp.dataset.race=String(r);
      inp.autocomplete='off';
      inp.addEventListener('input', ()=>{
        state.courses[r] = inp.value;
        const ok = recalcAll(true);
        if(ok) maybeAutoCopyMain();
        recalcOptIfNeeded(true);
        scheduleSave();
      });
      td.appendChild(inp);
      trC.appendChild(td);
    }
    tbl.appendChild(trC);

    // miss row (枠なし)
    const trM = document.createElement('tr');
    const tdM0 = document.createElement('td'); tdM0.className='ptsCol missCol'; tdM0.textContent=''; tdM0.colSpan=2;
    trM.appendChild(tdM0);
    for(let r=0;r<races;r++){
      const td = document.createElement('td');
      td.className='missCol';
      td.id = 'miss_'+r;
      trM.appendChild(td);
    }
    tbl.appendChild(trM);

    // lock row (行は残す)
    const trL = document.createElement('tr');
    const tdL0 = document.createElement('td'); tdL0.className='ptsCol'; tdL0.textContent=''; tdL0.colSpan=2;
    trL.appendChild(tdL0);
    for(let r=0;r<races;r++){
      const td = document.createElement('td');
      td.classList.add('thin');
      const btn = document.createElement('button');
      btn.className='lockBtn';
      btn.type='button';
      btn.textContent = state.locks[r] ? '🔒' : '🔓';
      btn.addEventListener('click', ()=>{
        state.locks[r] = !state.locks[r];
        btn.textContent = state.locks[r] ? '🔒' : '🔓';
        applyLocks();
        rebuildTabOrder();
      });
      td.appendChild(btn);
      trL.appendChild(td);
    }
    tbl.appendChild(trL);

    rankWrap.appendChild(tbl);

    // 初期表示更新
    for(let r=0;r<state.races;r++){
      for(let p=0;p<state.players;p++){
        const td = getRankTd(r,p);
        if(td) updateRankCellDisplay(td, r, p);
      }
    }

    applyLocks();
    rebuildTabOrder();
  }

  function getRankTd(r,p){
    const tbl = rankWrap.querySelector('table');
    if(!tbl) return null;
    return tbl.querySelector(`input.rankKey[data-race="${r}"][data-pos="${p}"]`)?.closest('td') ?? null;
  }

  // 表示（タグ化）＋色反映
  function updateRankCellDisplay(td, r, p){
    const inp = td.querySelector('input.rankKey');
    const disp = td.querySelector('.rankDisp');
    const raw = (state.cells?.[r]?.[p] ?? '').trim();

    let label = '';
    let bg = '';

    if(raw === ''){
      label = '';
      bg = '';
    }else if(raw === state.cpuKey){
      label = '★CPU';
      bg = CPU_COLOR;
    }else{
      const keyMap = getKeyMap();
      const tid = keyMap.get(raw);
      if(tid == null){
        label = raw; // 無効キーはそのまま
        bg = '';
      }else{
        const idx = Number(tid);
        label = getTeamName(idx);
        bg = getTeamColorForScoreCell(idx);
      }
    }

    disp.textContent = label;
    td.style.background = bg || '';
  }

  function applyLocks(){
    const tbl = rankWrap.querySelector('table');
    if(!tbl) return;
    for(let r=0;r<state.races;r++){
      const locked = !!state.locks[r];
      tbl.querySelectorAll(`input.rankKey[data-race="${r}"]`).forEach(inp=>{
        inp.disabled = locked;
      });
      const course = tbl.querySelector(`input.courseInp[data-race="${r}"]`);
      if(course) course.disabled = locked;
    }
  }

  function focusNextCell(r,p){
    let nr = r, np = p+1;
    if(np >= state.players){ np = 0; nr = r+1; }
    if(nr >= state.races) return;
    const next = rankWrap.querySelector(`input.rankKey[data-race="${nr}"][data-pos="${np}"]`);
    if(next && !next.disabled) next.focus();
  }

  // Tab順（確定仕様）
  function rebuildTabOrder(){
    // 1) タグ設定：右→左（タグ → キー → 点数補正）
    // 2) 順位入力：レースごと（1位→…→24位→コース名→次レース）
    // ルール設定、色選択は Tab対象外

    // ルール設定
    inpQualify.tabIndex = -1;
    document.querySelectorAll('.colorSel').forEach(el => el.tabIndex = -1);

    // まず全て -1
    document.querySelectorAll('input,select,button').forEach(el=>{
      // ボタンは通常どおりTab可にしたいものもあるが、ここでは入力系だけ制御
      if(el.classList.contains('cellInp') || el.classList.contains('cpuKeyInp') || el.classList.contains('rankKey') || el.classList.contains('courseInp')){
        el.tabIndex = -1;
      }
    });

    // タグ設定：タグ行→キー行→点数補正行（右→左）
    const rows = Array.from(tagTable.querySelectorAll('tr'));
    const rowByHead = new Map();
    for(const tr of rows){
      const th = tr.querySelector('th.rowHead');
      if(!th) continue;
      rowByHead.set(th.textContent.trim(), tr);
    }
    const orderHeads = ['タグ','キー','点数補正'];
    let tab = 1;

    for(const head of orderHeads){
      const tr = rowByHead.get(head);
      if(!tr) continue;
      const inputs = Array.from(tr.querySelectorAll('input.cellInp'));
      // 右→左＝後ろから
      for(let i=inputs.length-1;i>=0;i--){
        inputs[i].tabIndex = tab++;
      }
    }

    // CPUキーは最後（タグ設定の後）
    const cpuKey = cpuMiniBody.querySelector('input.cpuKeyInp');
    if(cpuKey) cpuKey.tabIndex = tab++;

    // 順位入力：レース→順位→コース
    for(let r=0;r<state.races;r++){
      for(let p=0;p<state.players;p++){
        const inp = rankWrap.querySelector(`input.rankKey[data-race="${r}"][data-pos="${p}"]`);
        if(inp && !inp.disabled){
          inp.tabIndex = tab++;
        }
      }
      const course = rankWrap.querySelector(`input.courseInp[data-race="${r}"]`);
      if(course && !course.disabled){
        course.tabIndex = tab++;
      }
    }
  }

  function clearRaceErrors(){
    for(let r=0;r<state.races;r++){
      const miss = document.getElementById('miss_'+r);
      if(miss) miss.textContent = '';
    }
  }

  function markRaceError(r, msg){
    const miss = document.getElementById('miss_'+r);
    if(miss) miss.textContent = msg;
  }

  function allCellsFilled(r){
    for(let p=0;p<state.players;p++){
      if((state.cells?.[r]?.[p] ?? '') === '') return false;
    }
    return true;
  }
  function countEmpties(r){
    let c=0;
    for(let p=0;p<state.players;p++){
      if((state.cells?.[r]?.[p] ?? '') === '') c++;
    }
    return c;
  }

  function buildCertText(standings, remaining, qualifyRaw){
    const maxDiff = MAXDIFF[state.players][state.mode] ?? 0;
    if(standings.length < 2) return '';
    const diff12 = standings[0].displayTotal - standings[1].displayTotal;
    const win = diff12 > maxDiff * remaining;

    if(standings.length === 2){
      return win ? '▶︎勝利確定' : '';
    }
    const q = safeParseInt(sanitizeIntInput(qualifyRaw));
    if(q > 0){
      if(win) return '▶︎1位確定';
      const k = clamp(q,1,standings.length-1);
      const a = standings[k-1];
      const b = standings[k];
      const diff = a.displayTotal - b.displayTotal;
      const qual = diff > maxDiff * remaining;
      return qual ? '▶︎通過確定' : '';
    }
    return win ? '▶︎1位確定' : '';
  }

  function hasAnyAdjInput(){
    for(const t of state.teams){
      const v = sanitizeIntInput(t.adj);
      if(v && v !== '0') return true;
    }
    return false;
  }

  function renderAdjLog(){
    const lines = [];
    for(const t of state.teams){
      const v = sanitizeIntInput(t.adj);
      if(v && v !== '0'){
        const idx = Number(t.id);
        const name = getTeamName(idx);
        lines.push(`${name} ${v}`);
      }
    }
    logAdj.textContent = lines.join('\n');
  }

  function renderCourseLog(courseLog){
    if(!state.showCourseLog){
      logCourse.textContent = '';
      return;
    }
    const lines = [];
    for(let r=0;r<state.races;r++){
      const c = (courseLog?.[r] ?? '').trim();
      if(c) lines.push(`${r+1}レース目 ${c}`);
    }
    logCourse.textContent = lines.join('\n');
  }

  async function copyText(text){
    try{
      await navigator.clipboard.writeText(text);
      return true;
    }catch(e){
      try{
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      }catch(e2){
        return false;
      }
    }
  }

  // ===== 計算：メイン =====
  function calcStandings(){
    clearRaceErrors();

    if(!checkDuplicateKeys()){
      return {ok:false, reason:'dup'};
    }

    const players = state.players;
    const races = state.races;
    const points = (players===12) ? POINTS_12 : POINTS_24;
    const keyMap = getKeyMap();

    const teamCount = state.teams.length;
    const teamTotals = Array(teamCount).fill(0);
    const raceScores = {};
    const courseLog = [];

    const requiredPerTeam = Math.floor(players / teamCount);
    let frozen = false;

    for(let r=0;r<races;r++){
      const filled = allCellsFilled(r);
      const empties = countEmpties(r);

      const counts = Array(teamCount).fill(0);
      let cpuCount = 0;
      let hasInvalid = false;

      for(let p=0;p<players;p++){
        const raw = state.cells?.[r]?.[p] ?? '';
        if(raw === '') continue;
        if(raw === state.cpuKey && raw !== ''){ cpuCount++; continue; }
        const tid = keyMap.get(raw);
        if(tid == null){ hasInvalid = true; continue; }
        counts[Number(tid)]++;
      }

      const shortages = counts.map(c=> requiredPerTeam - c);
      const overage = shortages.some(x=>x<0);
      const shortageSum = shortages.reduce((a,b)=> a + Math.max(0,b), 0);
      const shortageTeams = shortages.map((s,i)=> s>0 ? i : -1).filter(i=>i>=0);

      const canAuto = (
        cpuCount === 0 &&
        !overage &&
        shortageTeams.length === 1 &&
        empties > 0 &&
        shortageSum === empties
      );

      const complete = filled || canAuto;

      if(complete){
        if((cpuCount>0 || shortageSum>0) && cpuCount !== shortageSum){
          markRaceError(r,'入力ミス');
          frozen = true;
          continue;
        }
      }

      if(!complete){
        continue;
      }

      if(hasInvalid){
        markRaceError(r,'入力ミス');
        frozen = true;
        continue;
      }

      const teamScore = Array(teamCount).fill(0);

      for(let p=0;p<players;p++){
        const raw = state.cells?.[r]?.[p] ?? '';
        let teamIdx = null;

        if(raw === ''){
          if(canAuto) teamIdx = shortageTeams[0];
        }else if(raw === state.cpuKey){
          continue;
        }else{
          const tid = keyMap.get(raw);
          if(tid != null) teamIdx = Number(tid);
        }

        if(teamIdx != null){
          teamScore[teamIdx] += points[p];
        }
      }

      if(shortageSum > 0){
        const cpuPoints = [];
        for(let p=0;p<players;p++){
          const raw = state.cells?.[r]?.[p] ?? '';
          if(raw === state.cpuKey) cpuPoints.push(points[p]);
        }
        let adopted = 0;
        if(cpuPoints.length){
          if(state.cpuCalc === 'MKB') adopted = Math.min(...cpuPoints);
          else adopted = Math.floor(cpuPoints.reduce((a,b)=>a+b,0) / cpuPoints.length);
        }
        for(let i=0;i<teamCount;i++){
          const s = shortages[i];
          if(s>0) teamScore[i] += adopted * s;
        }
      }

      raceScores[r] = {};
      for(let i=0;i<teamCount;i++){
        teamTotals[i] += teamScore[i];
        raceScores[r][String(i)] = teamScore[i];
      }
      courseLog[r] = state.courses?.[r] ?? '';
    }

    if(frozen){
      return {ok:false, reason:'race'};
    }

    const adjVals = state.teams.map(t=> safeParseInt(t.adj));
    const displayTotals = teamTotals.map((t,i)=> t + adjVals[i]);

    const standings = state.teams.map((t,i)=>({
      teamId: t.id,
      idx: i,
      name: getTeamName(i),
      total: teamTotals[i],
      displayTotal: displayTotals[i],
    })).sort((a,b)=> b.displayTotal - a.displayTotal);

    const completed = Object.keys(raceScores).length;
    const remaining = clamp(races - completed, 0, races);

    return {ok:true, standings, remaining, courseLog};
  }

  // メイン表示生成（自チーム=0）
  function buildMainLine(standings, remaining){
    const selfIdx = 0;
    const self = standings.find(s=>s.idx===selfIdx);
    const selfTotal = self ? self.displayTotal : 0;

    const showSum = !!state.showSum;
    const parts = [];

    for(const s of standings){
      if(s.idx === selfIdx){
        parts.push(`【${s.name}】 ${s.displayTotal}`);
        continue;
      }
      const diff = s.displayTotal - selfTotal;
      if(showSum){
        const sign = (diff>=0) ? `+${diff}` : `${diff}`;
        parts.push(`${s.name} ${s.displayTotal}(${sign})`);
      }else{
        const sign = (diff>=0) ? `+${diff}` : `${diff}`;
        parts.push(`${s.name} ${sign}`);
      }
    }

    // 自チーム順位
    let rankLabel = '';
    if(self){
      const idx = standings.findIndex(x=>x.idx===selfIdx);
      rankLabel = (remaining===0) ? `最終${idx+1}位` : `現在${idx+1}位`;
    }

    // 最新コース（最後に入力されたもの）
    let course = '';
    for(let r=state.races-1;r>=0;r--){
      const c = (state.courses?.[r] ?? '').trim();
      if(c){ course = c; break; }
    }

    let line = parts.join('／');
    if(rankLabel) line += `／${rankLabel}`;
    if(course) line += `／${course}`;
    line += `＠${remaining}`;

    if(hasAnyAdjInput()){
      line += ` (補正込)`;
    }

    if(state.showCert){
      const cert = buildCertText(standings, remaining, state.qualify);
      if(cert) line += cert;
    }

    return line;
  }

  // オプション表示（基準=選択チーム）
  function buildOptLine(standings, remaining, baseIdx){
    const base = standings.find(s=>s.idx===baseIdx);
    const baseTotal = base ? base.displayTotal : 0;

    const showSum = !!state.showSum; // 表示オプションは共通でOK
    const parts = [];

    for(const s of standings){
      if(s.idx === baseIdx){
        parts.push(`【${s.name}】 ${s.displayTotal}`);
        continue;
      }
      const diff = s.displayTotal - baseTotal;
      if(showSum){
        const sign = (diff>=0) ? `+${diff}` : `${diff}`;
        parts.push(`${s.name} ${s.displayTotal}(${sign})`);
      }else{
        const sign = (diff>=0) ? `+${diff}` : `${diff}`;
        parts.push(`${s.name} ${sign}`);
      }
    }

    // 基準チーム順位
    let rankLabel = '';
    if(base){
      const idx = standings.findIndex(x=>x.idx===baseIdx);
      rankLabel = (remaining===0) ? `最終${idx+1}位` : `現在${idx+1}位`;
    }

    // 最新コース
    let course = '';
    for(let r=state.races-1;r>=0;r--){
      const c = (state.courses?.[r] ?? '').trim();
      if(c){ course = c; break; }
    }

    let line = parts.join('／');
    if(rankLabel) line += `／${rankLabel}`;
    if(course) line += `／${course}`;
    line += `＠${remaining}`;

    if(hasAnyAdjInput()){
      line += ` (補正込)`;
    }

    // 勝ち確も通常同様
    if(state.showCert){
      const cert = buildCertText(standings, remaining, state.qualify);
      if(cert) line += cert;
    }

    return line;
  }

  // メイン再計算：返り値 ok
  function recalcAll(doLogs){
    const res = calcStandings();
    if(!res.ok){
      // 出力凍結（今のまま）
      certText.textContent = '';
      renderAdjLog();
      if(!state.showCourseLog) logCourse.textContent = '';
      return false;
    }

    const {standings, remaining, courseLog} = res;

    certText.textContent = state.showCert ? buildCertText(standings, remaining, state.qualify) : '';

    const line = buildMainLine(standings, remaining);
    outMain.textContent = line;

    renderAdjLog();
    renderCourseLog(courseLog);

    return true;
  }

  // メイン自動コピー（メイン更新タイミングで呼ぶ）
  async function maybeAutoCopyMain(){
    // 失敗保持中は、手動コピーで解除する仕様なのでここでは上書きしない
    if(state.autoCopyHoldFail) return;

    autoCopyMsg.textContent = '';
    autoCopyMsg.className = 'autoCopyMsg';

    const ok = await copyText(outMain.textContent);
    if(ok){
      autoCopyMsg.textContent = '★自動コピーしました';
      autoCopyMsg.classList.add('ok');
      setTimeout(()=>{
        if(autoCopyMsg.textContent === '★自動コピーしました'){
          autoCopyMsg.textContent = '';
          autoCopyMsg.className = 'autoCopyMsg';
        }
      }, 10000);
    }else{
      autoCopyMsg.textContent = '★自動コピーできませんでした';
      autoCopyMsg.classList.add('ng');
      state.autoCopyHoldFail = true;
    }
  }

  // 集計オプション：表示なしなら計算しない/空
  function recalcOptIfNeeded(){
    if(state.optViewTeam === 'none'){
      outOpt.textContent = '';
      return;
    }
    const baseIdx = Number(state.optViewTeam);
    if(!Number.isFinite(baseIdx) || baseIdx < 0 || baseIdx >= state.teams.length){
      outOpt.textContent = '';
      return;
    }

    const res = calcStandings();
    if(!res.ok){
      // 表示は凍結ではなく空にするほうが混同しにくい
      outOpt.textContent = '';
      return;
    }

    const {standings, remaining} = res;
    outOpt.textContent = buildOptLine(standings, remaining, baseIdx);
  }

  function pruneInputs(){
    const players = state.players;
    const races = state.races;

    const newCells = {};
    for(let r=0;r<races;r++){
      const row = state.cells?.[r] ?? {};
      const nr = {};
      for(let p=0;p<players;p++){
        nr[p] = row?.[p] ?? '';
      }
      newCells[r] = nr;
    }
    state.cells = newCells;

    const nc = {};
    for(let r=0;r<races;r++){
      nc[r] = state.courses?.[r] ?? '';
    }
    state.courses = nc;

    const nl = {};
    for(let r=0;r<races;r++) nl[r] = !!state.locks?.[r];
    state.locks = nl;
  }

  function onRuleChange(){
    const prevPlayers = state.players;
    const prevMode = state.mode;

    state.players = getPlayers();
    state.races = getRaces();
    state.cpuCalc = getCpuCalc();

    const list = FORMATS[state.players];
    if(!list.some(x=>x.id===state.mode)) state.mode = list[0].id;

    buildModeOptions();

    if(prevPlayers !== state.players || prevMode !== state.mode){
      // players or mode change: adjustment/log clear（仕様）
      for(const t of state.teams) t.adj = '';
      state.adjLog = [];
    }

    const d = derived(state.players, state.mode);
    const old = state.teams;
    state.teams = d.teams;
    for(let i=0;i<state.teams.length;i++){
      if(old[i]){
        state.teams[i].name = old[i].name ?? '';
        state.teams[i].key = old[i].key ?? '';
        state.teams[i].color = old[i].color ?? '';
        state.teams[i].adj = old[i].adj ?? '';
      }
    }

    pruneInputs();

    spMaxDiff.textContent = String(MAXDIFF[state.players][state.mode] ?? '--');

    // 集計オプションの選択が範囲外なら表示なしへ
    if(state.optViewTeam !== 'none'){
      const n = Number(state.optViewTeam);
      if(!Number.isFinite(n) || n < 0 || n >= state.teams.length){
        state.optViewTeam = 'none';
      }
    }

    buildTagTable();
    buildOptViewOptions();
    buildRankTable();

    const ok = recalcAll(true);
    if(ok) maybeAutoCopyMain();
    recalcOptIfNeeded(true);

    scheduleSave();
  }

  function resetTags(){
    const q = 'qwertyuiopasdfghjklzxcvbnm';
    for(let i=0;i<state.teams.length;i++){
      state.teams[i].name = '';
      state.teams[i].key = (i < q.length) ? q[i] : '';
      state.teams[i].color = '';
      state.teams[i].adj = '';
    }
    state.cpuKey = 'y';
    state.adjLog = [];

    buildTagTable();
    buildOptViewOptions();

    // 順位表示更新（色・タグ）
    for(let r=0;r<state.races;r++){
      for(let p=0;p<state.players;p++){
        const td = getRankTd(r,p);
        if(td) updateRankCellDisplay(td, r, p);
      }
    }

    const ok = recalcAll(true);
    if(ok) maybeAutoCopyMain();
    recalcOptIfNeeded(true);

    scheduleSave();
  }

  function resetAll(){
    try{ localStorage.removeItem(LS_KEY); }catch(e){}
    location.reload();
  }

  function openModal(){ modalSpec.classList.remove('hidden'); modalSpec.setAttribute('aria-hidden','false'); }
  function closeModal(){ modalSpec.classList.add('hidden'); modalSpec.setAttribute('aria-hidden','true'); }

  function showPin(){ buildPinBar(); pinBar.classList.remove('hidden'); pinBar.setAttribute('aria-hidden','false'); }
  function hidePin(){ pinBar.classList.add('hidden'); pinBar.setAttribute('aria-hidden','true'); }

  function init(){
    // 互換破棄：バージョン違いはloadSavedが消す
    const restored = loadSaved();

    document.querySelectorAll('input[name="players"]').forEach(r=>{
      r.checked = (Number(r.value) === state.players);
      r.addEventListener('change', onRuleChange);
    });
    document.querySelectorAll('input[name="races"]').forEach(r=>{
      r.checked = (Number(r.value) === state.races);
      r.addEventListener('change', onRuleChange);
    });
    document.querySelectorAll('input[name="cpuCalc"]').forEach(r=>{
      r.checked = (r.value === state.cpuCalc);
      r.addEventListener('change', onRuleChange);
    });

    buildModeOptions();
    selMode.value = state.mode;
    selMode.addEventListener('change', ()=>{ state.mode = selMode.value; onRuleChange(); });

    inpQualify.value = state.qualify ?? '';
    inpQualify.addEventListener('input', ()=>{
      const v = sanitizeIntInput(inpQualify.value);
      inpQualify.value = v;
      state.qualify = v;
      const ok = recalcAll(true);
      if(ok) maybeAutoCopyMain();
      recalcOptIfNeeded(true);
      scheduleSave();
    });

    btnResetTags.addEventListener('click', resetTags);
    btnResetAll.addEventListener('click', resetAll);

    btnCopyMain.addEventListener('click', async ()=>{
      // 手動コピーでは自動コピー表示は出さない
      await copyText(outMain.textContent);
      // 失敗保持解除（次の手動コピー押下まで、なのでここで解除）
      state.autoCopyHoldFail = false;
      autoCopyMsg.textContent = '';
      autoCopyMsg.className = 'autoCopyMsg';
    });

    btnCopyOpt.addEventListener('click', async ()=>{
      await copyText(outOpt.textContent);
      // 手動コピーなので自動コピー系メッセージは出さない
    });

    chkShowSum.checked = state.showSum;
    chkShowCert.checked = state.showCert;
    chkShowCourseLog.checked = state.showCourseLog;

    chkShowSum.addEventListener('change', ()=>{
      state.showSum = chkShowSum.checked;
      const ok = recalcAll(true);
      if(ok) maybeAutoCopyMain();
      recalcOptIfNeeded(true);
      scheduleSave();
    });
    chkShowCert.addEventListener('change', ()=>{
      state.showCert = chkShowCert.checked;
      const ok = recalcAll(true);
      if(ok) maybeAutoCopyMain();
      recalcOptIfNeeded(true);
      scheduleSave();
    });
    chkShowCourseLog.addEventListener('change', ()=>{
      state.showCourseLog = chkShowCourseLog.checked;
      const ok = recalcAll(true);
      if(ok) maybeAutoCopyMain();
      recalcOptIfNeeded(true);
      scheduleSave();
    });

    buildOptViewOptions();
    selView.addEventListener('change', ()=>{
      state.optViewTeam = selView.value;
      // 表示なしなら計算しない
      recalcOptIfNeeded(true);
      scheduleSave();
    });

    btnPin.addEventListener('click', showPin);
    btnPinClose.addEventListener('click', hidePin);

    btnSpec.addEventListener('click', openModal);
    btnSpecClose.addEventListener('click', closeModal);
    modalSpec.querySelector('.modalBack')?.addEventListener('click', closeModal);

    if(!state.teams.length){
      const d = derived(state.players, state.mode);
      state.teams = d.teams;
      resetTags();
    }

    spMaxDiff.textContent = String(MAXDIFF[state.players][state.mode] ?? '--');

    buildTagTable();
    buildOptViewOptions();
    buildRankTable();

    const ok = recalcAll(false);
    if(ok) maybeAutoCopyMain();
    recalcOptIfNeeded(false);

    if(!restored){
      state.lastUpdated = nowMs();
      doSave();
    }else{
      rebuildTabOrder();
    }
  }

  init();
})();
