<!-- 文件位置: plans/capability-plugin-followup.md -->

# Capability Plugin Followup

本文只跟踪 capability plugin 主链路完成后的尾项。稳定规则见
[docs/common/capability-plugin.rules.md](../docs/common/capability-plugin.rules.md)。
方向背景见 [capability-plugin-direction.md](./capability-plugin-direction.md)。

## P0: Runtime 稳定化

- Runtime state reader 与 permission checker 的配置读取策略：
  - 决策项：启动期静态配置、热配置或带版本的刷新机制。
  - 未决原因：当前 P4 需要保持 kill switch 热读可能性，不能直接做永久 cache。
  - 下一步：出现高频 dispatcher 调用性能压力，或配置模块支持版本/订阅失效后再实现。
- `ConfigService` 缺失诊断：
  - 决策项：移除 optional 依赖，或在非测试环境启动期输出 warning。
  - 未决原因：当前 `CapabilityModule` 已 import `ConfigModule`，生产缺失概率低。
  - 下一步：P5 后若新增运行态配置 provider，再统一收口 DI 失败策略。
- Capability queue disabled / kill-switch policy：
  - 决策项：普通 disabled、operation disabled、kill switch 对已入队任务的处理。
  - 默认方向：普通 disabled 暂停新入队并继续消费已入队；kill switch 拒绝新任务并让已入队任务 failed / audit。
  - 下一步：设计 `CapabilityQueueDisabledPolicy` / `CapabilityQueueKillSwitchPolicy` 与 BullMQ attempts、Async Task Record 的映射。

## P1: Event 与 Health

- Event 可靠性：
  - 当前 in-process event 只保证派发一次和结构化记录。
  - 需要可靠重试、延迟、削峰或跨进程消费时，声明走 queue transport 或独立审计通道。
  - 下一步：出现第一个真实 reliable event 后，再设计 event queue payload、retry、audit 和 idempotency。
- Health check 与 kill switch 联动：
  - 当前 health check 失败不自动等同 disabled。
  - 下一步：定义外部 provider 连续失败、健康降级、手动 kill switch 的优先级和恢复策略。

## P1: Common 瘦身

- `modules/common` 后续拆分顺序：
  - AI technical capability 已有方向，继续观察是否需要进一步物理迁移。
  - email dispatch / worker 继续按 `notification.email` technical capability 收口。
  - invite / password / security / tokens 先保留为 platform common。
  - utils 逐项审视后分散，禁止新增业务域镜像目录。
- 下一步：每次触碰对应 common 子目录时，先判断是否应归入 technical / business capability。

## P2: Business Capability Pilot

- 当前基线不虚构业务域，不内置 edu / upstream / student 等专用抽象。
- 真实业务 capability pilot 出现时，必须先写清 owner bounded context。
- Pilot 至少覆盖：
  - manifest / GraphQL surface / data resource / resource claim。
  - 一个 query operation 和一个 command operation。
  - usecase-owned业务流程，不能让 dispatcher 承担业务编排。
  - 独立事务、幂等、补偿或审计策略。
- account 底座保留 base account + auth / access 机制。
- account identities 子域若承载业务身份事实，应逐步作为 business capability 或 identity capability package 贡献 session principal / authority claim。

## P2: Tooling / Docs

- 已提供观察型 CLI：`npm run capability:list` 从 manifest metadata 输出当前能力清单，`npm run capability:docs` 生成
  `docs/generated/capabilities-current.md`，`npm run capability:docs:check` 校验快照是否过期。
- 不在当前阶段引入 capability SDK 或能力脚手架。
- 若后续能力生成频繁出现偏移，再设计最小脚手架：
  - 生成 manifest provider。
  - 生成 operation handler skeleton。
  - 生成 session contribution fixture。
  - 不生成业务流程实现。
- 若 `docs/common/capability-plugin.rules.md` 与其他 rules 出现冲突，按
  [docs/common/rule-precedence.rules.md](../docs/common/rule-precedence.rules.md) 处理，并优先修正文档冲突。
