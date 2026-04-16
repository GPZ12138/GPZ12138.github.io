# 工作总结 — Peizhong Gao 个人主页 (中文)

**日期：** 2026-04-15  
**作者：** 高培中 (Peizhong "Chill" Gao)  
**交付内容：** 静态个人主页 + Scholar 实时小组件 + 中英双语切换 + 文档

## 站点目标

一个纯静态、单页的学术个人主页，围绕三件事清晰传达：

1. **身份。** 姓名、照片、机构（GIX · 清华 × University of Washington）。
2. **轨迹。** 即将加入 **[REDACTED]** [REDACTED]任 AI Research Scientist 实习生，
   通过 **[REDACTED] ([REDACTED])** 人才项目，2026 年夏；此前在 Moonshot AI
   (Kimi-Researcher + Kimi K2 Data Science 能力负责人)、微软亚洲研究院
   (Natural Language Computing Group)、清华未来实验室 / AIR 工作。
3. **影响力。** 总被引 **777**，h-index **7**，论文 **9** 篇；逐年引用柱状图
   直接从 Google Scholar 同步。

页面在手机上是单列，在桌面端是 280 px 固定侧栏 + 自适应主栏的双列布局。
整个站点只用灰度配色，单一字体（Source Sans 3），不用斜体，不用彩色。

## 架构要点

- **零构建。** 纯 HTML + CSS + 原生 JS。`git push` 即部署。
- **没有服务器也能实时同步 Scholar。** GitHub Actions 每天运行一次，采用
  **两级礼貌轮询**：先发一次普通浏览器 UA 的 HTTPS GET 打开 Scholar 公开
  资料页（一次请求，跟人点刷新一样），只从 HTML 里读出总引用数这个一个
  数字，跟 `data/scholar.json` 比对；只有数字真的变了才会进入第二级，用
  `scholarly` 做完整抓取并写入新快照。客户端每次打开页面都会 fetch 这个
  JSON 并以动画呈现数字。抓取失败时会保留上次快照、只更新 `last_check`，
  保证公开数字不会瞬间归零。
- **双语（英 / 中），同一路由。** 每个可翻译节点都带 `data-en` 和
  `data-zh` 两个属性；一段 120 行左右的原生 JS 在按钮点击时就地替换
  `textContent` / `innerHTML`，并把选择持久化到 localStorage。
- **明暗主题切换。** 默认跟随系统偏好，可手动覆盖并持久化。整套暗色模式
  只是对 CSS 变量的一次覆盖。

## 保密与口吻

整页文案刻意保持**客观、克制、以事实为先**。Moonshot AI 的工作只写公开可
查证的数字 —— **HLE 8.6% → 26.9%** 以及 Kimi K2 技术报告的 **574** 次引用。
所有内部流程、内部基准数量、未公开指标都不写。只有第一作者论文的署名中，
依论文规范体现所在组的信息；清华校内教授的姓名完全不出现在本页。

Kimi K2 / K2 Thinking 的身份表述统一为"**担任 Data Science 能力负责人
(owned the Data Science capability)**" —— 与 tools、reasoning 等其他能力
模块并列，作为 post-training 中的一块独立能力方向。

## 仓库交付

- `index.html` — 页面本体
- `styles.css` — 纯灰度样式
- `script.js` — 主题 / 语言 / Scholar 拉取 / 导航联动 / 滚动淡入
- `assets/profile.jpg` — 头像（来自公开的 Scholar 资料页）
- `data/scholar.json` — 最近一次同步的 Scholar 快照（自动更新）
- `scripts/fetch_scholar.py` + `requirements.txt` — 抓取脚本
- `.github/workflows/update-scholar.yml` — 每天的 cron + 手动触发（两级礼貌轮询）
- `docs/DESIGN_SPEC.md` — 设计规范：原则、色板、字体、排版、组件规则、
  哪些词要加粗 / 哪些不要
- `docs/ENGINEERING_SPEC.md` — 工程规范：架构、文件契约、部署手册、测试清单
- `docs/WORK_SUMMARY_EN.md` / `docs/WORK_SUMMARY_ZH.md` — 本报告
- `README.md` — 面向开发者的 README（本地预览、Scholar 更新、内容编辑、部署）

## 迭代历程（要点）

页面经过多轮定向修改，方向由页面主人实时反馈驱动：

1. **v1 — 衬线编辑风单栏。** 否决：不像研究者网站。
2. **v2 — 学术 al-folio 双栏。** 围绕强调方式、色彩、emoji 密度做了多轮打磨。
3. **v3 — 双语 + Scholar 实时小组件 + 灰度单色。** 最终方向：没有彩色标签、
   没有斜体、单字体、单配色、Scholar 数字来自真实抓取、完整的 EN / 中 切换。

整个过程中我们把加粗规则收紧到（机构 + 项目名 + 角色要点 + 关键数字），从
英文版中剔除了所有中文字符，也把原本 emoji 风格的联系人图标替换为真实的品牌
SVG 并排成 3 列网格。

## 后续可选工作

- Scholar 抓取运行在 GitHub 的数据中心 IP 段上，被 Scholar 限流是常态。
  如果某次窗口里免费代理都失败，数据会原样保留 —— 设计规范要求失败永远
  不能以"归零"形式暴露给读者。
- 页面是静态的：新增一篇论文 / 动态 / 工作经历，只需编辑 `index.html`
  再推一次即可。
