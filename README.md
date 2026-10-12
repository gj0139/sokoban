# 推箱子 · Sokoban

一个**单文件、零依赖**的网页版推箱子游戏，收录 **Microban 完整 155 关**。

🎮 **在线试玩**：https://gj0139.github.io/sokoban/

也可以把 `sokoban.html` 下载下来直接双击打开 —— 没有任何外部依赖，不需要构建、不需要服务器。

## 特性

- **Microban 完整 155 关**，由易到难（含 6 箱对称关，以及 30×17、11 箱的终局大关）
- 方向键 / `W` `A` `S` `D` 移动；手机端支持**滑动手势 + 虚拟方向键**
- 撤销（`Z`，无限步）、重玩（`R`）、选关（逐关解锁，标记 ✓ 最佳步数）
- 步数 / 推动次数统计，箱子推上目标会变绿发光
- **手机端默认全屏**：首次触摸自动进入全屏，工具栏也有 ⛶ 全屏开关；配合 PWA manifest（`display: fullscreen`）**添加到主屏幕后启动即全屏**，状态栏取主题色、刘海安全区已适配
- 通关弹层与记录，进度用 `localStorage` 自动保存，刷新不丢
- **关卡深链**：`sokoban.html?level=155` 直达并解锁任意一关，方便分享单关
- 墙壳外的填充空格会被判定为「虚空」，不可走也不渲染

## 玩法

把所有木箱推到**虚线圆圈**上即可过关。箱子只能推、不能拉，一次只能推一个。

## 关卡来源

关卡设计来自 **Microban 关卡集，作者 David W. Skinner（2000 年 4 月）**，可自由分发（需署名）。
来源：<http://users.bentonrea.com/~sasquatch/sokoban/>

本仓库收录**完整 155 关**；原始参考数据在 `tools/ref-levels2.js`。

## 项目结构

| 文件 | 作用 |
|------|------|
| `sokoban.html` | 游戏本体：`<script id="engine">` 是纯逻辑引擎（无 DOM），其后是 UI 层 |
| `index.html` | 首页入口，秒转发到游戏 |
| `manifest.json` | PWA 清单，`display: fullscreen` 让主屏幕启动即全屏 |
| `assets/icon-192.png` `assets/icon-512.png` | 应用图标，由 `tools/make-icon.mjs` 零依赖生成 |
| `tools/engine.test.mjs` | 引擎单元测试（12 条） |
| `tools/verify-embed.mjs` | 校验内嵌关卡与参考数据逐字一致、且不会开局即通关 |
| `tools/solve.mjs` | BFS + 死格剪枝求解器，证明每一关都可解并给出参考解 |
| `tools/build-levels.mjs` / `sync-levels.mjs` | 关卡筛选与机械同步（杜绝手抄转录错误） |
| `tools/serve.mjs` | 本地试玩用的极简静态服务器 |
| `tools/check-live.mjs` | 部署后冒烟检查：线上页面是否真的在提供游戏 |

## 开发与测试

需要 Node.js 18+（测试用到 `node --test`）。

```bash
# 引擎单元测试
node --test tools/engine.test.mjs

# 关卡数据校验
node tools/verify-embed.mjs

# 逐关求解，证明可解并打印参考解（可调深度：SOLVE_MAX_NODES=15000000 node tools/solve.mjs）
node tools/solve.mjs

# 本地试玩 http://127.0.0.1:8321/sokoban.html
node tools/serve.mjs

# 部署后冒烟检查：首页转发 / 游戏本体 / manifest / 图标
node tools/check-live.mjs

# 重新生成 PWA 图标（零依赖手写 PNG 编码器）
node tools/make-icon.mjs
```

## 开发方式

按 [superpowers](https://github.com/obra/superpowers) 的 **TDD（红-绿-重构）** 流程开发：
先写测试并确认它失败，再写最小实现让它通过。求解器在发布前逐关验证了可解性。
