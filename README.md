# 围棋 · GO — 人机对弈

> 木质棋盘风的人机对弈网页围棋，纯前端、零依赖、无需后端。
> A wooden-board browser Go game with a heuristic AI — pure front-end, zero dependencies.

打开 `index.html` 就能下棋。棋盘、规则引擎、AI 全部跑在浏览器里，不联网、不上传任何数据。计分规则（中国 / 日韩 / 自由）可在对局中随时切换，终局按当前所选规则结算。

Just open `index.html` and play. Board, rules and AI all run client-side — no network, no data leaves your machine. The scoring rule (Chinese / Japanese-Korean / free) can be switched mid-game and is applied at scoring time.

---

## ✨ 功能特性 · Features

- 🤖 **三档 AI** —— 入门 / 进阶 / 高手，浏览器端启发式引擎，擅长吃子与局部战斗；高手档会在候选点做 1 层「我下 → 对手最佳应」模拟取净收益。
  **Three AI levels** —— easy / normal / hard heuristic engine running in the browser; hard evaluates top candidates with a 1-ply "my move → opponent's best reply" rollout.
- 📏 **三档棋盘** —— 9 路（小棋盘，适合入门）、13 路、19 路（标准）。
  **Board sizes** —— 9×9, 13×13, 19×19.
- ⚖️ **三种计分规则，对局中可随时切换**
  **Three scoring rules, switchable mid-game**
  - 中国规则：数子法，黑贴 3¾ 子（= 7.5 目），子空皆地。
    Chinese: area scoring, komi 7.5.
  - 日韩规则：点目法，黑贴 6.5 目。
    Japanese/Korean: territory scoring, komi 6.5.
  - 自由对弈：数子不贴目。
    Free: area scoring, no komi.
- 🎨 **木质棋盘渲染** —— 三层 Canvas（棋盘底纹 / 棋子 / 特效）叠加，棋子有落子动画与投影，观感接近实体棋具。
  **Wooden board rendering** —— three stacked canvases (grain / stones / effects) with placement animation.
- 👆 **完整对局操作** —— 悔棋、让一手（Pass）、认输、结束计分；终局进入清理模式，点选已死棋块（再点取消）后确认计分。
  **Full game controls** —— undo, pass, resign, count & finish; end-of-game cleanup mode lets you tap dead groups (tap again to cancel) before confirming the score.
- 🌏 **中英双语** —— 浏览器语言自动检测，可手动切换并记住选择。
  **Bilingual zh-CN / EN** —— auto-detected from the browser, manually switchable and remembered.
- 🧩 **纯静态** —— 没有构建步骤、没有 npm 依赖、没有服务器；`file://` 直接打开也能跑（终局计分等全部功能正常）。
  **Zero build / zero deps** —— no bundler, no npm packages, no backend; works straight from `file://`.

---

## 🚀 使用 · Usage

```bash
# 方式一：直接双击打开
open index.html

# 方式二：起一个静态服务器（推荐，行为与线上一致）
python3 -m http.server 8000
# → http://127.0.0.1:8000
```

操作顺序：选规则 → 选路数 → 选执子（黑先）→ 选 AI 难度 → **新开一局**。

Flow: pick rule → board size → your color → AI difficulty → **New game**.

---

## 📁 文件结构 · Project layout

| 文件 / File | 作用 / Role |
| --- | --- |
| `engine.js` | 围棋规则引擎（中国/日韩/自由规则、数子 + 点目、提子、禁入点、双活处理），纯逻辑、不依赖 DOM / Go rules engine — pure logic, no DOM |
| `ai.js` | 启发式评估 + 三档 AI / heuristic evaluation and the three AI levels |
| `go.js` | UI 层：棋盘渲染、交互、计分流程、i18n / UI: rendering, interaction, scoring flow, i18n |
| `index.html` | 页面结构与样式（木质风） / page shell and styles |
| `selftest_node.js` | Node 冒烟测试：规则引擎 + AI 的核心用例 / Node smoke tests for engine + AI |

---

## 🧪 测试 · Tests

```bash
node selftest_node.js
```

覆盖提子、禁入点（打劫）、终局数子/点目、AI 落子合法性等核心场景。

Covers captures, ko / suicide legality, end-game area & territory counting, and AI move legality.

---

## ⚠️ 已知取舍 · Known trade-offs

- AI 是**娱乐级**启发式引擎，不是 KataGo 类的神经网络棋力：局部战斗和吃子尚可，全局大局观偏弱。
  The AI is an entertainment-grade heuristic engine, not a neural-net player — decent at local fights and captures, weak at whole-board strategy.
- 双活与未收单官按简化方式处理：中国规则均分，日韩规则不计。
  Seki and unfilled dame are handled simply: split in Chinese rules, ignored in Japanese/Korean rules.
- 计分依赖手动标记死子，没有自动死活判定。
  Dead-stone marking is manual; there is no automatic life-and-death detection.

---

## 📄 License

MIT © 2026 Du Haoze — 见 [LICENSE](./LICENSE)。
