# 推箱子 · Sokoban

一个**单文件、零依赖**的网页版推箱子游戏，收录 Microban 精选 20 关。

🎮 **在线试玩**：https://gj0139.github.io/sokoban/

也可以把 `sokoban.html` 下载下来直接双击打开 —— 没有任何外部依赖，不需要构建、不需要服务器。

## 特性

- **Microban 精选 20 关**，由易到难（含 6 箱对称关）
- 方向键 / `W` `A` `S` `D` 移动；手机端支持**滑动手势 + 虚拟方向键**
- 撤销（`Z`，无限步）、重玩（`R`）、选关（逐关解锁，标记 ✓ 最佳步数）
- 步数 / 推动次数统计，箱子推上目标会变绿发光
- 通关弹层与记录，进度用 `localStorage` 自动保存，刷新不丢
- 墙壳外的填充空格会被判定为「虚空」，不可走也不渲染

## 玩法

把所有木箱推到**虚线圆圈**上即可过关。箱子只能推、不能拉，一次只能推一个。

## 关卡来源

关卡设计来自 **Microban 关卡集，作者 David W. Skinner（2000 年 4 月）**，可自由分发（需署名）。
来源：<http://users.bentonrea.com/~sasquatch/sokoban/>

本仓库只收录其中的前 20 关，完整 155 关见 `tools/ref-levels2.js`。

## 项目结构

| 文件 | 作用 |
|------|------|
| `sokoban.html` | 游戏本体：`<script id="engine">` 是纯逻辑引擎（无 DOM），其后是 UI 层 |
| `tools/engine.test.mjs` | 引擎单元测试（12 条） |
| `tools/verify-embed.mjs` | 校验内嵌关卡与参考数据逐字一致、且不会开局即通关 |
| `tools/solve.mjs` | BFS + 死格剪枝求解器，证明每一关都可解并给出参考解 |
| `tools/build-levels.mjs` / `sync-levels.mjs` | 关卡筛选与机械同步（杜绝手抄转录错误） |
| `tools/serve.mjs` | 本地试玩用的极简静态服务器 |

## 开发与测试

需要 Node.js 18+（测试用到 `node --test`）。

```bash
# 引擎单元测试
node --test tools/engine.test.mjs

# 关卡数据校验
node tools/verify-embed.mjs

# 证明 20 关全部可解，并打印每关参考解
node tools/solve.mjs

# 本地试玩 http://127.0.0.1:8321/sokoban.html
node tools/serve.mjs
```

## 开发方式

按 [superpowers](https://github.com/obra/superpowers) 的 **TDD（红-绿-重构）** 流程开发：
先写测试并确认它失败，再写最小实现让它通过。求解器在发布前逐关验证了可解性。
