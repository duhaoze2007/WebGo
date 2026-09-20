// Node 冒烟测试:规则引擎 + AI(不依赖 DOM)
'use strict';
const fs = require('fs');
const vm = require('vm');
global.window = global;   // 让 engine.js / ai.js 导出到全局
const dir = '/home/ubuntu/go-site/';
vm.runInThisContext(fs.readFileSync(dir+'engine.js','utf8'), {filename:'engine.js'});
vm.runInThisContext(fs.readFileSync(dir+'ai.js','utf8'), {filename:'ai.js'});
const { GoEngine, computeScore } = global;
const { BLACK, WHITE } = global;
let fails = 0;
const check = (name, cond, extra) => {
  if (cond) console.log('PASS  '+name);
  else { fails++; console.log('FAIL  '+name + (extra!==undefined ? ' :: '+JSON.stringify(extra) : '')); }
};

// 1. 提子
{
  const e = new GoEngine(19);
  e.board[9*19+9] = WHITE;  e.board[9*19+8] = BLACK;
  e.board[9*19+10] = BLACK; e.board[8*19+9] = BLACK;
  e.hash = e.computeHash(e.board);
  const r1 = e.execute(9, 10, BLACK);   // 白正下方的气点 (9,10)
  check('capture 白(9,9)被提', r1 && r1.deadLen===1 && e.caps[BLACK]===1 && e.board[9*19+9]===0, r1);
  check('capture 提后黑块存活', e.board[9*19+8]===BLACK && e.board[9*19+10]===BLACK);
}

// 2. 劫(立即提回被 superko 禁)
{
  const k = new GoEngine(19);
  k.board[0*19+2]=BLACK; k.board[1*19+1]=BLACK; k.board[0*19+1]=WHITE;
  k.hash = k.computeHash(k.board); k.hashStack.push(k.hash);
  const rk = k.execute(0,0,BLACK);
  check('ko 黑(0,0)提白成功', rk && rk.deadLen===1);
  check('ko 白(1,0)立即提回被禁', k.tryLegal(1,0,WHITE) === false);
  const ok2 = k.execute(2,1,WHITE) || k.execute(1,2,WHITE); // 白走别处
  check('ko 白走别处合法', !!ok2);
}

// 3. 自杀禁
{
  const s = new GoEngine(9);
  // 白(4,4)被黑围,黑空 1 点 (4,5)?构造白块唯一气被黑自填场景:黑(4,4)周围白
  const e9 = new GoEngine(9);
  e9.board[3*9+4]=WHITE; e9.board[5*9+4]=WHITE; e9.board[4*9+3]=WHITE; e9.board[4*9+5]=WHITE; // 围住(4,4)
  e9.hash = e9.computeHash(e9.board);
  const su = e9.execute(4,4,BLACK); // 黑填进白包围圈 → 自杀
  check('suicide 黑填白眼被禁', su === null, su);
}

// 4. 自对弈:三档难度各 2 局 9路/19路,直到双pass或100手,全程无非法着
{
  for (const diff of ['easy','normal','hard']){
    for (const size of [9,19]){
      const e = new GoEngine(size);
      let passes=0, ok=true, illegalMsg='';
      for (let pl=0; pl<110; pl++){
        const c = e.turn;
        const mv = aiChoose(e, c, diff);
        if (!mv){ e.pass(c); passes++; if (passes>=2) break; continue; }
        const r = e.execute(mv.x, mv.y, c);
        if (!r){ ok=false; illegalMsg='illegal at ply '+pl+' c='+c+' mv='+JSON.stringify(mv); break; }
        passes=0;
      }
      const sc = computeScore(e, 'chinese', new Set());
      check('selfplay '+diff+' '+size+'x'+size+' ended='+(passes>=2)+' plies='+e.nonPassMoves(),
            ok && sc.black+sc.white>0, illegalMsg || sc);
    }
  }
}

// 5. 悔棋往返一致
{
  const e = new GoEngine(9);
  const seq = [[4,4],[3,3],[5,5],[3,4],[4,5],[2,2]];
  for (const [x,y] of seq) { const r = e.execute(x,y,e.turn); if(!r) throw new Error('move fail '+x+','+y); }
  const snap = { board: Array.from(e.board), caps: e.caps.slice(), turn: e.turn, placed: e.placed, h: String(e.hash) };
  e.undoOnce(); e.undoOnce();   // 撤最后两手:白(2,2)、黑(4,5)
  check('undo 减两子且轮到黑', e.placed===4 && e.turn===BLACK, {placed:e.placed, turn:e.turn});
  e.execute(4,5,BLACK);
  const r6 = e.execute(2,2,WHITE);
  check('undo 后重放成功', !!r6);
  const same = Array.from(e.board).every((v,i)=>v===snap.board[i]) && e.turn===snap.turn
             && e.placed===snap.placed && e.caps.every((v,i)=>v===snap.caps[i]) && String(e.hash)===snap.h;
  check('undo 后重放完全还原(盘面/轮次/提子/哈希)', same);
}

// 6. 计分:简易终局(9路:黑占左上角大块,白占右下,贴目结算)
{
  const e = new GoEngine(9);
  // 黑:左半边 4 列全黑;白:右 4 列全白;中列留空当边界? 摆个干净版:黑 (x0-3, y0-8),白 (x5-8, y0-8),中列 x4 空
  for (let y=0;y<9;y++) for (let x=0;x<9;x++){
    if (x<=3) e.board[y*9+x]=BLACK;
    else if (x>=5) e.board[y*9+x]=WHITE;
  }
  e.hash = e.computeHash(e.board);
  const sc = computeScore(e, 'chinese', new Set());
  // 黑子 4*9=36 + 中列归谁? x4 邻黑白双方 → mixed 9 点均分 4.5
  const expectB = 36 + 4.5, expectW = 36 + 4.5;
  check('chinese score black', Math.abs(sc.black-expectB)<1e-9, sc);
  check('chinese score white', Math.abs(sc.white-expectW)<1e-9, sc);
  const scj = computeScore(e, 'japanese', new Set());
  // 点目法:全盘无空无俘 → 0:0;中列双活共享点不计
  check('japanese territory 共享列不计', scj.black===0 && scj.white===0 && scj.mixedPts===9, scj);
  // 数子自由规则(贴0)平局
  const scf = computeScore(e, 'free', new Set());
  check('free no-komi draw', scf.winner==='draw', scf);
}

console.log(fails ? ('\n'+fails+' FAILURES') : '\nALL NODE TESTS PASSED');
process.exit(fails?1:0);
