# Webnovel Writer 技术分析报告 Spec

## Why
用户需要对 `https://github.com/lingfengQAQ/webnovel-writer/tree/master` 进行全面技术分析，重点判断连贯性检查、AI 审稿系统与后续实施规范是否足以支撑长篇网文连续创作。该分析报告必须能够解释截图中“连贯性检查 270 个问题”的问题类型，并给出可执行、低风险、符合 AGENTS.md 第 9 节的优化路线。

## What Changes
- 产出一份面向决策与实施的技术分析报告，覆盖问题诊断、技术定义、评估指标、优化方案、实施步骤和预期效果。
- 对连贯性检查功能进行结构化分析，包括 270 个问题的分类口径、节点章节间连贯性问题、性能表现、严重程度分级与量化方法。
- 对 AI 审稿系统进行系统性评估，围绕 webnovel 六维审查框架与防幻觉三定律识别不足并提出改进方案。
- 建立实施策略与技术规范，明确最小化修改原则、分支开发流程、测试/打包/合并规范，并显式纳入 AGENTS.md “9.添加功能”的要求。
- 不直接修改目标项目代码，不删除文件，不执行会改变远程仓库状态的操作。

## Impact
- Affected specs: 技术分析报告、质量评估体系、连贯性检查设计、AI 审稿设计、开发流程规范。
- Affected code: 本阶段不修改代码；分析时重点阅读目标仓库的 `README.md`、`docs/`、`webnovel-writer/agents/`、`webnovel-writer/scripts/`、`webnovel-writer/dashboard/`、`webnovel-writer/templates/`、`webnovel-writer/skills/` 等与写作链、审稿链、Story System、Dashboard、RAG、preflight 相关的文件。

## ADDED Requirements

### Requirement: 连贯性检查诊断
技术分析报告 SHALL 对当前连贯性检查结果建立分类统计口径，并解释截图中 270 个问题的构成。

#### Scenario: 270 个问题分类
- **WHEN** 报告分析截图中的连贯性检查结果
- **THEN** 报告 SHALL 区分至少三类问题：真实故事矛盾、结构性图谱/链接问题、元数据或文档组织问题
- **AND** 报告 SHALL 单独指出截图中可见的 1 个 `contradiction` 警告与 269 个提示类问题不应混为同等严重程度

#### Scenario: 节点章节连贯性分析
- **WHEN** 报告分析章节节点间连贯性
- **THEN** 报告 SHALL 关注章节顺序、时间线推进、角色状态迁移、地点/道具/组织关系、伏笔回收、因果链闭合与大纲偏离
- **AND** 报告 SHALL 区分章节内容矛盾与 `[[wikilink]]` 孤立页面、无出站链接等图谱连通性问题

### Requirement: 故事连贯性的技术定义
技术分析报告 SHALL 给出故事连贯性的工程化定义与可验证标准。

#### Scenario: 定义连贯性维度
- **WHEN** 报告定义故事连贯性
- **THEN** 报告 SHALL 覆盖大纲遵循度、细纲执行情况、章节间逻辑一致性、角色状态一致性、时间线一致性、设定事实一致性、伏笔债务一致性、叙事节奏连续性

#### Scenario: 量化指标
- **WHEN** 报告提出评估指标
- **THEN** 报告 SHALL 给出可计算或可人工复核的指标、分值区间、权重建议与阈值建议
- **AND** 报告 SHALL 提供问题严重程度分级机制，包括阻断级、高风险、中风险、低风险/提示

### Requirement: AI 审稿系统评估
技术分析报告 SHALL 基于 webnovel 六维审查框架和防幻觉三定律评估现有 AI 审稿功能。

#### Scenario: 六维审查框架
- **WHEN** 报告评估 AI 审稿
- **THEN** 报告 SHALL 覆盖剧情推进、人物塑造、世界观设定、节奏追读力、文风可读性、商业化/类型适配六个维度

#### Scenario: 防幻觉三定律
- **WHEN** 报告提出审稿优化
- **THEN** 报告 SHALL 要求所有审稿结论绑定证据来源、限定可推断范围、缺证时输出不确定性而不是补编事实
- **AND** 报告 SHALL 提出事实准确性、逻辑一致性、内容质量把控方面的具体算法或规则改进建议

### Requirement: 实施策略与技术规范
技术分析报告 SHALL 将优化建议拆成可安全实施的技术路线，并遵守本工作区 AGENTS.md 第 9 节。

#### Scenario: 最小化修改原则
- **WHEN** 报告提出任何后续代码变更建议
- **THEN** 报告 SHALL 明确建议优先新增隔离模块、测试和配置项，避免重构无关代码、删除已有函数或扩大作用域
- **AND** 报告 SHALL 标注每类建议的改动范围、风险级别、回归验证方式

#### Scenario: 分支开发流程
- **WHEN** 报告描述实施流程
- **THEN** 报告 SHALL 包含先固定可工作版本、在 feature 分支开发、先跑源码、跑旧功能测试、确认后再打包、打包后再合并回 main 的流程
- **AND** 报告 SHALL 明确 main 分支稳定可打包、feature 分支每次只做一个功能

### Requirement: 报告可执行性
技术分析报告 SHALL 既能支持管理判断，也能直接转化为后续开发任务。

#### Scenario: 报告结构完整
- **WHEN** 报告完成
- **THEN** 报告 SHALL 至少包含执行摘要、现状与架构理解、问题诊断、指标体系、优化方案、实施步骤、验证清单、风险与预期效果

#### Scenario: 证据与假设透明
- **WHEN** 报告引用目标仓库现状
- **THEN** 报告 SHALL 区分已从仓库/截图确认的信息与基于有限上下文作出的分析假设
- **AND** 报告 SHALL 避免声称已经完成未实际执行的性能测试或代码修改

## MODIFIED Requirements
无。

## REMOVED Requirements
无。
