# Tasks
- [x] Task 1: 收集目标仓库与本地规范证据：阅读目标仓库 README、关键 docs、agents、scripts、dashboard、templates、skills 目录信息，并记录与连贯性检查、审稿、Story System、RAG、preflight、Dashboard 相关的证据。
  - [x] SubTask 1.1: 确认目标仓库结构、语言栈和主链路。
  - [x] SubTask 1.2: 检索并阅读连贯性、审稿、review、lint、preflight、story system 相关文件。
  - [x] SubTask 1.3: 阅读本地 AGENTS.md 第 9 节并提取必须遵守的实施约束。
- [x] Task 2: 完成连贯性检查功能分析：建立 270 个问题的分类统计口径，分析节点章节间连贯性问题，并定义故事连贯性的技术标准、指标和严重程度分级。
  - [x] SubTask 2.1: 区分真实故事矛盾、图谱链接问题、文档组织问题与提示类问题。
  - [x] SubTask 2.2: 定义大纲遵循度、细纲执行、章节逻辑、角色状态、时间线、设定事实、伏笔债务等评估指标。
  - [x] SubTask 2.3: 给出分值、阈值、权重建议与问题严重程度分级。
- [x] Task 3: 完成 AI 审稿系统优化分析：基于 webnovel 六维审查框架和防幻觉三定律评估当前审稿能力，并提出算法改进与规则优化方案。
  - [x] SubTask 3.1: 用六维框架评估剧情、人物、世界观、节奏、文风、商业化/类型适配。
  - [x] SubTask 3.2: 用防幻觉三定律检查证据绑定、推断边界和不确定性表达。
  - [x] SubTask 3.3: 输出内容质量、逻辑一致性、事实准确性三方面的改进建议。
- [x] Task 4: 制定实施策略与技术规范：把优化建议拆解为最小化修改路线、分支开发流程、测试/打包/合并规范，并显式映射 AGENTS.md 第 9 节要求。
  - [x] SubTask 4.1: 明确修改前应准备的文件清单、feature 分支策略和 main 稳定原则。
  - [x] SubTask 4.2: 定义源码运行、旧功能测试、专项测试、打包验证和合并检查流程。
  - [x] SubTask 4.3: 给出风险控制、回滚边界和不影响现有功能的验收标准。
- [x] Task 5: 汇总并交付详细分析报告：形成问题诊断、技术方案、实施步骤、预期效果的完整中文报告。
  - [x] SubTask 5.1: 区分证据、判断和假设，避免未验证结论。
  - [x] SubTask 5.2: 给出可执行优先级路线图。
  - [x] SubTask 5.3: 对照 checklist.md 完成自检。

# Task Dependencies
- Task 2 depends on Task 1.
- Task 3 depends on Task 1.
- Task 4 depends on Task 1, Task 2 and Task 3.
- Task 5 depends on Task 2, Task 3 and Task 4.
