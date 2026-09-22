---
name: "kanjousen.com Design System"
version: "alpha"
description: "Extracted visual reference. Tokens are measured samples; semantic roles require context. Unobserved values are omitted."
colors:
  primary: "rgb(31, 31, 31)"
  surface: "rgb(254, 254, 254)"
typography:
  h1:
    fontFamily: "\"JetBrains Mono\", \"Noto Sans SC\", sans-serif"
    fontSize: "45.3543px"
    fontWeight: 700
  h2:
    fontFamily: "\"JetBrains Mono\", \"Noto Sans SC\", sans-serif"
    fontSize: "30.2362px"
    fontWeight: 700
  h3:
    fontFamily: "\"JetBrains Mono\", \"Noto Sans SC\", sans-serif"
    fontSize: "15.1181px"
    fontWeight: 700
  body:
    fontFamily: "\"JetBrains Mono\", \"Noto Sans SC\", sans-serif"
    fontSize: "15.1181px"
    fontWeight: 400
rounded:
  sample-1: "0px"
spacing:
  sample-1: "0px"
  sample-2: "10px"
  sample-3: "144px"
components:
  sample-button:
    backgroundColor: "rgba(0, 0, 0, 0)"
    textColor: "rgb(31, 31, 31)"
    rounded: "0px"
    padding: "0px"
  sample-link:
    backgroundColor: "rgba(0, 0, 0, 0)"
    textColor: "rgb(0, 123, 255)"
    rounded: "0px"
    padding: "0px"
---

**How to use this file:** Read this extracted design system before building a new page. Preserve the observed visual identity while composing for the new reader's task and content. Keep supplied facts, the host framework, and accessibility requirements intact. This is a sampled reference, not an official brand specification or a fixed page template.

**Evidence priority:** The frontmatter contains conservative measured samples; its token values take precedence over visual estimates. Semantic roles are inferred from the sampled elements and must be checked against their context. Missing tokens, states, themes and breakpoints are unknown, not defaults. Existing host components remain the implementation foundation unless a verified public stylesheet/API is explicitly provided.

## Overview
原站「サイバー環状線的房间」是一个具有浓郁赛博朋克黑客终端、极客个人主页风格的展示型网站。受众主要为对独立开发、科幻小说、技术随笔与极客文化感兴趣的访客，读者的核心任务是浏览博主身份背景、阅读科幻世界观设定（扁舟计划）以及查阅个人随笔与项目链接。

适用范围与限制：本次分析基于 1440x900 桌面视口下采集的单一浅色页面，结合 3 张高分辨率实测截图与 DOM/CSS 采样。本规范适用于构建极简终端风格的开发者主页、文档展示站或极客博客；其局限在于原站仅呈现了基础内容展示，未提供暗色主题切换、复杂表单交互或深层层级导航，且移动端窄屏重排效果未经过实机测试。

核心设计决策：
1. 纯文本 ASCII 艺术与虚拟终端窗体：线索见顶部大幅字符画标题 CYBERKANJOUSEN 以及卡片窗体 |_Ark.exe..._-_=_X_|。推断理由为致敬早期 DOS/Unix 字符终端与复古 BBS 界面。复用规则：主体容器与关键标题优先采用等宽字符画和文本边框包裹，模拟终端窗口的标题栏与按钮。
2. 极简单色高对比色板：线索见 rgb(254, 254, 254) 纯净底色与 rgb(31, 31, 31) 墨黑文字。推断理由为还原纸张打印输出或纯文本阅读器的克制感。复用规则：坚决摒弃现代 UI 常用的多色渐变与柔光，严格维持黑白双色的强烈对比。
3. 严格的等宽排版与倍率字阶：线索见 JetBrains Mono 为全局首选字体，且 Display 字号（45.35px）恰好为 Body 字号（15.12px）的 3.0 倍。复用规则：中英文必须统一为等宽代码字体或几何无衬线，字号间严格遵从 1x/2x/3x 的整数倍阶梯。
4. 符号化微引导与纯文本装饰：线索见分割线 +dwb===...===dwb+、链接标识 > 了解更多 < 与机密涂黑遮盖块。复用规则：避免加载现代矢量图标包，统一使用键盘原生符号与纯文本标点充当交互指示器。

## Colors
原站采用极为克制的单色系调色方案，仅在极少数未内联样式的底层锚点中残留浏览器默认蓝。

- 页面底色（colors.surface）：精确值为 rgb(254, 254, 254)（#fefefe），作为全站所有视窗和画布的基础背景，呈现近乎纯白的高亮画布质感。
- 主前景色（colors.primary）：精确值为 rgb(31, 31, 31)（#1f1f1f），在实测中覆盖段落文字、各级标题、实体分割线以及 ASCII 艺术字边框。它承担了主要的文字传达与结构勾勒职能，并非现代组件库中的彩色强调品牌色。
- 默认链接色（components.sample-link）：实测采样值包含 rgb(0, 123, 255)（#007bff），属于常规浏览器的标准链接蓝；但在原站视觉上，主要行动链接均通过字符修饰与黑色文字呈现。
- 文本涂黑块（机密遮罩色）：在实测截图中的「随笔」卡片内，观察到纯黑遮盖条（用于文字剧透或戏剧化隐藏），作为视觉趣味点。
- 未观察到的色彩：未观察到警告色（红色）、成功色（绿色）或暗色主题变量。严禁自行编造多余的品牌辅助色。

## Typography
排版系统体现了代码编辑器式的技术精确感，采用规范的等宽字体栈与严密的比例阶梯。

- 字体栈：首选 "JetBrains Mono"，中文环境下回退到 "Noto Sans SC"，通用兜底为 sans-serif。确保英文、数字与代码符号在视觉上完全等宽对齐。
- typography.h1：字号 45.35px，字重 700，用于页面主视窗的核心标题（"サイバー環状線的房间"），尺寸达到正文基准的 3.0 倍。
- typography.h2：字号 30.24px，字重 700，用于欢迎引导语（"欢迎来到"）及二级版块标题，尺寸为正文基准的 2.0 倍。
- typography.h3：字号 15.12px，字重 700，用于卡片内小标题、提示警示条，字号与正文相同，仅依靠粗体建立轻度对比。
- typography.body：字号 15.12px，字重 400，用于所有常规叙述性段落与列表说明，字距规整，行距适中。
- 排版规则：所有文本层级严格以 15.12px 为基础单位递进，不插入非标准字号，段落间通过纯文本空行或字符分割线明确断句。

## Layout
布局遵循严格的垂直自上而下单栏与局部双栏卡片网格，结构紧凑且留白对称。

- 顶部导航条：采用全宽顶部吸附式横条，单行文本排版，左侧放置站点标题，右侧水平排列主栏目（主页、展柜、工具箱），下衬 1px 细线作为全局边界。
- 主体容器：内容区域居中约束，两翼留有大面积对称边距（实测样本包含 144px 间距），保障宽屏桌面下的舒适阅读行宽。
- 内容网格：在展示区（"这里都有什么？"）采用对称双列网格，两列卡片横向对齐，实测间隙约为 10px。
- 版块分割：版块切换使用具象的文本式横向隔离线（+dwb====================dwb+），取代常规的渐变或透明留白。
- 响应式说明与建议：当前仅在 1440px 桌面视口完成了实测；当视口缩窄至移动端时，建议将双列卡片平滑降级为单列垂直堆叠，并确保 ASCII 字符画容器开启水平滚动或固定字符宽度，防止字符错位换行。

## Elevation & Depth
页面整体呈现彻底的零阴影平面风格（flat design），完全规避了拟物浮雕或现代弥散阴影。

- 阴影实测：采样数据中 shadow 级别为 none，所有卡片、按钮和导航栏的 box-shadow 属性均为 0 或无声明。
- 伪深度构建方式：界面的空间感和层级划分完全通过 ASCII 文本符号构造的窗体来建立。例如通过包含 _Ark.exe_ 标题与 _-_=_X_| 字符控制按钮的外框，让读者潜意识感知到一个层叠的终端视窗。
- 分层边界：仅使用 1px 细实线或虚线边框明确边界，层次清晰而不产生视觉噪音。

## Shapes
形态系统贯彻工业化、机械式的硬朗直角特征。

- 圆角规格：实测各组件 rounded 均为 0px。无论是卡片外框、按钮还是输入元素，一律禁止圆角过渡。
- 几何轮廓：元素外框仅由平直线条（水平线、垂直线）及 ASCII 符号构成，拒绝胶囊型、椭圆或异形几何图形。
- 图标与图形处理：全站不使用任何彩色图标或复杂位图插画，所有的图形表达均由纯字符构成（如 > 箭头、| 竖线、- 减号、= 等号）。
- 装饰性遮罩：采用直角黑块对文字进行定点遮蔽，形成如同机密文件涂改的视觉效果。

## Components
原站包含的组件类型少而精，完全围绕字符终端交互构建。

### Available foundations
原站没有使用任何第三方大型组件库，所有样式基于原生 HTML 元素配合基础 CSS 属性实现。复用时无需引入特定外部 UI 框架，可在宿主项目的任意现代前端框架（React/Vue/原生）中结合 JetBrains Mono 字体进行轻量复现。

### 顶部导航条（Navbar）
- 用途：全站全局顶层指引与品牌标识。
- 构成：左侧为站点品牌文本，右侧为栏目导航链接（"主页"、"展柜"、"工具箱"），底部为 1px 细实线。
- 样式规则：无独立背景色，文字为 rgb(31, 31, 31)，无圆角，点击态与悬浮态保持纯文本反馈。

### 终端视窗卡片（ASCII Window Card）
- 用途：承载独立的主题内容、作品展示或世界观章节。
- 构成：顶部带模拟文件名的标题栏（如 |_Ark.exe..._-_=_X_|）、内部嵌套的 ASCII 艺术标题（如 ARK 字符画）、二级主标题（# 扁舟）、说明正文以及底部行动引导链接。
- 样式规则：背景为纯色画布，外边框由 ASCII 字符或 1px 纯黑实线封闭，字符排版保持 pre 格式保证对齐。

### 命令行行动按钮（Terminal Link / CTA）
- 用途：驱动读者点击跳转到详情页面。
- 构成：由字符前缀、文本及字符后缀组成，如 > 了解更多 <。
- 实测特征：样本显示 backgroundColor 为 rgba(0, 0, 0, 0)，padding 为 0px，rounded 为 0px，textColor 为 rgb(31, 31, 31)。完全以纯文字与箭头符号建立可点击暗示。

### 文本分割线（ASCII Divider）
- 用途：划分不同主题段落。
- 构成：两端带锚定标识的等号字符串（如 +dwb===...===dwb+），横贯容器宽度。

### Signature elements
1. ASCII 字符视窗框架：通过字符边界 |_..._-_=_X_| 模拟 90 年代图形操作系统的运行窗口，这是整站最核心的视觉签名。若在纯文本或终端受限环境中使用，可转换为 Markdown 等宽引用块呈现。
2. 命令行日志格式标签：行首嵌入如 [INFO][CyberKanjousen]、[WARN]、[ERROR] 的状态前缀，瞬间强化极客调试日志的临场感。

## Do's and Don'ts
针对本站风格的复用与扩展，请严格遵循以下执行准则：

- Do: 全站强制应用 JetBrains Mono 等宽字体栈，保持英文与符号严格对齐。验收条件：所有文本元素的计算样式 fontFamily 必须包含 JetBrains Mono，字符宽度一致。
- Don't: 切勿添加任何 modern 风格的弥散阴影（box-shadow）或彩色发光效果。验收条件：检查整站 CSS，所有容器与元素的 box-shadow 计算值恒等于 none。
- Do: 统一保持所有元素为 0px 绝对直角。验收条件：任何卡片、按钮、输入框的 border-radius 必须精确为 0px。
- Don't: 切勿引入外部彩色彩色图标库（如 FontAwesome、Material Icons）。验收条件：所有辅助引导与操作提示仅使用键盘原生字符（如 >、<、#、|、+、-）。
- Do: 维持纯粹的黑白高对比度单色体系（背景 #fefefe，前景色 #1f1f1f）。验收条件：前景与背景文本的颜色对比度实测达到 14:1 以上，确保极高可读性。
- Don't: 切勿让 ASCII 字符画与文本框架在视口缩小时随意折行断开。验收条件：所有包含 ASCII 艺术的容器必须设置 white-space: pre 并适配横向溢出滚动，防止排版崩塌。

### Verification
在实际工程落地本规范时，应按以下清单逐项验证（本规范仅代表实测样式的复用指引，不代表原站已自动通过所有测试）：
1. 样式继承核查：确认色彩精确使用了 rgb(31, 31, 31) 与 rgb(254, 254, 254)，未混入其他中间过渡灰色。
2. 字阶比例核查：检查各级标题字号是否严格按 15.12px 的整数倍（2.0x 与 3.0x）设定。
3. 键盘无障碍焦点：为字符链接（> 了解更多 <）保留清晰可见的 1px 直角实线焦点环（focus-ring），确保键盘无障碍导航可用。
4. 移动端边界测试：在 375px 小屏模式下测试卡片是否折叠为单列，确认字符艺术未导致整体页面横向撑破。

Agent 指令说明：
后续执行开发任务的 Agent 在实现基于本风格的新界面时，请首先读取本设计规范，严格遵守 0px 圆角、无阴影、等宽排版与黑白单色调的核心法则。新页面的业务逻辑和内容请围绕目标用户的任务组织，复用宿主项目现有的组件原语，并将任何未经验证的响应式假设明确向用户报告。

### Implementation checks
- Preserve the observed font families and palette, including common fonts or gradients when they belong to the source. Do not substitute a new aesthetic.
- Preserve supplied facts and units. Give each section a reader task; adapt composition without losing the documented style relationships.
- Verify keyboard focus, text contrast, meaningful source order and narrow-screen reflow. Treat these as implementation requirements, not claims that the source was tested.
- Load only needed assets, preserve their aspect ratios, and respect reduced-motion preferences when adding observed motion.
- For repeat work, save the content, model, viewport and first render. Compare with/without this file under matching conditions; turn recurring corrections into scoped prose rules, shared CSS or deterministic checks.

### Token evidence
- colors.primary: {"selector": "p.ellipsis", "role": "sampled foreground; not necessarily brand accent"}
- colors.surface: {"selector": "body", "role": "body background; may be transparent"}
- typography.h1: {"selector": "h1", "role": "sampled h1"}
- typography.h2: {"selector": "h2", "role": "sampled h2"}
- typography.h3: {"selector": "h3.window.window-1", "role": "sampled h3"}
- typography.body: {"selector": "p.ellipsis", "role": "sampled p"}
- components.sample-button: {"selector": "a.navbar-button-2-manu", "role": "observed default state; variants unverified"}
- components.sample-link: {"selector": "a", "role": "observed default state; variants unverified"}

## Evidence Appendix

Sampling summary only. Heuristic roles and flattened color summaries below are not normative tokens; retain the exact values and alpha in the frontmatter. This snapshot does not establish unobserved states, themes or viewport behavior.

### 工程 CSS 证据

由实时 DOM computed styles 压缩生成。这里只保留高频 token 与设计意图，不输出原始 CSS 清单。

#### 压缩设计 Token

**Mode:** mixed

##### 色彩角色
- **color.text.primary:** #1f1f1f (168)
- **color.text.secondary:** #1f1f1f (7)
- **color.surface.base:** #1f1f1f (1)
- **color.accent:** #1f1f1f (19)
- **color.border.default:** #1f1f1f (168)
- **color.focus.ring:** #1f1f1f (168)

##### 字体角色
- **font.family.primary:** JetBrains Mono (173)
- **font.size.display:** 45.35px (6)
- **font.size.body:** 15.12px (7)
- **font.size.label:** 15.12px (167)
- **ratio:** display is 3.0x body

##### 间距节奏
- **base unit:** 5px
- **space.1:** 10px (66)
- **space.2:** 144px (2)

##### 圆角角色
- 证据不足

##### 阴影意图
- **level:** none
- **usage:** 0
- **note:** flat surfaces dominate

##### 动效意图
- **level:** none
- **range:** Not enough evidence
- **common durations:** 证据不足
- **easing style:** Not enough evidence

#### 差异化实现信号

- Flat surfaces are preferred over decorative depth.
- Type hierarchy is ratio-driven: display is 3.0x body.

#### 采集诊断

- 从 244 个 DOM 元素中采样了 173 个可见元素。
- 置信度: high.
- No extraction warnings.