/* ============================================================
 * go-engine.js — 围棋规则引擎(中国规则/日韩规则/自由,数子+点目)
 * 纯逻辑,不依赖 DOM。被 go-ui.js 与测试调用。
 * ============================================================ */
'use strict';

const EMPTY = 0, BLACK = 1, WHITE = 2;
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
const RULES = {
  chinese:  { komi: 7.5, label: 'chinese' },   // 数子法,黑贴 3¾ 子 (=7.5目)
  japanese: { komi: 6.5, label: 'japanese' },  // 点目法,黑贴 6.5 目
  free:     { komi: 0,   label: 'free' }       // 自由对弈,数子不贴目
};

function stoneName(c){ return c === BLACK ? '黑' : '白'; }

/* ---------- 随机 64 位哈希(zobrist) ---------- */
function rand64(){
  const a = new Uint32Array(2);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(a);
  else { a[0] = (Math.random()*0x100000000)>>>0; a[1] = (Math.random()*0x100000000)>>>0; }
  return (BigInt(a[0]) << 32n) | BigInt(a[1]);
}

class GoEngine {
  constructor(n){ this.init(n || 19); }

  init(n){
    this.N = n;
    this.board = new Uint8Array(n*n);
    this.caps = [0,0,0];        // caps[BLACK]/caps[WHITE] = 双方提子数
    this.hist = [];             // {x,y,color,dead:[...],deadColor,hash} 或 {pass:true,color}
    this.hashStack = [];        // 每手后的局面哈希(superko 查重用)
    this.turn = BLACK;
    this.passStreak = 0;
    this.placed = 0;
    this.lastMove = null;       // {x,y}
    this.zb = [new Array(n*n), new Array(n*n), new Array(n*n)];
    for (let i=0;i<n*n;i++){ this.zb[0][i]=0n; this.zb[1][i]=rand64(); this.zb[2][i]=rand64(); }
    this.hash = 0n;
  }

  idx(x,y){ return y*this.N + x; }
  xy(i){ return [i%this.N, (i/this.N)|0]; }
  inb(x,y){ return x>=0 && y>=0 && x<this.N && y<this.N; }
  get(x,y){ return this.board[y*this.N+x]; }

  /* 同色连通块 + 气(gather 自起点 i,需 b[i]!=0) */
  gatherFrom(b, i, N){
    N = N || this.N;
    const col = b[i]; if (!col) return null;
    const pts = [], libSet = new Set(), seen = new Set([i]), q = [i];
    while (q.length){
      const p = q.pop(); pts.push(p);
      const px = p%N, py = (p/N)|0;
      for (const [dx,dy] of DIRS){
        const nx = px+dx, ny = py+dy;
        if (nx<0||ny<0||nx>=N||ny>=N) continue;
        const np = ny*N+nx, c = b[np];
        if (c === 0) libSet.add(np);
        else if (c === col && !seen.has(np)){ seen.add(np); q.push(np); }
      }
    }
    return { pts, libs: libSet };
  }

  /* 在棋盘 b 上于 (x,y) 落 color 子:提子→自杀回退。返回被提点数,非法(占位/自杀)返回 -1 */
  placeOn(b, x, y, color, capOut, N){
    N = N || this.N;
    const i = y*N+x;
    if (b[i]) return -1;
    const opp = 3-color;
    b[i] = color;
    const killed = [];
    const seenG = new Set();
    for (const [dx,dy] of DIRS){
      const nx=x+dx, ny=y+dy;
      if (nx<0||ny<0||nx>=N||ny>=N) continue;
      const j = ny*N+nx;
      if (b[j] !== opp) continue;
      const g = this.gatherFrom(b, j, N);
      if (seenG.has(g.pts[0])) continue;
      seenG.add(g.pts[0]);
      if (g.libs.size === 0){
        for (const p of g.pts){ b[p] = 0; killed.push(p); }
      }
    }
    const self = this.gatherFrom(b, i, N);
    if (self.libs.size === 0){                    // 自杀:回退
      b[i] = 0;
      for (const p of killed) b[p] = opp;
      return -1;
    }
    if (capOut) for (const p of killed) capOut.push(p);
    return killed.length;
  }

  computeHash(b){
    let h = 0n;
    for (let i=0;i<b.length;i++){ const c=b[i]; if (c) h ^= this.zb[c][i]; }
    return h;
  }

  /* 完整合法性:空位 + 非自杀 + 不造成全局同型重复(superko) */
  tryLegal(x, y, color){
    if (!this.inb(x,y) || this.get(x,y)) return false;
    const b = this.board.slice();
    if (this.placeOn(b, x, y, color, null, this.N) < 0) return false;
    const h = this.computeHash(b);
    return !this.hashStack.includes(h);
  }

  /* 执行一步。非法返回 null,否则 {dead:被提点数, ...} */
  execute(x, y, color){
    if (!this.tryLegal(x,y,color)) return null;
    const dead = [];
    const removed = this.placeOn(this.board, x, y, color, dead, this.N);
    this.hash = this.computeHash(this.board);
    this.hashStack.push(this.hash);
    const opp = 3-color;
    this.caps[color] += dead.length;
    this.hist.push({ x, y, color, dead: dead.slice(), deadColor: opp, hash: this.hash });
    this.placed++;
    this.lastMove = {x,y};
    this.passStreak = 0;
    this.turn = opp;
    return { deadLen: dead.length, dead: dead.slice() };
  }

  pass(color){
    this.hist.push({ pass:true, color });
    this.hashStack.push(this.hash);       // pass 不改局面,栈仍推进以便 undo 对称
    this.passStreak++;
    this.turn = 3-color;
    return true;
  }

  undoOnce(){
    const e = this.hist.pop();
    if (!e) return false;
    this.hashStack.pop();
    if (e.pass){
      this.passStreak = Math.max(0, this.passStreak-1);
    } else {
      const i = this.idx(e.x, e.y);
      this.board[i] = 0;
      for (const p of e.dead) this.board[p] = e.deadColor;
      this.caps[e.color] -= e.dead.length;
      this.placed--;
    }
    this.turn = e.color;
    this.hash = this.hashStack.length ? this.hashStack[this.hashStack.length-1] : 0n;
    // 重算 lastMove
    this.lastMove = null;
    for (let k=this.hist.length-1;k>=0;k--){
      const m = this.hist[k];
      if (!m.pass){ this.lastMove = {x:m.x, y:m.y}; break; }
    }
    return true;
  }

  /* 悔棋:先撤最近一手,再继续撤到轮到 playerColor(玩家回合点击时,
   * 会撤掉 AI 的应手 + 玩家上一手,回到玩家落子前) */
  undoTo(playerColor){
    if (!this.hist.length) return;
    this.undoOnce();
    let guard = 0;
    while (this.turn !== playerColor && this.hist.length && guard++ < 400) this.undoOnce();
  }

  historyLen(){ return this.hist.length; }
  nonPassMoves(){ let n=0; for (const h of this.hist) if(!h.pass) n++; return n; }
}

/* ---------- 计分 ----------
 * deadPts: 清理阶段被玩家标记为死子的点集合(Set<index>)。
 * 返回 {mode, black, white, komi, margin, winner, rows, deadB, deadW, mixed}
 * winner: 'black'|'white'|'draw'
 */
function computeScore(eng, ruleId, deadPts){
  const N = eng.N, b = eng.board;
  const dead = deadPts || new Set();
  const deadB = [], deadW = [];
  for (const p of dead){ (b[p]===BLACK ? deadB : deadW).push(p); }

  // 活子数(死子视为已被提走)
  let bs = 0, ws = 0;
  for (let i=0;i<b.length;i++){
    const c = b[i];
    if (dead.has(i)) continue;
    if (c===BLACK) bs++; else if (c===WHITE) ws++;
  }
  // 空域(原始空点 + 死子点),4 连通分区
  const seen = new Uint8Array(b.length);
  let blackArea = 0, whiteArea = 0, mixed = 0, mixedPts = 0;
  for (let i=0;i<b.length;i++){
    if (seen[i] || b[i]) continue;
    const q = [i]; seen[i] = 1;
    const nb = new Set(); let size = 0;
    while (q.length){
      const p = q.pop(); size++;
      const px = p%N, py = (p/N)|0;
      for (const [dx,dy] of DIRS){
        const nx=px+dx, ny=py+dy;
        if (nx<0||ny<0||nx>=N||ny>=N) continue;
        const np = ny*N+nx;
        const c = b[np];
        if (c===0 && !dead.has(np)){ if(!seen[np]){seen[np]=1;q.push(np);} }
        else if (c!==0 && !dead.has(np)) nb.add(c);
      }
    }
    if (nb.size === 1){ if (nb.has(BLACK)) blackArea += size; else whiteArea += size; }
    else if (nb.size === 2){ mixed++; mixedPts += size; }
  }
  const capB = eng.caps[BLACK], capW = eng.caps[WHITE];
  const komi = RULES[ruleId].komi;
  let black, white, mode;

  if (ruleId === 'japanese'){
    mode = 'japanese';
    black = blackArea + capB + deadW.length;   // 黑:空 + 黑吃白(含死白)
    white = whiteArea + capW + deadB.length;   // 白:空 + 白吃黑(含死黑)
  } else {
    mode = ruleId === 'chinese' ? 'chinese' : 'free';
    // 数子法:子空皆地;双活/单官点双方均分
    black = bs + blackArea + mixedPts/2 + (mixedPts%2 ? 0.5 : 0); // mixedPts 恒整数→ 直接 bs+blackArea+mixedPts/2
    white = ws + whiteArea + mixedPts/2;
  }
  // 修正上面表达式(整数/2 可能 .5,无需再补)
  if (ruleId !== 'japanese'){
    black = bs + blackArea + mixedPts/2;
    white = ws + whiteArea + mixedPts/2;
  }
  const diff = black - white;           // 黑 - 白
  const margin = diff - komi;           // >0 黑胜
  let winner, marginAbs;
  if (Math.abs(margin) < 1e-9){ winner = 'draw'; marginAbs = 0; }
  else if (margin > 0){ winner = 'black'; marginAbs = margin; }
  else { winner = 'white'; marginAbs = -margin; }
  return {
    mode, black, white, komi, diff, margin: marginAbs, winner,
    deadB: deadB.length, deadW: deadW.length,
    bs, ws, blackArea, whiteArea, mixedPts, capB, capW
  };
}

if (typeof window !== 'undefined'){
  window.GoEngine = GoEngine;
  window.computeScore = computeScore;
  window.RULES = RULES;
  window.EMPTY = EMPTY; window.BLACK = BLACK; window.WHITE = WHITE;
}
