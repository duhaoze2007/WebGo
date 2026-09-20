/* ============================================================
 * go-ai.js — 启发式评估 + 三档 AI(入门/进阶/高手)
 * 纯逻辑。评估基于局部棋形:提子/打吃/逃生/连接分断/角部布局。
 * 娱乐级引擎:强于吃子与局部,大局观有限。
 * ============================================================ */
'use strict';

const DIR4 = [[1,0],[-1,0],[0,1],[0,-1]];

/* 评估在 (x,y) 落 color 对棋手自己的即时价值(读 board,不改) */
function estMove(board, N, x, y, color, rnd){
  const i = y*N + x;
  if (board[i]) return -1e9;
  const opp = 3 - color;
  let score = 0;

  // 邻居按块分组(对方块、己方块)
  const oppBlocks = [];   // 去重后的对方相邻块
  const oppSeen = new Set();
  const ownBlocks = [];   // 去重后的己方相邻块
  const ownSeen = new Set();
  for (const [dx,dy] of DIR4){
    const nx=x+dx, ny=y+dy;
    if (nx<0||ny<0||nx>=N||ny>=N) continue;
    const j = ny*N+nx;
    const c = board[j];
    if (!c) continue;
    const col = c;
    // gather
    const pts=[], seen=new Set([j]), q=[j];
    while (q.length){
      const p=q.pop(); pts.push(p);
      const px=p%N, py=(p/N)|0;
      for (const [dx2,dy2] of DIR4){
        const ax=px+dx2, ay=py+dy2;
        if (ax<0||ay<0||ax>=N||ay>=N) continue;
        const ap=ay*N+ax, ac=board[ap];
        if (ac===col && !seen.has(ap)){ seen.add(ap); q.push(ap); }
      }
    }
    const libs = new Set();
    for (const p of pts){
      const px=p%N, py=(p/N)|0;
      for (const [dx2,dy2] of DIR4){
        const ax=px+dx2, ay=py+dy2;
        if (ax<0||ay<0||ax>=N||ay>=N) continue;
        if (board[ay*N+ax]===0) libs.add(ay*N+ax);
      }
    }
    const key = pts[0];
    if (col === opp && !oppSeen.has(key)){ oppSeen.add(key); oppBlocks.push({pts,len:pts.length,libs}); }
    else if (col === color && !ownSeen.has(key)){ ownSeen.add(key); ownBlocks.push({pts,len:pts.length,libs}); }
  }

  // 会被提掉的对方块(唯一气就是本落点)
  const caps = oppBlocks.filter(g => g.libs.size === 1);
  let capVal = 0;
  for (const g of caps) capVal += Math.min(420, 60 + 52*g.len);

  // 落子后己方新块气数(把将被提的对方块点近似折算进气)
  let selfLibs = 0;
  for (const [dx,dy] of DIR4){
    const nx=x+dx, ny=y+dy;
    if (nx<0||ny<0||nx>=N||ny>=N) continue;
    if (board[ny*N+nx] === 0) selfLibs++;
  }
  for (const g of caps) selfLibs += g.len;     // 近似:被提块整体变为气
  if (selfLibs <= 0) return -1e9;              // 自杀

  const atariSelf = ownBlocks.some(g => g.libs.size === 1);   // 己方有块被打吃,本点即其最后一气
  const maxOwnLen = ownBlocks.reduce((m,g)=>Math.max(m,g.len),0);

  // --- 吃子 ---
  score += capVal;
  if (capVal > 0 && caps.length === 1 && caps[0].len === 1 && selfLibs === 1) score += 30; // 提劫

  // --- 对方威胁/紧气 ---
  for (const g of oppBlocks){
    if (g.libs.size === 2) score += 11 + Math.min(g.len,7)*1.4;      // 打吃
    else if (g.libs.size === 3) score += 4;                          // 紧气
    else if (g.len >= 5 && g.libs.size <= 4) score += 5;             // 压迫大块
  }
  // --- 分断(对方两块互不相连被本点隔开) ---
  const cutCount = oppBlocks.filter(g => !caps.includes(g)).length;
  if (cutCount >= 2) score += 10*(cutCount-1);
  // --- 连接己方两块 ---
  if (ownBlocks.length >= 2) score += 15;

  // --- 己方气/逃命 ---
  if (selfLibs === 1){
    if (capVal > 0) score += 26;                    // 打劫/紧气提后单气
    else if (atariSelf) score -= 60 + (maxOwnLen)*5; // 送死
    else score -= 22;                                // 自撞一气(对杀紧气时也可接受)
  } else if (selfLibs === 2){
    if (atariSelf) score += 58 + maxOwnLen*5;        // 成功逃出打吃
    else score += 5;
  } else {
    if (atariSelf) score += 42 + maxOwnLen*4;        // 逃出并有多气
    else score += 3;
  }
  // 提子同时让己方大块脱困
  if (capVal > 0 && atariSelf) score += 30;

  // --- 空旷点:角部布局(星位/小目/三三带) ---
  if (oppBlocks.length === 0 && ownBlocks.length === 0 && capVal === 0 && engPlacedCount(board) < 18){
    const gx = x*18/(N-1), gy = y*18/(N-1);
    const cps = [[2.6,2.6],[2.6,15.4],[15.4,2.6],[15.4,15.4]];
    let dmin = 1e9;
    for (const [cx,cy] of cps){
      const d = Math.hypot(gx-cx, gy-cy);
      if (d < dmin) dmin = d;
    }
    let layout = 3.6 - 0.42*dmin;
    const edge = Math.min(x, N-1-x, y, N-1-y);
    if (edge <= 0) layout -= 9;          // 一线
    else if (edge <= 1) layout -= 3.2;   // 二线
    score += Math.max(layout, -2);
  }

  if (rnd) score += (Math.random()*2-1)*rnd;
  return score;
}
function engPlacedCount(board){ let n=0; for (let i=0;i<board.length;i++) if(board[i]) n++; return n; }

/* AI 落子入口。返回 {x,y} 或 null(=让一手/pass)。
 * diff: 'easy' | 'normal' | 'hard' */
function aiChoose(eng, color, diff){
  const N = eng.N, board = eng.board;
  const cands = [];
  const amp = diff==='easy' ? 14 : diff==='hard' ? 1.6 : 4;
  for (let y=0;y<N;y++) for (let x=0;x<N;x++){
    if (board[y*N+x]) continue;
    const s = estMove(board, N, x, y, color, amp);
    if (s > -1e8) cands.push({x, y, s});
  }
  if (!cands.length) return null;
  const totalPlaced = eng.placed;

  if (diff === 'easy'){
    // 入门:偶尔瞎下,弱(但必须合法)
    if (Math.random() < 0.45){
      for (let k=0;k<24;k++){
        const c = cands[(Math.random()*cands.length)|0];
        if (eng.tryLegal(c.x, c.y, color)) return {x:c.x, y:c.y};
      }
      return pickLegal(eng, cands.slice(0, 24), color, true);
    }
    cands.sort((a,b)=>b.s-a.s);
    const top = cands.slice(0, Math.min(10, cands.length));
    return pickLegal(eng, top, color, true);
  }

  cands.sort((a,b)=>b.s-a.s);

  // 让一手判定(后盘无棋可下时)
  const passThr = totalPlaced > 110 ? (diff==='hard'?0.7:-0.4)
                : totalPlaced > 70 ? (diff==='hard'?-0.6:-1.6)
                : diff==='hard' ? -4 : -6;
  if (cands[0].s < passThr){
    // 仍保留极低概率不 pass(避免死循环观感差)
    if (totalPlaced > 90 && Math.random() < 0.2) return null;
  }

  if (diff === 'normal'){
    const top = cands.slice(0, 12);
    return pickLegal(eng, top, color, false);
  }

  // hard:top 候选做 1 层"我下→对手最佳应"模拟,取净收益
  const topN = cands.slice(0, 10);
  const scored = [];
  for (const c of topN){
    const b2 = board.slice();
    const dead1 = [];
    eng.placeOn(b2, c.x, c.y, color, dead1, N);
    // 对手最佳应对(其评估)
    let rr = null, rbest = -1e9;
    for (let y=0;y<N;y++) for (let x=0;x<N;x++){
      if (b2[y*N+x]) continue;
      const s = estMove(b2, N, x, y, 3-color, 1.2);
      if (s > rbest){ rbest = s; rr = {x,y,s}; }
    }
    let myLoss = 0, oppDanger = 0;
    if (rr){
      const dead2 = [];
      eng.placeOn(b2, rr.x, rr.y, 3-color, dead2, N);
      myLoss = dead2.length;                       // 我被提子数
      const mine = eng.gatherFrom(b2, c.y*N+c.x, N);
      if (mine && mine.libs.size === 1) oppDanger = 40;   // 对手走后我仍只有一气
      else if (mine && mine.libs.size === 0) myLoss += 10;
    }
    const net = c.s - myLoss*95 - oppDanger + (dead1.length ? dead1.length*18 : 0);
    scored.push({x:c.x, y:c.y, net});
  }
  scored.sort((a,b)=>b.net-a.net);
  const candidates = scored.slice(0, 3);
  let r = pickLegal(eng, candidates, color, false);
  if (!r){ // 兜底:按启发分顺序找第一个合法点
    for (const c of cands){ if (eng.tryLegal(c.x, c.y, color)){ r = {x:c.x, y:c.y}; break; } }
  }
  return r;
}

/* 从候选(按分排序)中取第一个合法的;若全非法则从全局合法点兜底 */
function pickLegal(eng, cands, color, allowAny){
  for (const c of cands){
    if (eng.tryLegal(c.x, c.y, color)) return {x:c.x, y:c.y};
  }
  if (allowAny){
    const N = eng.N, board = eng.board;
    const all = [];
    for (let y=0;y<N;y++) for (let x=0;x<N;x++){
      if (!board[y*N+x] && eng.tryLegal(x,y,color)) all.push({x,y});
    }
    if (all.length) return all[(Math.random()*all.length)|0];
  }
  return null;
}

if (typeof window !== 'undefined'){
  window.estMove = estMove;
  window.aiChoose = aiChoose;
}
