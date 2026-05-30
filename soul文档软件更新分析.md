# 分析 soul.md 人格实现

> 分析一下hermes agent当中的soul.md人格是如何实现的？对于我们的软件当前有这个能力实现吗？实现起来复杂吗？

<details><summary>2 previous messages</summary>

> 我先在仓库里确认 `hermes agent` 和 `soul.md` 相关实现落点，再对照我们当前代码判断是不是已经具备这套能力，以及真正缺的是什么。
> 
> 仓库里没有直接叫 `hermes agent` 或 `soul.md` 的文件，我继续沿着“人格/提示词/技能模板/运行时注入”这条线排查，重点看 `NvwaSKILL`、聊天 store、提示词生成和设置页。

</details>

我已经看到一条很关键的线索：当前软件里真正接近 “soul.md 人格” 的不是单一文件，而是 `NvwaSKILL` 里的 `*-perspective/SKILL.md` 加上聊天侧的提示词拼装和“character aura”能力。我继续把运行链路补全到具体代码位置。

> 分析一下hermes agent当中的soul.md人格是如何实现的？当前仓库没有hermes agent仓库文件，通过[NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)去分析这个项目，对于我们的软件当前有这个能力实现吗？实现起来复杂吗？必须要先分析，然后再给出结果

<details><summary>21 previous messages</summary>

> 这次我先分两条线并行做完再下结论：一条看 `NousResearch/hermes-agent` 里 `soul.md` 真正是怎么被加载、拼进 prompt、绑定到 agent 运行时的；另一条对照我们当前仓库里已有的“角色灵魂 / SKILL / 上下文注入”链路，判断是不是已经具备同类能力，以及缺口在哪。
> 
> 我已经确认当前仓库里“人格”这件事不是空白能力，而是已经有半套到大半套：有结构化灵魂数据、有 `SKILL.md` 文件、有绑定关系、有上下文包拼装，接下来我把它和 Hermes 的 `soul.md` 对齐到“同构点”和“缺失点”。
> 
> <details><summary>Searched web 7 times</summary>
> 
> <details><summary>Searched web 7 times</summary>
> 
> - Searched web for `NousResearch hermes-agent soul.md site:github.com/NousResearch/hermes-agent ...`
> - Searched web for `site:github.com/NousResearch/hermes-agent SOUL.md HERMES_HOME "prompt-injection" ...`
> - Searched web for `site:github.com/NousResearch/hermes-agent "prompt_builder.py" "SOUL.md" "blob/main" ...`
> - Searched web for `https://github.com/NousResearch/hermes-agent/blob/main/agent/prompt_builder.py`
> - Searched web for `'def load_soul_md' in https://github.com/NousResearch/hermes-agent/blob/main/agent/prompt_builder.py`
> - Searched web for `https://docs.github.com/site-policy/privacy-policies/github-privacy-statement`
> - Searched web for `https://raw.githubusercontent.com/NousResearch/hermes-agent/main/agent/prompt_builder.py`
> 
> </details>
> 
> </details>
> 
> 文档已经把设计意图讲清楚了，但为了避免只看文档不看实现，我现在把 `NousResearch/hermes-agent` 拉到临时目录，直接读源码里的 `prompt_builder.py` 和会话构建链路。
> 
> 临时克隆超时了，但很可能已经部分完成；我先检查本地临时目录，如果在，就直接本地读源码，不再浪费时间重新拉。
> 
> 本地临时仓已经有 `.git`，说明网络没问题，只是 checkout 阶段卡住了。我补一步最小化 checkout，只取我们要看的文件，避免继续拉全仓库。
> 
> 我已经拿到我们这边的关键落点了：`角色灵魂` 会进入 `ContextPack`，再进入最终 `system` prompt。现在补 Hermes 那边的源码落点，主要要确认它是不是“文件直注入 system prompt”、有没有做上下文隔离、有没有安全防护。
> 
> Git 元数据在，但工作树没落下来。我直接抓 `origin/main` 的单分支浅层对象，再 checkout 到 `FETCH_HEAD`，只拿源码和文档。
> 
> 临时仓里留下了一个 `shallow.lock`。我先确认没有 git 进程在跑，再清掉这个锁文件继续，只影响临时目录，不会碰你项目。
> 
> 我先确认这些 git 进程是不是刚才那个临时 clone 卡住的进程。如果是，我只结束这几个临时进程，然后继续从该临时仓读取源码。
> 
> <details><summary>Searched web 6 times</summary>
> 
> <details><summary>Searched web 6 times</summary>
> 
> - Searched web for `site:docs.nousresearch.com/hermes-agent soul.md hermes agent ...`
> - Searched web for `"NousResearch/hermes-agent" soul.md ...`
> - Searched web for `https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/personality.md`
> - Searched web for `site:github.com/NousResearch/hermes-agent/blob/main/agent prompt_builder.py DEFAULT_AGENT_IDENTITY SOUL.md ...`
> - Searched web for `https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/prompt-assembly.md`
> - Searched web for `https://github.com/NousResearch/hermes-agent/blob/main/agent/prompt_builder.py`
> 
> </details>
> 
> </details>
> 
> 直接拉原始文件更稳，不再依赖 GitHub 页面或整仓 clone。我只下载 `prompt_builder.py` 和 `run_agent.py` 两个实现文件到临时目录做本地检索。
> 
> 关键实现已经定位到 raw 源文件了。现在我只读 Hermes 的这几段：`load_soul_md`、`build_context_files_prompt`、`_scan_context_content`，以及系统提示词组装入口，避免泛泛而谈。
> 
> `system_prompt.py` 我刚才路径下错了，补正到 `agent/system_prompt.py`。然后只看 Hermes 真正组装 prompt 的函数，不去读无关模块。
> 
> <details><summary>Searched web 1 time</summary>
> 
> <details><summary>Searched web 1 time</summary>
> 
> - Searched web for `site:github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/personality.md hermes soul personality ...`
> 
> </details>
> 
> </details>
> 
> 我再补一件事：确认我们当前仓库有没有“全局人格入口”。因为这决定答案是“已经能做”还是“底层能力够，但产品形态还没补齐”。
> 
> 实现链路已经够了，我再补一页官方文档，确认 Hermes 对 `SOUL.md` 的产品语义和用户入口，免得只从源码反推。
> 
> 文档文件名这边有点怪，我换成明确的本地文件名重新保存一次，只为读内容，不影响结论。
> 
> 文件是存在的，PowerShell 这里对变量拼出来的路径有点反常。我直接用绝对路径读取，不再绕变量。
> 
> 我把 Hermes 和我们仓库的关键行号再钉一下，最后结论会直接对应这些实现点，不会空口判断。
> 
> 我还补了一条风险检查：Hermes 会先扫 `SOUL.md` / `AGENTS.md` 再注入；我正在确认我们这边的人格文档有没有类似的安全扫描，避免高估现成能力。

</details>

**分析结果**

Hermes 的 `SOUL.md` 不是“普通提示词文件”，而是它的“主身份槽位”。

1. 在 Hermes 里，`SOUL.md` 只从 `HERMES_HOME` 读取，不从当前项目目录读取。官方文档把它定义成 “slot #1 in the system prompt”，也就是系统提示词的第一段、主身份本体，而不是附加说明。[personality.md](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/personality.md) [prompt-assembly.md](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/prompt-assembly.md)

2. 真正的实现链路在 `agent/prompt_builder.py` 和 `agent/system_prompt.py`：
   
   - `load_soul_md()` 负责读取 `SOUL.md`
   - 读取后先过 `_scan_context_content()` 做注入扫描
   - 再过 `_truncate_content()` 做长度裁剪
   - 然后在 `build_system_prompt_parts()` 里优先塞进 `stable_parts` 的第一位；如果没有 `SOUL.md`，才退回 `DEFAULT_AGENT_IDENTITY`
   - 同时 `build_context_files_prompt(skip_soul=True)` 避免它被重复注入一次
     这说明 Hermes 把人格做成了“系统 Prompt 构建器的一等公民”，不是聊天时临时拼一段文本。[prompt_builder.py](https://github.com/NousResearch/hermes-agent/blob/main/agent/prompt_builder.py) [system_prompt.py](https://github.com/NousResearch/hermes-agent/blob/main/agent/system_prompt.py)

3. Hermes 还把 prompt 分成 `stable / context / volatile` 三层。`SOUL.md` 属于稳定层，项目规则文件如 `AGENTS.md` 属于上下文层，memory/timestamp 属于易变层。这么做的目的很明确：一是身份稳定，二是更利于 prefix cache，三是不同来源职责清楚。[prompt-assembly.md](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/prompt-assembly.md)

4. 文档还说明 Hermes 有 `/personality` 这种“会话级 overlay”。这不是替代 `SOUL.md`，而是临时叠加在其上。也就是说 Hermes 的人格体系其实分两层：
   
   - 持久基线人格：`SOUL.md`
   - 临时模式切换：`/personality`
     这是比“单个 persona 文件”更完整的一套产品设计。[personality.md](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/personality.md)

**对照我们当前仓库**

你们现在“并不是没有这个能力”，而是“已经有一套局部版、小说场景版的人格系统”，只是它还不是 Hermes 那种“全局 agent identity”。

1. 当前仓库已经有“人格素材文件 + 持久化 + 运行时注入”三件套：
   
   - 会生成并保存 `SKILL.md` 到项目内人物灵魂目录，[character-aura.ts](</E:/QMAI/src/lib/novel/character-aura.ts:282>)、[character-aura.ts](</E:/QMAI/src/lib/novel/character-aura.ts:355>)
   - 会从 `SKILL.md` 和研究文件读取内容，并压缩摘要，[character-aura.ts](</E:/QMAI/src/lib/novel/character-aura.ts:436>)、[character-aura.ts](</E:/QMAI/src/lib/novel/character-aura.ts:471>)
   - 会按任务文本里出现的人物名匹配绑定关系，生成 `characterAuras` 上下文，[character-aura.ts](</E:/QMAI/src/lib/novel/character-aura.ts:482>)

2. 这些人格内容已经会进入最终 prompt：
   
   - `buildContextPack()` 会调用 `buildCharacterAuraContext()`，[context-engine.ts](</E:/QMAI/src/lib/novel/context-engine.ts:92>)
   - `characterAuras` 被纳入 `ContextPack` 的固定字段，[context-engine.ts](</E:/QMAI/src/lib/novel/context-engine.ts:796>)
   - `contextPackToPrompt()` 会把它拼进上下文包，[context-engine.ts](</E:/QMAI/src/lib/novel/context-engine.ts:807>)
   - 发送消息前，聊天面板会把这段内容拼进 `system` message，[chat-panel.tsx](</E:/QMAI/src/components/chat/chat-panel.tsx:432>)、[chat-panel.tsx](</E:/QMAI/src/components/chat/chat-panel.tsx:442>)、[chat-panel.tsx](</E:/QMAI/src/components/chat/chat-panel.tsx:449>)

3. 但它和 Hermes 的差异也很明显：
   
   - 只在 `novelMode` 下启用，不是全局 agent 能力，[context-engine.ts](</E:/QMAI/src/lib/novel/context-engine.ts:66>)
   - 只有“任务里命中某个人物名”才注入，不是每轮都带着一个基线人格
   - 当前更像“角色写作上下文增强”，不是“AI 本体身份”
   - 没看到类似 Hermes 的人格安全扫描；现在是直接读 `SKILL.md` 再压缩
   - 没有 Hermes 那种稳定层/上下文层/易变层的专门 prompt builder，当前是每次发送时在聊天面板里现拼

**结论**

可以实现，而且你们当前仓库已经具备 60% 到 75% 的基础能力。

如果你的目标只是“做一个 Hermes 风格的 `soul.md`，让软件拥有稳定人格”，复杂度不高，属于中低复杂度：

1. 新增一个全局 `soul.md` 或设置页人格文件
2. 在聊天发送前把它作为第一段 `system` identity 注入
3. 为空时回退默认身份
4. 加一个简单的长度裁剪和注入扫描

这个版本我判断是“很能做”，不是难题。

如果你的目标是“完整复刻 Hermes 的人格体系”，复杂度会明显上升，主要多在产品分层而不是模型能力：

1. 全局 `soul.md` 基线人格
2. 会话级人格 overlay
3. 项目级规则文件优先级加载
4. 稳定/上下文/易变三层 prompt 组装
5. 缓存失效策略
6. 安全扫描与截断策略

这就不是“加一个文件”了，而是要把 prompt 构建链路抽出来，复杂度中等偏上。

**我给你的直接判断**

- 是否完成分析：是
- 当前软件是否有这个能力：有基础，而且基础不弱，但现在是“角色灵魂上下文”，不是“全局 agent identity”
- 实现是否复杂：做最小版不复杂；做 Hermes 完整版中等偏上
- 测试验证：未运行测试，本次是源码与上游仓库实现分析
- 风险：Hermes 文档对 `skip_context_files` 的描述比源码更简化，源码里还有 `load_soul_identity` 这个例外开关
- 是否已 git 提交：没有，本次未改代码

**下一步建议**

最省事的路径不是照搬 Hermes 全套，而是先做一个“QMAI 最小版 SOUL”：

1. 先加全局 `soul.md` 入口
2. 把它放到 system prompt 第一段
3. 保留现有 `character aura` 作为小说场景下的第二层人格/角色灵魂增强

这样会比直接重做整套 prompt 构建器更稳，也更符合你们当前代码结构。

> soul.md 和angent.md有什么区别？

如果你指的是 `AGENTS.md`，两者核心区别可以一句话概括：

`SOUL.md` 定义“这个 AI 是谁”，`AGENTS.md` 定义“这个 AI 在这个项目里该怎么干活”。

更具体一点：

- `SOUL.md`：人格/身份层
  负责语气、风格、默认态度、沟通方式、是否直接、如何表达不确定性。
  在 Hermes 里，它是 system prompt 的第 1 段，也就是主身份槽位。[personality.md](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/personality.md) [prompt-assembly.md](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/prompt-assembly.md)

- `AGENTS.md`：项目规则层
  负责仓库约定、技术栈、命令、目录、测试方式、提交规范、开发流程。
  它不是“人格”，而是“这个仓库里的工作说明书”。[prompt-assembly.md](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/prompt-assembly.md)

再换个更直观的判断方法：

- “如果这条规则应该跟着我去所有项目”
  放 `SOUL.md`
- “如果这条规则只属于这个仓库/这个团队”
  放 `AGENTS.md`

Hermes 里的加载范围也不同：

- `SOUL.md` 只从 `HERMES_HOME/SOUL.md` 读取，是全局人格，不跟项目变。[personality.md](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/personality.md)
- `AGENTS.md` 是项目上下文文件，跟当前工作目录/仓库有关，不同项目可以不同。[prompt_builder.py](https://github.com/NousResearch/hermes-agent/blob/main/agent/prompt_builder.py)

对你们当前这个仓库来说：

- 现在仓库根里的 `AGENTS.md` 就是典型项目规则
- 你们的“角色灵魂 / SKILL.md”更接近“局部 persona 注入”，但还不是 Hermes 那种“全局 SOUL”

如果你愿意，我下一步可以直接给你一版：

1. 适合 QMAI 的 `SOUL.md` 示例
2. 哪些内容该从 `AGENTS.md` 挪到 `SOUL.md`
3. 哪些内容绝对不要放进 `SOUL.md`

> 那现在小说中的大纲以及地点人物小传等是不是现在就相当于anget.md？soul.md相当于小说写作的风格，比如说小说风格是幽默，或者其他？

不完全等价，但你的方向是对的。

更准确的映射应该是：

- 大纲、地点设定、人物小传、世界观、时间线
  更像“项目上下文 / 规则资料库”，也就是 `AGENTS.md` 那一类东西的扩展版。
  它们告诉 AI：这部小说的事实边界、设定边界、不能违背的规则是什么。

- `SOUL.md`
  更像“这个写作 AI 本人是什么气质、怎么表达、怎么取舍”。
  不是只写一句“要幽默”就够了，而是包括：
  
  - 叙述气质
  - 语言密度
  - 节奏快慢
  - 偏冷峻还是偏抒情
  - 遇到冲突时更克制还是更锋利
  - 默认审美和写作判断

所以如果只写“小说风格是幽默”，这更像“文风要求”，还没到完整 `SOUL.md`。
完整的 `SOUL.md` 更像：

- 这个作者型 AI 偏黑色幽默还是轻喜剧
- 更喜欢短句推进还是细腻铺陈
- 避免鸡汤、避免悬浮、避免过度解释
- 优先保人物真实感，不优先堆金句

结合你们当前仓库，其实已经有两层雏形了：

- `AGENTS.md` 对应层：小说上下文包
  现在的 [context-engine.ts](</E:/QMAI/src/lib/novel/context-engine.ts:75>) 已经会把 `outline`、`timeline`、`canonRules`、`characterStates`、`writingStyle` 等内容拼进上下文，这一层本质上就是“小说规则与资料”。

- `SOUL` 对应层：角色灵魂
  现在的 [character-aura.ts](</E:/QMAI/src/lib/novel/character-aura.ts:482>) 会把人物的“怎么说话 / 怎么想 / 怎么判断 / 什么不做”注入 prompt。这个已经非常接近“角色级 soul”，只是它是“角色人格”，不是“全局写作人格”。

所以最准确的说法是：

- 大纲 / 人物小传 / 地点设定 = 更像小说版 `AGENTS.md`
- 当前的 `character aura` = 更像角色版 `SOUL.md`
- 如果以后再加一个 Hermes 式 `SOUL.md`，那应该是“全局写作人格”，位于角色灵魂之上

一句话总结：

你现在仓库里已经有“小说规则层”和“角色人格层”，缺的主要不是能力本身，而是“全局作者人格层”。

本次是源码分析，没有改代码，也没有跑测试。

> 现在如果将soul.md作为小说项目级写作风格加入其中，这样小说整体的节奏密度叙述气质等能不能有影响？再当前软件中实现好实现吗？

<details><summary>2 previous messages</summary>

> 我先对照当前仓库的 prompt 链路看两件事：`写作风格` 现在是怎么进模型的，以及如果再加一个项目级 `SOUL.md`，它会落在最有影响的位置还是只是普通附加文本。
> 
> 我已经确认一件关键事实：项目级风格现在本来就在 prompt 里有入口，只是入口还比较弱。接下来我看 `readWritingStyle()` 具体读什么，才能判断“加 SOUL.md 是增强还是重构”。

</details>

**分析**

能，而且会有明显影响，但前提是它要放在“强位置”，不能只是埋在普通资料里。

当前仓库里，文风相关能力其实已经有一个弱版本：

- `readWritingStyle()` 会搜索项目里的“style / 风格 / 写作”内容，并读第一条结果的前 1000 字，[context-engine.ts](</E:/QMAI/src/lib/novel/context-engine.ts:470>)
- 这段内容会进入 `ContextPack` 的 `writingStyle` 字段，[context-engine.ts](</E:/QMAI/src/lib/novel/context-engine.ts:75>)
- 然后由 `contextPackToPrompt()` 拼进小说上下文包，[context-engine.ts](</E:/QMAI/src/lib/novel/context-engine.ts:807>)
- 最终整个上下文包会被塞进聊天时的 `system` prompt，[chat-panel.tsx](</E:/QMAI/src/components/chat/chat-panel.tsx:442>)、[chat-panel.tsx](</E:/QMAI/src/components/chat/chat-panel.tsx:449>)

所以从机制上说：

- 节奏
- 句长
- 叙述密度
- 情绪温度
- 幽默感
- 冷峻感
- 旁白气质

这些都可以被影响。

但现在这套“写作风格”入口有两个明显弱点：

1. 它是“搜索出来的一篇风格文档”，不是一个明确的项目级人格入口。
2. 它在上下文包里位置偏后，而且整个上下文包还会参与预算裁剪；如果资料很多，风格要求的权重不够稳定。

这意味着：
现在也能影响，但不够“稳”，更像“参考要求”，不像“主写作人格”。

**结论**

如果你把 `SOUL.md` 做成“小说项目级写作风格文件”，它对整本小说的整体气质是能产生实质影响的，而且比现在的 `writingStyle` 更稳定。

最适合的理解是：

- 大纲 / 人物小传 / 地点设定：管“写什么不能错”
- 项目级 `SOUL.md`：管“用什么气质去写”

比如它可以约束：

- 默认使用短句还是长句
- 场景推进快还是慢
- 信息一次性交代多少
- 幽默是冷幽默、黑色幽默还是轻俏
- 叙述者更克制还是更外露
- 禁止过度解释、禁止鸡汤、禁止悬浮金句

这对“整本书读起来像不像同一个作者在写”会有帮助。

**在当前软件里好不好实现**

好实现。
不是从零做，属于“现有链路上补一层”。

最小可用版复杂度偏低，主要改 3 个点：

1. 新增项目级 `SOUL.md` 读取
   可以放在比如：
   
   - `项目/.llm-wiki/SOUL.md`
   - 或 `wiki/style/SOUL.md`

2. 把它作为独立字段接进 `ContextPack`
   最直接参考现有的 `writingStyle` 和 `characterAuras`：
   
   - `writingStyle` 现成入口在 [context-engine.ts](</E:/QMAI/src/lib/novel/context-engine.ts:470>)
   - `character aura` 现成模式在 [character-aura.ts](</E:/QMAI/src/lib/novel/character-aura.ts:482>)

3. 把它放到更靠前、更强的位置
   最好不要只当普通资料段落。
   更好的做法是放进小说 `system` prompt 的前部，至少要比检索出来的大量资料更靠前，[chat-panel.tsx](</E:/QMAI/src/components/chat/chat-panel.tsx:449>)

**我对复杂度的判断**

- 最小版：好实现，低到中等复杂度
- 稍微做稳一点：中等复杂度

如果只做“能用”版本，大概就是：

- 读文件
- 注入 prompt
- 加长度限制
- 补几条测试

如果要做得更稳，还建议顺手补两件事：

- 给 `SOUL.md` 单独做一个长度上限和优先级，别和普通资料混在一起
- 加一个简单的安全扫描/过滤
  因为你们现在 `character-aura` 这条链路只有压缩，没有像 Hermes 那样专门做 prompt injection 扫描，[character-aura.ts](</E:/QMAI/src/lib/novel/character-aura.ts:471>)、[character-aura.ts](</E:/QMAI/src/lib/novel/character-aura.ts:581>)

**一句话判断**

- 能不能影响小说整体节奏密度叙述气质：能
- 当前仓库里好不好实现：好实现
- 真正的关键不是“能不能加”，而是“要把它放成高优先级写作人格，而不是普通风格资料”

是否完成：是，已完成分析并给出判断。
是否做了测试验证：没有，本次是源码分析，没有改代码。
风险：如果只是把 `SOUL.md` 当成另一个普通 `writingStyle` 文档，效果会有，但不会特别稳。
是否已 git 提交：没有，本次未改代码。
下一步建议：如果你愿意，我可以下一步直接给你一版“最小改动实现方案”，精确到要改哪 3 个文件、怎么接最合适。

> 如图所示我们将1区域中的内容即角色灵魂，我们将其改为灵魂。这里有项目级灵魂即soul.md，另一个便是角色灵魂绑定这两个功能，你觉得好实现吗？分析一下。
> 
> User context

<details><summary>7 previous messages</summary>

> 我先把这个需求拆成两个层面来判断可行性：`UI/命名层` 是否只是把“角色灵魂”升级成“灵魂”，以及 `能力层` 是否能自然分成“项目级 soul.md + 角色灵魂绑定”两块并接入现有 prompt 链路。
> 
> Context compaction
> 
> Source: automatic
> Status: completed
> 
> 我先按仓库现状把这件事拆开看：确认现在“角色灵魂”这一块到底已经做到哪一步，再判断把它升级成“灵魂”模块后，`soul.md` 项目级灵魂和“角色灵魂绑定”这两个能力分别要动哪些层，最后给你一个实现难度和推荐落地方式。
> 
> 现状已经比较清楚了：现有仓库不是“从零做灵魂”，而是已经有一个偏“角色灵魂注入”的完整链路。我再把提示词注入优先级、现有“写作风格”能力，以及状态类型这几处补齐，这样就能更准确判断改成“项目灵魂 + 角色灵魂绑定”到底是小改还是中改。
> 
> 还差最后一块关键信息：`soul.md` 如果要真正影响全书气质，不能只是“又多读一个文档”，而要看它在现有 prompt 里的位置和优先级。我把这部分也核一下，然后给你一个更稳的结论。
> 
> 我已经能下判断了，不过还想再确认一个落点：现有“角色灵魂”数据是怎么落盘的，这会决定 `soul.md` 是顺手加一个项目文件，还是得引入新的存储结构。这个确认能帮助我们把实现复杂度说得更准确。
> 
> 我不打算再扩读了，信息已经足够回答你的问题。我补一眼 memory 里的 QMAI 约束做引用收口，然后直接给你可执行的判断和建议。

</details>

按我对当前仓库的理解，这个功能是好实现的，属于“中低复杂度的小模块升级”，不是架构级重做。前提假设是：你说的“1 区域”就是现在左侧 `Sparkles` 对应的“角色灵魂”页面，也就是 [icon-sidebar.tsx](./src/components/layout/icon-sidebar.tsx:22) 和 [content-area.tsx](./src/components/layout/content-area.tsx:78) 这条入口。

现在仓库里其实已经有 70% 左右的基础能力了：

- 现有“角色灵魂”不是一个空壳，它已经有完整页面和绑定逻辑，在 [character-aura-view.tsx](./src/components/novel/character-aura-view.tsx)。
- 角色灵魂已经能真正注入到写作 prompt 里，不只是 UI 展示。注入链路在 [character-aura.ts](./src/lib/novel/character-aura.ts:482)、[context-engine.ts](./src/lib/novel/context-engine.ts:75)、[chat-panel.tsx](./src/components/chat/chat-panel.tsx:432)。
- 仓库里已经有一个“弱版项目风格”能力：`writingStyle`，它会从 wiki 里搜索“style/风格/写作”类文档带进上下文，在 [context-engine.ts](./src/lib/novel/context-engine.ts:470)。所以项目级 `soul.md` 不是从零起，而是把“弱风格输入”升级成“明确的项目灵魂”。

如果你现在要做成“灵魂”模块，我建议最省事的方案是：

- 先不改内部路由名 `characterAura`，只改显示名称，从“角色灵魂”改成“灵魂”。
- 把当前页面拆成两个区块或两个 Tab：
  1. `项目灵魂`：编辑/读取 `soul.md`
  2. `角色灵魂绑定`：复用现在已有的角色灵魂能力
- 在 prompt 层新增一个 `projectSoul` 字段，不要只复用 `writingStyle`。
- `projectSoul` 的优先级要高于现在的 `writingStyle`，否则它对节奏、叙述密度、语气的影响会不稳定。[context-engine.ts](./src/lib/novel/context-engine.ts:796) 现在 `writingStyle` 排得比较靠后，这就是为什么我说它目前只是“弱能力”。

实现复杂度我会这样判断：

- 只改名字和页面结构：低复杂度。
- 增加 `soul.md` 的读取、编辑、保存、注入：低到中复杂度。
- 真正需要注意的不是“能不能做”，而是“注入优先级怎么设计”。这决定了 `soul.md` 是真的能影响全书气质，还是只是多了一段参考文本。

有两个实现细节要提前说清楚：

- 当前角色灵魂的触发方式，是“用户任务里出现了已绑定角色名，才注入该角色灵魂”。也就是 [character-aura.ts](./src/lib/novel/character-aura.ts:482) 这套匹配逻辑。如果你后面想要“用户没写角色名，也能根据当前章节自动识别并注入”，那复杂度会明显上升。
- 项目级 `soul.md` 最好不要沿用现在角色灵魂的确认弹窗模式。角色灵魂现在发送前会确认一次，在 [chat-panel.tsx](./src/components/chat/chat-panel.tsx:432)。项目级灵魂更适合默认自动生效，否则写作流程会很打断。

所以结论很直接：

- 能做，而且不难。
- 以当前仓库基础看，这不是新系统，而是“把现有角色灵魂模块向上抽象一层”。
- 如果按最小可用方案做，我认为是中低复杂度，1 个中小版本就能落地。
- 如果你要的是“项目灵魂稳定影响全书风格 + 角色灵魂继续控制人物说话和决策方式”，当前软件完全有这个基础。

这次我只做了代码分析，没有改代码，也没有跑测试。
如果你愿意，下一步我可以直接给你一版“最小实现方案”，精确到要改哪些文件、加哪些字段、UI 怎么拆最省事。
