(()=> {
  'use strict';

  const VERSION = 'mkworld_prod_v1';
  const LS_KEY = 'mkworld:' + location.pathname;

  /* ========= 定数 ========= */

  const POINTS_12 = [15,12,10,9,8,7,6,5,4,3,2,1];
  const POINTS_24 = [15,12,10,9,9,8,8,7,7,6,6,6,5,5,5,4,4,4,3,3,3,2,2,1];

  const FORMATS = {
    12: [
      {id:'FFA', teamCount:12},
      {id:'2v2', teamCount:6},
      {id:'3v3', teamCount:4},
      {id:'4v4', teamCount:3},
      {id:'6v6', teamCount:2},
    ],
    24: [
      {id:'FFA', teamCount:24},
      {id:'2v2', teamCount:12},
      {id:'3v3', teamCount:8},
      {id:'4v4', teamCount:6},
      {id:'6v6', teamCount:4},
      {id:'8v8', teamCount:3},
      {id:'12v12', teamCount:2},
    ]
  };

  const MAXDIFF = {
    12:{FFA:14,'2v2':24,'3v3':31,'4v4':36,'6v6':40},
    24:{FFA:14,'2v2':24,'3v3':32,'4v4':38,'6v6':49,'8v8':56,'12v12':62},
  };

  const AUTO_COLORS = [
    '#FE3C4F','#498CF0','#FFF200','#57C544',
    '#FF7CD5','#7BE0FF','#FD8600','#AD6BFF',
    '#ACF243','#B58464','#FFB5EC','#CCCCCC'
  ];

  /* ========= state ========= */

  const state = {
    players:24,
    races:12,
    mode:'6v6',
    cpuCalc:'MKB',
    teams:[],
    cells:{},
    courses:{},
    showSum:false,
    showCert:true,
    optView:'none'
  };

  /* ========= util ========= */

  const $ = s => document.querySelector(s);
  const toHalf = s => s.replace(/[！-～]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/　/g,' ');
  const normKey = s => {
    if(!s) return '';
    s = toHalf(s).trim();
    return s ? s[0].toLowerCase() : '';
  };
  const normInt = s => {
    s = toHalf(s||'').replace(/[^0-9+\-]/g,'');
    return s;
  };

  /* ========= 初期化 ========= */

  function derived(){
    const f = FORMATS[state.players].find(x=>x.id===state.mode);
    return Array.from({length:f.teamCount},(_,i)=>({
      id:i,
      name:'',
      key:'',
      color:'',
      adj:''
    }));
  }

  function initTeams(){
    state.teams = derived();
  }

  /* ========= 保存 ========= */

  function save(){
    localStorage.setItem(LS_KEY,JSON.stringify({
      v:VERSION,
      ...state
    }));
  }

  function load(){
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return false;
    const o = JSON.parse(raw);
    if(o.v!==VERSION) return false;
    Object.assign(state,o);
    return true;
  }

  /* ========= 色 ========= */

  function teamColor(i){
    return AUTO_COLORS[i % AUTO_COLORS.length];
  }

  /* ========= 集計 ========= */

  function calc(){
    const pts = state.players===12?POINTS_12:POINTS_24;
    const teamTotals = Array(state.teams.length).fill(0);

    for(let r=0;r<state.races;r++){
      for(let p=0;p<state.players;p++){
        const k = state.cells?.[r]?.[p];
        if(!k) continue;
        const idx = state.teams.findIndex(t=>t.key===k);
        if(idx>=0) teamTotals[idx]+=pts[p];
      }
    }

    const res = state.teams.map((t,i)=>({
      idx:i,
      name:t.name||`チーム${i+1}`,
      total:teamTotals[i]
    }));

    res.sort((a,b)=>b.total-a.total);
    return res;
  }

  /* ========= 出力 ========= */

  function buildMain(){
    const st = calc();
    if(!st.length) return '';
    if(state.showSum){
      return st.map(s=>`${s.name} ${s.total}`).join('／');
    }
    const base = st[0].total;
    return st.map(s=>{
      const d = s.total-base;
      return `${s.name} ${d>=0?'+':''}${d}`;
    }).join('／');
  }

  /* ========= UI ========= */

  function rebuild(){
    $('#outMain').textContent = buildMain();
    save();
  }

  /* ========= イベント ========= */

  function bind(){
    $('#btnCopyMain').onclick = ()=>{
      navigator.clipboard.writeText($('#outMain').textContent);
    };
    $('#chkShowSum').onchange = e=>{
      state.showSum = e.target.checked;
      rebuild();
    };
  }

  /* ========= start ========= */

  function start(){
    if(!load()) initTeams();
    bind();
    rebuild();
  }

  start();
})();
