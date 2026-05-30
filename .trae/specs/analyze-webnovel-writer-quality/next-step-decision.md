# Webnovel Writer 质量分析后续处理判断

生成时间：2026-05-26

## 1. 本轮结论

现有 `.trae/specs/analyze-webnovel-writer-quality/analysis-report.md` 可以作为方向性草稿保留，但不建议直接把它当成后续代码实施依据。原因是：它已经覆盖了“270 个问题分级”“AI 审稿证据绑定”“AGENTS.md 第 9 节流程”等关键主题，但对目标仓库的代码证据引用不足，尤其没有把现有 reviewer schema、chapter commit gate、prewrite gate、dashboard 展示能力逐条对应起来。

下一步推荐先做“证据化分析报告修订 + 实施计划”，暂时不要直接改功能代码。这样最符合本工作区“先思考，再写代码”“简单优先”“外科手术式修改”和“新增功能必须防止旧功能回退”的要求。

## 2. 已确认依据

- 目标仓库远端 `master` 与本地分析副本一致，当前提交为 `ebb49d7713f10513654cb9e6fabbc1207e535d17`，提交时间为 2026-05-09 17:47:34 +0800。
- 本地规格文件明确要求本阶段不直接修改目标项目代码、不删除文件、不改变远程仓库状态。
- 本地规格文件要求报告覆盖：连贯性检查、AI 审稿系统、实施策略、技术规范、风险与预期效果。
- 本工作区 `AGENTS.md` 第 9 节要求：新增功能必须先固定可工作版本、在 feature 分支开发、改完先跑源码和旧功能测试、确认后再打包 exe、打包成功后再合并回 main。

## 3. 目标仓库现状判断

### 3.1 连贯性与审稿能力已经有基础

目标仓库的 `reviewer` 已经支持结构化 issue 输出，包含：

- `severity`: `critical | high | medium | low`
- `category`: `continuity | setting | character | timeline | ai_flavor | logic | pacing | other`
- `evidence`
- `fix_hint`
- `blocking`

`review_schema.py` 也已经把 issue 转换为 `severity_counts`、`dimension_scores`、`overall_score` 等 dashboard 兼容指标。这里的优点是：系统已经不是纯文本点评，而是具备“问题清单 + 严重度 + 阻断”的基础。

不足是：`evidence` 在 schema 层不是强必填校验，缺证时仍可能以空字符串进入后续报告；同时当前分类仍偏工程检查分类，没有完全覆盖用户提示词要求的 webnovel 六维框架：剧情推进、人物塑造、世界观设定、节奏追读力、文风可读性、商业化/类型适配。

### 3.2 主链 gate 已经存在，但需要把质量维度前移并细化

`chapter_commit_service.py` 的提交判断已经具备硬门槛：

- `review.blocking_count > 0` 会拒绝提交。
- `fulfillment.missed_nodes` 非空会拒绝提交。
- `disambiguation.pending` 非空会拒绝提交。

这说明目标仓库已经有“审查阻断 + 大纲履约 + 消歧阻断”的主链基础。后续优化不应该推倒重写，而应该沿用这个 gate，在最小范围内增强：

- 对连贯性问题增加更细的子类型和严重度映射。
- 对大纲履约增加更明确的“计划节点 vs 已覆盖节点”展示。
- 对证据绑定增加 schema 级约束或 report 级缺证警告。

### 3.3 写前预检已经能拦截部分风险

`prewrite_validator.py` 已经会阻断：

- 高优先级 `disambiguation_pending`
- 缺少 Story System 合同
- 当前章节相关设定存在未补齐占位

它也会输出 `fulfillment_seed`，包含 `planned_nodes` 与 `prohibitions`。这为“大纲遵循度”和“细纲执行情况”提供了可复用入口。后续不需要新增一套独立大纲系统，应该复用现有 `review_contract`、`chapter_brief`、`fulfillment_result` 和 `CHAPTER_COMMIT`。

### 3.4 Dashboard 只有趋势展示，还缺少风险分流

Dashboard 当前能展示：

- `review_metrics`
- `severity_counts`
- `review_score`
- `Story Runtime`
- `Latest Commit`
- 合同树状态

但没有看到专门面向“270 个问题”的分流展示，也没有把“真实故事矛盾”和“图谱/链接/元数据提示”拆开展示。若用户面对 270 个问题，当前 UI 容易造成信息过载。

## 4. 对“270 个问题”的判断

当前本地资料只确认规格里写到：截图中可见 1 个 `contradiction` 警告与 269 个提示类问题。没有看到原始截图文件或原始 JSON 输出，因此不能把 270 个问题的真实分布当成已验证事实。

在缺少原始输出的情况下，合理处理方式是：

| 类型 | 判断 | 处理优先级 |
| --- | --- | --- |
| `contradiction` | 更可能是真实故事矛盾或高风险逻辑问题 | P0 |
| `timeline / character_state / setting_fact / plot_causality` | 可能影响章节间连贯性 | P0/P1 |
| `graph_link / orphan / no_outlink / wikilink` | 更可能是知识图谱或文档组织提示 | P2 |
| `metadata_hint` | 摘要、标签、字段完整性提示 | P2/P3 |

后续真正实施前，必须拿到原始检查输出，至少包含 `type/category/severity/source/location/message/evidence`。如果没有这些字段，就先做一个兼容解析层，把现有输出规范化后再进入 UI 或报告。

## 5. 推荐处理路径

### 方案 A：只完成证据化分析报告

改动范围：只修改 `.trae/specs/analyze-webnovel-writer-quality/analysis-report.md` 或新增一份正式报告。

优点：风险最低，能快速把“上一个 AI 没完成”的工作收口。

缺点：还不能直接改善产品功能。

适用场景：用户只想先确认方向，暂不进入代码开发。

### 方案 B：先写实施计划，再进入单 feature 分支

改动范围：先新增计划文档，再按单一功能创建 feature 分支。

推荐拆分为两个 P0 feature：

1. 连贯性问题分级与展示
2. AI 审稿证据绑定强化

优点：符合 AGENTS.md 第 9 节，能防止一次性改太多导致旧功能回退。

缺点：比方案 A 多一步计划和验证成本。

适用场景：用户准备让这个分析进入真实代码改造。

### 方案 C：直接开始改代码

不推荐。原因是当前还缺少原始 270 问题输出，且目标仓库本身已有 reviewer、commit gate、prewrite gate、dashboard 多条链路。直接改代码很容易把多个方向混在一起，违反“每个 feature 分支只做一个功能”的要求。

## 6. 我的推荐

推荐走方案 B，但第一步先完成“正式证据化分析报告”。顺序如下：

1. 固定当前可工作版本  
   验证方式：记录当前分支、提交、已有测试入口和可运行命令。

2. 修订或新增正式分析报告  
   验证方式：报告逐条覆盖规格文件要求，并明确区分“已从仓库确认”和“基于截图描述的假设”。

3. 生成实施计划  
   验证方式：每个任务只对应一个功能，明确准备修改的文件、测试方式和回归清单。

4. 创建 feature 分支做 P0-1：连贯性问题分级  
   验证方式：新增测试样例覆盖 `contradiction`、图谱提示、元数据提示，不影响现有 reviewer 输出兼容字段。

5. 创建 feature 分支做 P0-2：审稿证据绑定强化  
   验证方式：缺少 evidence 的 issue 被标记为需要复核或阻断，不再静默进入“已确认问题”。

6. 源码验证、旧功能回归、专项测试通过后，再考虑打包 exe  
   验证方式：源码可运行，旧写作链/审稿链/Story System/Dashboard 不回退，专项功能通过，再进入打包。

## 7. 后续实施的最小文件范围建议

如果进入代码阶段，优先只考虑这些文件或同类位置：

| 目标 | 优先修改位置 | 原因 |
| --- | --- | --- |
| 连贯性问题分级 | `webnovel-writer/scripts/data_modules/review_schema.py` 或新增相邻分类模块 | 复用现有 issue schema 和 metrics |
| 报告分组展示 | `webnovel-writer/scripts/review_pipeline.py` | 现有报告已经分阻断/其他问题 |
| Dashboard 风险聚合 | `webnovel-writer/dashboard/frontend/src/pages/OverviewPage.jsx` 或新增局部组件 | 现有页面已经展示 review trend |
| 审稿提示词强化 | `webnovel-writer/agents/reviewer.md` | 当前 evidence 只是提示要求，需补强缺证处理 |
| 大纲履约校验 | `webnovel-writer/scripts/data_modules/chapter_commit_service.py` 附近或新增验证模块 | 已经用 `missed_nodes` 作为 rejected 条件 |
| 测试样例 | `webnovel-writer/scripts/data_modules/tests/` | 已有 pytest 测试体系 |

不建议第一轮改动：

- 不重构 Story System 主链。
- 不删除已有函数。
- 不改变 `review_metrics` 表结构，除非有迁移和兼容层。
- 不把图谱提示直接升级为剧情阻断。
- 不一次性同时改 reviewer、dashboard、commit gate、RAG 和写作流程。

## 8. 验证清单

正式进入代码阶段前，至少需要以下验证项：

- `git status --short --branch`：确认当前分支和未跟踪文件。
- 目标仓库测试入口确认：优先查看 `pytest.ini`、`requirements.txt`、`scripts/run_tests.ps1`。
- 源码级测试：运行目标项目现有 Python 测试。
- 旧功能回归：`webnovel-write`、`webnovel-review`、`preflight`、`chapter-commit`、Dashboard 只读接口。
- 专项测试：构造 1 个真实矛盾、1 个图谱提示、1 个元数据提示、1 个缺 evidence issue。
- 打包前检查：源码和旧功能测试通过前不打包 exe。

## 9. 当前风险

- 原始 270 问题输出未落在本地资料中，不能断言真实类别分布。
- 现有 `.trae` 的 `tasks.md` 和 `checklist.md` 已标记完成，但这可能只是前一轮 AI 的自检结果，不等于已经通过真实代码证据复核。
- 目标仓库是外部项目，本工作区当前只是分析副本；若后续要改目标项目，需要明确是在本地副本中改、fork 后改，还是把思路移植到 QMAI。
- 当前 QMAI 工作区有较多未跟踪文件，后续如要进入 Git 提交阶段，必须先确认哪些是用户已有资产，避免误加或误删。

## 10. 下一步建议

先把 `analysis-report.md` 升级成“证据化正式报告”，补齐以下内容：

1. 目标仓库 commit 与证据文件清单。
2. 当前 reviewer、review_schema、review_pipeline、chapter_commit、prewrite_validator、dashboard 的能力边界。
3. 270 问题分类只作为截图描述下的分析假设，等待原始输出确认。
4. P0/P1/P2 路线图和每一步的文件范围、测试方式。
5. 明确下一阶段如果进入代码，必须创建单 feature 分支并先固定可工作版本。

完成正式报告后，再由用户决定是否进入实施计划和分支开发。
