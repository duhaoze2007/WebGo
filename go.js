/* ============================================================
 * go.js — 网页围棋 UI:木质棋盘渲染、交互、计分、i18n(中/EN)
 * ============================================================ */
'use strict';

/* ================= i18n ================= */
const I18N = {
  zh: {
    brandTitle:'围棋 · 人机对弈', match:'对局', turn:'回合', caps:'吃子', komiLbl:'贴目', movesLbl:'手数',
    setup:'对局设置', ops:'操作',
    fldRule:'计分规则', fldSize:'棋盘路数', fldColor:'执子', fldDiff:'AI 难度',
    rule_chinese:'中国规则 · 数子(贴 3¾ 子=7.5目)', rule_japanese:'日韩规则 · 点目(贴 6.5 目)', rule_free:'自由对弈 · 数子(不贴目)',
    size9:'9 路 · 小棋盘', size13:'13 路', size19:'19 路 · 标准',
    colorBlack:'执黑 · 先行', colorWhite:'执白 · 让 AI 先',
    diffEasy:'入门', diffNormal:'进阶', diffHard:'高手',
    newGame:'新开一局', undo:'悔棋', pass:'让一手', finish:'结束计分', resign:'认输',
    confirmScore:'确认计分', backGame:'返回对局',
    youBlack:'你执黑', youWhite:'你执白',
    youTurn:'轮到你', aiTurn:'AI 思考中…', aiPassed:'AI 让一手', youPassed:'你让了一手',
    cleanupNote:'点选已死的棋子(再点取消),确认后计分', overNote:'对局已结束',
    mResult:'对局结束', mResign:'认输', mNew:'再来一局', mView:'查看棋盘',
    resignQ:'确定认输本局吗?', resignYes:'确认认输', cancel:'继续对局',
    winnerBlack:'黑方胜', winnerWhite:'白方胜', draw:'和棋',
    youSide:'你', aiSide:'AI',
    rowBlack:'黑方', rowWhite:'白方',
    lblDead:'已死子(取下)', lblCaps:'提子', lblMixed:'双活/单官点(均分)', lblStones:'活子', lblArea:'空点',
    lblKomi:'贴目', lblDiff:'目差(不含贴目)',
    unitSub:'子', unitMoku:'目',
    btnOK:'确认', 
    blackCaps:'黑吃', whiteCaps:'白吃',
    confirmNew:'当前对局尚未结束,确定开新局吗?',
    foot:'规则:中国规则=数子法(黑贴3¾子,子空皆地);日韩规则=点目法(黑贴6.5目);自由对弈=数子不贴目。双活与未收单官按简化方式处理(中国规则均分、日韩规则不计)。AI 为浏览器端娱乐级引擎,擅吃子与局部战斗。对局中可随时切换计分规则,终局按所选规则结算。',
    statusPlaying:'第 {n} 手 · {s}', statusCleanup:'标记死子中 · 已标 {n} 块点',
    goTitle:'GO'
  },
  en: {
    brandTitle:'GO · Play vs Computer', match:'Match', turn:'Turn', caps:'Captures', komiLbl:'Komi', movesLbl:'Moves',
    setup:'Setup', ops:'Actions',
    fldRule:'Scoring rule', fldSize:'Board size', fldColor:'Play as', fldDiff:'AI level',
    rule_chinese:'Chinese · area (komi 7.5)', rule_japanese:'Japanese/Korean · territory (komi 6.5)', rule_free:'Free play · no komi',
    size9:'9×9', size13:'13×13', size19:'19×19',
    colorBlack:'Black · move first', colorWhite:'White · AI first',
    diffEasy:'Easy', diffNormal:'Normal', diffHard:'Hard',
    newGame:'New game', undo:'Undo', pass:'Pass', finish:'Count & finish', resign:'Resign',
    confirmScore:'Count score', backGame:'Back to game',
    youBlack:'You: Black', youWhite:'You: White',
    youTurn:'Your turn', aiTurn:'AI thinking…', aiPassed:'AI passed', youPassed:'You passed',
    cleanupNote:'Click dead stones to mark them (click again to unmark)', overNote:'Game over',
    mResult:'Game over', mResign:'Resign', mNew:'Play again', mView:'View board',
    resignQ:'Resign this game?', resignYes:'Resign', cancel:'Keep playing',
    winnerBlack:'Black wins', winnerWhite:'White wins', draw:'Draw',
    youSide:'You', aiSide:'AI',
    rowBlack:'Black', rowWhite:'White',
    lblDead:'Dead stones', lblCaps:'Prisoners', lblMixed:'Shared points (split)', lblStones:'Live stones', lblArea:'Territory',
    lblKomi:'Komi', lblDiff:'Diff (before komi)',
    unitSub:' pts', unitMoku:' pts',
    btnOK:'OK',
    blackCaps:'Black took', whiteCaps:'White took',
    confirmNew:'Current game is not finished. Start a new one?',
    foot:'Chinese rule: area scoring (Black komi 7.5, stones+territory count). Japanese/Korean: territory (komi 6.5). Free: area, no komi. Seki/unfinished dame are simplified (split in Chinese rule, ignored in Japanese). AI is a browser-side recreational engine — good at captures and fights. You may switch the scoring rule mid-game; the end uses the selected rule.',
    statusPlaying:'Move {n} · {s}', statusCleanup:'Marking dead · {n} marked',
    goTitle:'GO'
  }
};
const LANG_KEY = 'go_lang';
let L = (navigator.language||'').toLowerCase().startsWith('zh') ? 'zh' : 'en';
try { const s = localStorage.getItem(LANG_KEY); if (s==='zh'||s==='en') L = s; } catch(e){}
const t = k => (I18N[L] && I18N[L][k] !== undefined) ? I18N[L][k] : (I18N.zh[k]!==undefined?I18N.zh[k]:k);

/* ================= DOM ================= */
const $ = id => document.getElementById(id);
const cvBase = $('cvBase'), cvStones = $('cvStones'), cvFx = $('cvFx');
const ctxBase = cvBase.getContext('2d'), ctxSt = cvStones.getContext('2d'), ctxFx = cvFx.getContext('2d');
let DPR = 1, cssSize = 0, N = 19, cell = 0, pad = 0;
const stoneSprites = {};

/* ================= 状态 ================= */
const game = new GoEngine(19);
const opts = { rule:'chinese', size:19, player:BLACK, diff:'normal' };
let mode = 'play';            // play | cleanup | over
let busy = false;             // AI 思考锁
let deadSet = new Set();      // cleanup 死子标记 (index set)
let timerAI = null;
let hover = null;             // {x,y}
let anims = [];               // {type:'drop'|'cap', ...}
let fxTimer = null;

const oppColor = () => 3 - opts.player;

/* ================= 声音 ================= */
let AC = null;
function blip(kind){
  try{
    AC = AC || new (window.AudioContext||window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    const t0 = AC.currentTime;
    const o = AC.createOscillator(), g = AC.createGain();
    o.connect(g); g.connect(AC.destination);
    if (kind==='drop'){
      o.type='triangle'; o.frequency.setValueAtTime(820,t0);
      o.frequency.exponentialRampToValueAtTime(150,t0+0.05);
      g.gain.setValueAtTime(0.16,t0); g.gain.exponentialRampToValueAtTime(0.0001,t0+0.08);
    } else {
      o.type='sine'; o.frequency.setValueAtTime(220,t0);
      o.frequency.exponentialRampToValueAtTime(55,t0+0.16);
      g.gain.setValueAtTime(0.22,t0); g.gain.exponentialRampToValueAtTime(0.0001,t0+0.2);
    }
    o.start(t0); o.stop(t0+0.22);
  }catch(e){}
}

/* ================= 渲染工具 ================= */
function makeStoneSprite(color){
  const c = document.createElement('canvas');
  c.width = c.height = 200;
  const g = c.getContext('2d'), cx=100, cy=100, R=96;
  const rg = g.createRadialGradient(cx-34,cy-32,8, cx,cy,R);
  if (color===BLACK){
    rg.addColorStop(0,'#a6a6a6'); rg.addColorStop(0.2,'#565656');
    rg.addColorStop(0.55,'#232323'); rg.addColorStop(1,'#030303');
    g.fillStyle = rg; g.beginPath(); g.arc(cx,cy,R,0,6.29); g.fill();
    const hl = g.createRadialGradient(cx-32,cy-34,2, cx-32,cy-34,26);
    hl.addColorStop(0,'rgba(255,255,255,0.42)'); hl.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=hl; g.beginPath(); g.arc(cx-32,cy-34,26,0,6.29); g.fill();
  } else {
    rg.addColorStop(0,'#ffffff'); rg.addColorStop(0.4,'#f8f3e4');
    rg.addColorStop(0.85,'#e0d5bd'); rg.addColorStop(1,'#c9bda2');
    g.fillStyle = rg; g.beginPath(); g.arc(cx,cy,R,0,6.29); g.fill();
    g.strokeStyle='rgba(130,105,70,0.55)'; g.lineWidth=2.4;
    g.beginPath(); g.arc(cx,cy,R-2,0,6.29); g.stroke();
    const hl = g.createRadialGradient(cx-30,cy-32,2, cx-30,cy-32,30);
    hl.addColorStop(0,'rgba(255,255,255,0.95)'); hl.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=hl; g.beginPath(); g.arc(cx-30,cy-32,30,0,6.29); g.fill();
  }
  return c;
}
function stoneAt(ctx, px, py, r, color, alpha){
  if (!stoneSprites[color]) stoneSprites[color] = makeStoneSprite(color);
  if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
  ctx.drawImage(stoneSprites[color], px-r, py-r, r*2, r*2);
  ctx.globalAlpha = 1;
}
function ptXY(x,y){ return { px: pad + cell*x, py: pad + cell*y }; }

/* 木纹背景(一次绘制到 base 层缓存) */
function drawWood(ctx, W){
  const g = ctx.createLinearGradient(0,0,W*0.15,W);
  g.addColorStop(0,'#eecf95'); g.addColorStop(0.5,'#e2b877'); g.addColorStop(1,'#d8a862');
  ctx.fillStyle = g; ctx.fillRect(0,0,W,W);
  // 竖长木纹
  for (let k=0;k<240;k++){
    const x = Math.random()*W, w = 0.5 + Math.random()*2.4;
    const a = 0.015 + Math.random()*0.06;
    const light = Math.random() < 0.4;
    ctx.fillStyle = light ? `rgba(255,238,190,${a})` : `rgba(122,78,36,${a})`;
    const bend = (Math.random()-0.5)*W*0.08;
    ctx.beginPath();
    ctx.moveTo(x, -2);
    ctx.quadraticCurveTo(x+bend, W*0.5, x+w*0.15, W+2);
    ctx.lineTo(x+w*0.15+w*0.8, W+2);
    ctx.quadraticCurveTo(x+bend+w, W*0.5, x+w, -2);
    ctx.closePath(); ctx.fill();
  }
  // 年轮横带
  for (let k=0;k<7;k++){
    const y = Math.random()*W;
    ctx.fillStyle = `rgba(139,94,44,${0.02+Math.random()*0.03})`;
    ctx.beginPath();
    ctx.moveTo(-2, y);
    ctx.quadraticCurveTo(W*0.5, y+(Math.random()-0.5)*26, W+2, y+(Math.random()-0.5)*10);
    ctx.lineTo(W+2, y+1.4); ctx.lineTo(-2, y+1.4);
    ctx.closePath(); ctx.fill();
  }
  // 噪点
  for (let k=0;k<420;k++){
    ctx.fillStyle = Math.random()<0.5 ? 'rgba(255,240,200,0.05)' : 'rgba(90,55,20,0.045)';
    ctx.fillRect(Math.random()*W, Math.random()*W, 1.2, 1.2);
  }
  // 四周暗角
  const v = ctx.createRadialGradient(W/2,W/2,W*0.25, W/2,W/2,W*0.75);
  v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(70,40,10,0.22)');
  ctx.fillStyle=v; ctx.fillRect(0,0,W,W);
}

function starPoints(n){
  if (n===19) return [[3,3],[3,9],[3,15],[9,3],[9,9],[9,15],[15,3],[15,9],[15,15]];
  if (n===13) return [[3,3],[3,9],[9,3],[9,9],[6,6]];
  return [[2,2],[2,6],[6,2],[6,6],[4,4]];
}

/* 静态层:木纹+网格+星位 */
function renderBase(){
  const W = cssSize, ctx = ctxBase;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,W,W);
  ctx.save();
  drawWood(ctx, W);
  ctx.restore();
  // 网格
  cell = (W - 2*pad) / (N-1);
  const lw = Math.max(1, cell*0.03);
  ctx.strokeStyle = '#55391e';
  ctx.lineWidth = lw;
  ctx.beginPath();
  for (let i=0;i<N;i++){
    const p = pad + cell*i;
    ctx.moveTo(pad, p); ctx.lineTo(W-pad, p);
    ctx.moveTo(p, pad); ctx.lineTo(p, W-pad);
  }
  ctx.stroke();
  // 外框粗线
  ctx.lineWidth = lw*2.6;
  ctx.strokeStyle = '#4a3118';
  ctx.strokeRect(pad-lw*0.6, pad-lw*0.6, (N-1)*cell+lw*1.2, (N-1)*cell+lw*1.2);
  // 星位
  ctx.fillStyle = '#3f2a13';
  const sr = Math.max(2, cell*0.155);
  for (const [sx,sy] of starPoints(N)){
    ctx.beginPath(); ctx.arc(pad+cell*sx, pad+cell*sy, sr, 0, 6.29); ctx.fill();
  }
}

function renderStones(){
  const ctx = ctxSt, W = cssSize;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,W,W);
  const r = cell*0.465;
  const b = game.board;
  for (let i=0;i<b.length;i++){
    if (!b[i]) continue;
    const x = i % N, y = (i/N)|0;
    const {px,py} = ptXY(x,y);
    stoneAt(ctx, px, py, r, b[i]);
  }
  if (game.lastMove){
    const {px,py} = ptXY(game.lastMove.x, game.lastMove.y);
    ctx.fillStyle = 'rgba(196,58,40,0.92)';
    ctx.beginPath(); ctx.arc(px, py, Math.max(2.2, cell*0.115), 0, 6.29); ctx.fill();
  }
}

/* ================= fx 动画层 ================= */
function requestFx(){
  if (!fxTimer) fxTimer = requestAnimationFrame(fxFrame);
}
function fxFrame(ts){
  fxTimer = null;
  const ctx = ctxFx, W = cssSize;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,W,W);
  const r = cell*0.465;
  const now = performance.now();

  // 落子弹入 + 提子淡出
  anims = anims.filter(a => now - a.t0 < a.dur);
  for (const a of anims){
    const p = Math.min(1, (now-a.t0)/a.dur);
    if (a.type==='drop'){
      const s = 1 + 0.16*Math.sin(Math.PI*p);   // 轻微过冲回弹
      const {px,py} = ptXY(a.x,a.y);
      stoneAt(ctx, px, py, r*s, a.color, 1);
    } else {
      for (const pt of a.pts){
        const {px,py} = ptXY(pt%N,(pt/N)|0);
        stoneAt(ctx, px, py, r*(1+0.3*p), a.color, Math.max(0,1-p));
      }
    }
  }
  let live = anims.length>0 || hover || mode==='cleanup';

  // 幽灵子 / 高亮
  if (hover && mode==='play'){
    const {px,py} = ptXY(hover.x,hover.y);
    if (hover.valid && !busy && game.turn===opts.player){
      stoneAt(ctx, px, py, r, game.turn, 0.4);
      live = true;
    }
  }
  if (hover && (mode==='cleanup'||mode==='over')){
    const i = hover.y*N+hover.x;
    if (game.board[i] || deadSet.has(i)){
      const {px,py} = ptXY(hover.x,hover.y);
      ctx.strokeStyle = '#e8b23a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px,py, r*1.12, 0, 6.29); ctx.stroke();
      live = true;
    }
  }

  // cleanup 死子标记
  if (mode==='cleanup' && deadSet.size){
    ctx.lineWidth = Math.max(1.4, cell*0.07);
    ctx.strokeStyle = 'rgba(168,30,20,0.9)';
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    for (const i of deadSet){
      const {px,py} = ptXY(i%N,(i/N)|0);
      ctx.beginPath(); ctx.arc(px,py,r*0.92,0,6.29); ctx.fill();
      const s = r*0.52;
      ctx.beginPath();
      ctx.moveTo(px-s,py-s); ctx.lineTo(px+s,py+s);
      ctx.moveTo(px+s,py-s); ctx.lineTo(px-s,py+s);
      ctx.stroke();
    }
  }
  if (live) requestFx();
}

/* ================= 几何/输入 ================= */
function resizeAll(){
  const el = cvBase.parentElement;
  const w = el.clientWidth;
  cssSize = w;
  DPR = Math.min(3, window.devicePixelRatio || 1);
  for (const cv of [cvBase,cvStones,cvFx]){
    cv.width = Math.round(w*DPR); cv.height = Math.round(w*DPR);
    cv.style.width = w+'px'; cv.style.height = w+'px';
  }
  pad = w*0.030;
  cell = (w-2*pad)/(N-1);
  renderBase();
  renderStones();
  requestFx();
}
function evToGrid(e){
  const rect = cvFx.getBoundingClientRect();
  const scale = (cvFx.width/rect.width)/DPR;    // css px per client px 修正
  let cx, cy;
  if (e.touches && e.touches.length){ cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
  else { cx = e.clientX; cy = e.clientY; }
  const px = (cx-rect.left)/rect.width*cssSize;
  const py = (cy-rect.top)/rect.height*cssSize;
  const gx = Math.round((px-pad)/cell), gy = Math.round((py-pad)/cell);
  if (gx<0||gy<0||gx>=N||gy>=N) return null;
  const dx = Math.abs(px-(pad+cell*gx)), dy = Math.abs(py-(pad+cell*gy));
  if (dx > cell*0.46 || dy > cell*0.46) return null;
  return {x:gx,y:gy};
}

/* ================= 对局流程 ================= */
function setBusy(v){
  busy = v;
  $('btnUndo').disabled = v || mode!=='play';
  $('btnPass').disabled = v || mode!=='play' || game.turn!==opts.player;
  cvFx.classList.toggle('nointer', mode!=='play' || busy);
  updateNote();
}
function afterMove(res, moverColor){
  renderStones();
  updateInfo();
  if (res.deadLen>0 && res.dead.length){
    anims.push({type:'cap', pts:res.dead, color:3-moverColor, t0:performance.now(), dur:450});
  }
  if (game.turn===oppColor()){
    scheduleAI();
  } else {
    setBusy(false);
  }
  requestFx();
}
function doPlayerPass(){
  if (busy || mode!=='play' || game.turn!==opts.player) return;
  game.pass(opts.player);
  anims.push({type:'cap',pts:[],color:0,t0:0,dur:0}); // noop
  updateInfo();
  if (game.passStreak>=2){ enterCleanup(); return; }
  scheduleAI();
}
function scheduleAI(){
  setBusy(true);
  const delay = opts.diff==='easy' ? 280+Math.random()*260 : opts.diff==='hard' ? 600+Math.random()*500 : 380+Math.random()*360;
  timerAI = setTimeout(()=>{
    timerAI = null;
    if (mode!=='play') return;
    const mv = aiChoose(game, oppColor(), opts.diff);
    if (!mv){
      game.pass(oppColor());
      anims.push({type:'cap',pts:[],color:0,t0:0,dur:0});
      updateInfo();
      if (game.passStreak>=2){ enterCleanup(); }
      else setBusy(false);
      return;
    }
    const r = game.execute(mv.x, mv.y, oppColor());
    if (!r){ // 兜底(几乎不会发生)
      setBusy(false); updateInfo(); return;
    }
    pushAnim({type:'drop',x:mv.x,y:mv.y,color:oppColor(),t0:performance.now(),dur:300});
    afterMove(r, oppColor());
  }, delay);
}
function pushAnim(a){ anims.push(a); requestFx(); }
function tryPlayerMove(x,y){
  if (busy || mode!=='play' || game.turn!==opts.player) return;
  const r = game.execute(x,y,opts.player);
  if (!r) return;
  pushAnim({type:'drop',x,y,color:opts.player,t0:performance.now(),dur:300});
  blip('drop');
  if (r.deadLen){ blip('cap'); }
  afterMove(r, opts.player);
}

function undoOnce(){
  if (busy || mode!=='play') return;
  if (!game.hist.some(h=>!h.pass)) return;
  game.undoTo(opts.player);
  deadSet = new Set();
  renderStones();
  if (timerAI){ clearTimeout(timerAI); timerAI=null; }
  setBusy(false);
  updateInfo();
  requestFx();
}
function startCleanupMode(){
  mode = 'cleanup';
  deadSet = new Set();
  $('actionsPlay').style.display='none';
  $('actionsClean').style.display='flex';
  setBusy(false);
  updateInfo();
  updateNote();
  requestFx();
}
function enterCleanup(){
  if (mode!=='play') return;
  startCleanupMode();
}
function backToPlay(){
  while (game.hist.length && game.hist[game.hist.length-1].pass) game.undoOnce();
  mode='play';
  deadSet = new Set();
  $('actionsPlay').style.display='flex';
  $('actionsClean').style.display='none';
  updateInfo(); updateNote(); renderStones(); requestFx();
}
function newGame(){
  game.init(opts.size);
  N = opts.size;
  mode='play'; busy=false; deadSet=new Set();
  if (timerAI){ clearTimeout(timerAI); timerAI=null; }
  $('actionsPlay').style.display='flex';
  $('actionsClean').style.display='none';
  resizeAll();                       // N 变→重画网格
  updateInfo(); updateNote();
  if (opts.player===WHITE) scheduleAI();
}
function toggleDead(x,y){
  const i = y*N+x;
  const c = game.board[i];
  if (!c) return;
  const g = game.gatherFrom(game.board, i, N);
  const key = g.pts[0];
  const on = deadSet.has(key);
  for (const p of g.pts){ if (on) deadSet.delete(p); else deadSet.add(p); }
  updateNote(); requestFx();
}

/* ================= 计分 ================= */
function fmtNum(n){ return Number.isInteger(n) ? String(n) : String(Math.round(n*10)/10); }
function fmtMargin(n){
  const r = Math.round(n*10)/10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
function openModal(cfg){
  $('mTitle').textContent = cfg.title;
  $('mSub').textContent = cfg.sub || '';
  $('mBody').innerHTML = cfg.html || '';
  $('mOk').textContent = cfg.okLabel;
  const g = $('mGhost');
  if (cfg.ghostLabel){ g.style.display=''; g.textContent = cfg.ghostLabel; g.onclick = ()=>{ $('modalWrap').classList.remove('show'); cfg.onGhost && cfg.onGhost(); }; }
  else g.style.display='none';
  $('mOk').onclick = ()=>{ $('modalWrap').classList.remove('show'); cfg.onOk && cfg.onOk(); };
  $('modalWrap').classList.add('show');
}
function showScore(eng, dead){
  const rule = $('selRule').value;
  const s = computeScore(eng, rule, dead);
  const unit = (rule==='japanese') ? t('unitMoku') : t('unitSub');
  const rows = [];
  const deadW = dead? (function(){let n=0;for(const p of dead) if(eng.board[p]===WHITE) n++;return n;})():0;
  const deadB = dead? (function(){let n=0;for(const p of dead) if(eng.board[p]===BLACK) n++;return n;})():0;
  const blackN = (dead? deadB:0) + eng.caps[BLACK];
  const whiteN = (dead? deadW:0) + eng.caps[WHITE];
  if (rule==='japanese'){
    rows.push([t('rowBlack')+' · 空 '+fmtNum(s.blackArea)+' + 俘 '+fmtNum(blackN), '= '+fmtNum(s.black)]);
    rows.push([t('rowWhite')+' · 空 '+fmtNum(s.whiteArea)+' + 俘 '+fmtNum(whiteN), '= '+fmtNum(s.white)]);
    rows.push([t('lblMixed')+'('+fmtNum(s.mixedPts)+')', rule==='japanese'? '—' : '÷2']);
  } else {
    rows.push([t('rowBlack')+' · '+t('lblStones')+' '+fmtNum(s.bs)+' + '+t('lblArea')+' '+fmtNum(s.blackArea)+
               (s.mixedPts? ' + '+t('lblMixed')+' '+fmtNum(s.mixedPts/2):''), '= '+fmtNum(s.black)]);
    rows.push([t('rowWhite')+' · '+t('lblStones')+' '+fmtNum(s.ws)+' + '+t('lblArea')+' '+fmtNum(s.whiteArea)+
               (s.mixedPts? ' + '+t('lblMixed')+' '+fmtNum(s.mixedPts/2):''), '= '+fmtNum(s.white)]);
    rows.push([t('lblDead'), 'B:'+deadB+' W:'+deadW]);
    rows.push([t('lblCaps'), 'B:'+eng.caps[BLACK]+' W:'+eng.caps[WHITE]]);
  }
  rows.push([t('lblKomi'), fmtNum(s.komi) + (rule==='chinese' ? ' (3¾)' : '')]);
  let winnerTxt, diffTxt;
  if (s.winner==='draw'){ winnerTxt = t('draw'); diffTxt = fmtNum(s.diff)+' = komi'; }
  else {
    const wname = s.winner==='black' ? t('winnerBlack') : t('winnerWhite');
    winnerTxt = wname;
    diffTxt = (L==='zh' ? (s.winner==='black'?'黑胜 ':'白胜 ') : (s.winner==='black'?'Black by ':'White by ')) + fmtMargin(s.margin) + ' ' + unit;
  }
  const tr = rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
  const html = `
    <div class="winner-line">${winnerTxt}</div>
    <div class="diff-line">${diffTxt}</div>
    <table class="score-tbl">${tr}</table>`;
  openModal({
    title: t('mResult'),
    sub: t('rule_'+rule),
    html,
    okLabel: t('mNew'),
    ghostLabel: t('mView'),
    onOk: ()=> newGame(),
    onGhost: ()=>{}
  });
  mode='over';
  updateNote();
  $('actionsPlay').style.display='flex';
  $('actionsClean').style.display='none';
}
function doConfirmScore(){
  const dead = new Set();
  for (const i of deadSet) dead.add(i);
  showScore(game, dead);
}
function askResign(){
  openModal({
    title: t('mResign'),
    html: `<p class="hint">${t('resignQ')}</p>`,
    okLabel: t('resignYes'),
    ghostLabel: t('cancel'),
    onOk: ()=>{
      const w = (game.turn===opts.player) ? t('winnerBlack')+'/'+t('winnerWhite') : '';
      const winnerSide = 3 - game.turn; // 认输方是当前回合方?当前回合方=将行棋者=认输者(玩家)
      const winName = opts.player===BLACK ? t('winnerWhite') : t('winnerBlack');
      mode='over';
      openModal({
        title: t('mResign'),
        html: `<div class="winner-line">${winName}</div>
               <p class="hint">${L==='zh'?'你认输,对局结束':'You resigned. Game over.'}</p>`,
        okLabel: t('mNew'),
        ghostLabel: t('mView'),
        onOk: ()=> newGame()
      });
      $('actionsPlay').style.display='flex';
      $('actionsClean').style.display='none';
      updateNote();
    },
    onGhost: ()=>{}
  });
}

/* ================= 界面文本 ================= */
function applyStaticText(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.title = t('brandTitle');
  $('langBtn').textContent = L==='zh' ? 'English' : '中文';
}
function fillOptions(){
  const set = (sel, items, val)=>{
    sel.innerHTML = items.map(([v,l])=>`<option value="${v}"${v===val?' selected':''}>${l}</option>`).join('');
  };
  const rules = [['chinese',t('rule_chinese')],['japanese',t('rule_japanese')],['free',t('rule_free')]];
  set($('selRule'), rules, opts.rule);
  set($('selSize'), [['9',t('size9')],['13',t('size13')],['19',t('size19')]], String(opts.size));
  set($('selColor'), [['1',t('colorBlack')],['2',t('colorWhite')]], String(opts.player));
  set($('selDiff'), [['easy',t('diffEasy')],['normal',t('diffNormal')],['hard',t('diffHard')]], opts.diff);
}
function stoneSpan(c){ return `<span class="stone-mini ${c===BLACK?'b':'w'}"></span>`; }
function updateInfo(){
  const rule = $('selRule').value;
  const komi = RULES[rule].komi;
  const whoBlack = opts.player===BLACK ? t('youSide') : t('aiSide');
  const whoWhite = opts.player===WHITE ? t('youSide') : t('aiSide');
  $('matchTag').innerHTML = `<span class="pill turn-you">${stoneSpan(BLACK)}黑·${whoBlack}</span> `+
    `<span class="pill turn-ai">${stoneSpan(WHITE)}白·${whoWhite}</span>`;
  const tt = game.turn;
  const tn = tt===opts.player ? t('youSide') : t('aiSide');
  $('turnVal').innerHTML = stoneSpan(tt) + (tt===BLACK?'黑':'白') + ' · ' + tn;
  $('capsVal').innerHTML = `${t('blackCaps')} ${game.caps[BLACK]} &nbsp;·&nbsp; ${t('whiteCaps')} ${game.caps[WHITE]}`;
  $('komiVal').textContent = fmtNum(komi) + ' ' + (rule==='free'?'—':t('unitMoku')) + (rule==='chinese'?' (3¾子=7.5目)':'');
  $('moveVal').textContent = game.nonPassMoves();
  $('ruleBadge').textContent = rule==='chinese' ? t('rule_chinese') : rule==='japanese' ? t('rule_japanese') : t('rule_free');
  updateNote();
}
function updateNote(){
  const el = $('boardNote');
  if (mode==='cleanup'){ el.innerHTML = `<b>${t('cleanupNote')}</b>`; return; }
  if (mode==='over'){ el.innerHTML = `<b>${t('overNote')}</b>`; return; }
  const n = game.nonPassMoves();
  const who = game.turn===opts.player ? t('youTurn') : t('aiTurn');
  el.innerHTML = t('statusPlaying').replace('{n}', String(n)).replace('{s}', who);
}
function refreshAll(){
  applyStaticText();
  fillOptions();
  $('selRule').value = opts.rule;
  $('selSize').value = String(opts.size);
  $('selColor').value = String(opts.player);
  $('selDiff').value = opts.diff;
  $('footNote').textContent = t('foot');
  updateInfo();
  updateNote();
}

/* ================= 事件 ================= */
function bindEvents(){
  cvFx.addEventListener('mousemove', e=>{
    const g = evToGrid(e);
    if (!g){ if (hover){ hover=null; requestFx(); } return; }
    const changed = !hover || hover.x!==g.x || hover.y!==g.y;
    if (!changed) return;
    hover = g;
    if (mode==='play'){
      hover.valid = (game.turn===opts.player && !busy) ? game.tryLegal(g.x,g.y,game.turn) : false;
    }
    requestFx();
  });
  cvFx.addEventListener('mouseleave', ()=>{ hover=null; requestFx(); });
  cvFx.addEventListener('click', e=>{
    const g = evToGrid(e);
    if (!g) return;
    if (mode==='play') tryPlayerMove(g.x,g.y);
    else if (mode==='cleanup') toggleDead(g.x,g.y);
  });
  cvFx.addEventListener('touchstart', e=>{ e.preventDefault(); }, {passive:false});
  cvFx.addEventListener('touchend', e=>{
    e.preventDefault();
    const g = evToGrid(e);
    if (!g) return;
    if (mode==='play') tryPlayerMove(g.x,g.y);
    else if (mode==='cleanup') toggleDead(g.x,g.y);
  }, {passive:false});

  $('btnNew').addEventListener('click', ()=>{
    const inGame = game.placed>0 && mode==='play';
    if (inGame){
      openModal({
        title: t('newGame'),
        html: `<p class="hint">${t('confirmNew')}</p>`,
        okLabel: t('btnOK'), ghostLabel: t('cancel'),
        onOk: ()=> newGame()
      });
    } else newGame();
  });
  $('btnUndo').addEventListener('click', undoOnce);
  $('btnPass').addEventListener('click', doPlayerPass);
  $('btnFinish').addEventListener('click', ()=>{
    if (mode==='play' && game.nonPassMoves()>0) startCleanupMode();
  });
  $('btnResign').addEventListener('click', ()=>{ if (mode==='play') askResign(); });
  $('btnScore').addEventListener('click', doConfirmScore);
  $('btnBackGame').addEventListener('click', backToPlay);

  for (const [id,key] of [['selRule','rule'],['selSize','size'],['selColor','color'],['selDiff','diff']]){
    $(id).addEventListener('change', e=>{
      const v = e.target.value;
      if (key==='rule'){ opts.rule = v; updateInfo(); }
      else if (key==='size') opts.size = parseInt(v,10);
      else if (key==='color') opts.player = parseInt(v,10);
      else if (key==='diff') opts.diff = v;
    });
  }
  $('langBtn').addEventListener('click', ()=>{
    L = L==='zh' ? 'en' : 'zh';
    try{ localStorage.setItem(LANG_KEY, L); }catch(e){}
    document.documentElement.lang = L;
    refreshAll();
  });
}
function initResize(){
  if (window.ResizeObserver){
    new ResizeObserver(()=>{ if (cssSize!==cvBase.parentElement.clientWidth) resizeAll(); })
      .observe(cvBase.parentElement);
  } else window.addEventListener('resize', resizeAll);
}

/* ================= 启动 ================= */
function init(){
  document.documentElement.lang = L;
  $('actionsClean').style.display = 'none';
  fillOptions();
  applyStaticText();
  $('footNote').textContent = t('foot');
  bindEvents();
  initResize();
  resizeAll();
  updateInfo();
  if (opts.player===WHITE) scheduleAI();
}

/* ================= 调试/测试 API ================= */
window.__go = {
  state(){ return { N:game.N, mode, turn:game.turn, placed:game.placed, passStreak:game.passStreak,
                    caps:game.caps.slice(), rule:opts.rule, diff:opts.diff, player:opts.player }; },
  legal(x,y,c){ return game.tryLegal(x,y,c); },
  selfplay(n, diff, size){
    const e = new GoEngine(size||19);
    const d = diff || 'normal';
    let passes=0, plies=0, maxPasses = 2;
    for (let k=0;k<(n||200);k++){
      const c = e.turn;
      const mv = aiChoose(e, c, d);
      if (!mv){ e.pass(c); passes++; if (passes>=maxPasses) break; continue; }
      const r = e.execute(mv.x, mv.y, c);
      if (!r) return {error:'illegal AI move at ply '+plies};
      passes=0; plies++;
    }
    let bs=0, ws=0;
    for (const v of e.board){ if(v===BLACK)bs++; else if(v===WHITE)ws++; }
    return { ok:true, plies, endedByDoublePass: passes>=2, caps:e.caps.slice(), stones:[bs,ws] };
  },
  scoreNow(){ return computeScore(game, $('selRule').value, new Set()); },
  engine: game,
  forceStone(x,y,c){
    const b = game.board;
    if (b[y*game.N+x]) return false;
    b[y*game.N+x] = c;
    game.hash = game.computeHash(b);
    renderStones(); requestFx();
    return true;
  },
  grabCoords(){ return {cell,pad,cssSize}; }
};

/* 引擎规则自测(纯逻辑,无 UI) */
function selfTest(){
  const e = new GoEngine(19);
  // 1. 提子:白单子 @ (9,9),三面黑,黑落 (9,10) 提
  e.board[9*19+9] = WHITE;         // (9,9) 白 — 注意 idx=y*N+x
  e.board[9*19+8] = BLACK;         // (8,9)
  e.board[9*19+10] = BLACK;        // (10,9)
  e.board[8*19+9] = BLACK;         // (9,8)
  e.hash = e.computeHash(e.board);
  const r1 = e.execute(9, 10, BLACK);   // 白正下方 (9,10)
  if (!r1 || r1.deadLen!==1 || e.caps[BLACK]!==1 || e.board[9*19+9]!==0) return 'capture test FAILED: '+JSON.stringify({r1,caps:e.caps});
  // 2. 劫:重复局面禁(黑(2,0)与(1,1),白(1,0):黑(0,0)提白 → 白(1,0)提回被禁)
  const k = new GoEngine(19);
  k.board[0*19+2] = BLACK;   // (2,0)
  k.board[1*19+1] = BLACK;   // (1,1)
  k.board[0*19+1] = WHITE;   // (1,0)
  k.hash = k.computeHash(k.board);
  k.hashStack.push(k.hash);   // 摆好劫型后把初始局面压栈(供 superko 判定)
  const rk = k.execute(0, 0, BLACK);    // 黑下 (0,0) 提白(1,0)
  if (!rk || rk.deadLen!==1) return 'ko setup FAILED: '+JSON.stringify(rk);
  const ko = k.tryLegal(1, 0, WHITE);   // 白立即提回 (1,0) → 局面重复,应禁
  if (ko) return 'ko test FAILED: immediate recapture allowed';
  return 'ok';
}
window.__selftest = selfTest;

document.addEventListener('DOMContentLoaded', init);
