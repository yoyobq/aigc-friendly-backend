# Workflow 消费 Execution：文本生成

消费者为 `ai.workflow`，提供者为 `ai.execution`。本协议记录已有
`generic_text_generate` 流程的消费承诺，不新增 Capability、入口或运行时目录。

语义来源：[Workflow decision](../../capabilities/ai-workflow.md)、
[Execution decision](../../capabilities/ai-execution.md)及
[Capability 规则](../../common/capability.rules.md)。

## 现有入口与最小承诺

`CreateAndAdmitAiWorkflowUsecase.execute` 创建上下文并入 Workflow 队列；Worker 经
`ConsumeAiWorkflowJobUsecase`、已有 Workflow handler 调用 `AiWorkerService.generate`，
由真实 provider registry 选择基础设施 provider。这里没有新增 GraphQL Workflow API。

- 合法输入的 provider、model、组合 prompt 和追踪 metadata 到达所选 provider；其真实返回的
  outputText、model、provider 及 provider 标识进入 Workflow 输出。
- 非法 Workflow 输入在调用 provider 前失败，不写入伪造输出或 provider 调用记录。
- 暂时 provider 失败向上传播，由现有队列策略重试；重试成功后保存真实输出。
- 重试耗尽时保留失败状态、错误及失败审计，不将错误转换为空文本或成功。
- 已成功 Workflow 再次经过队列处理时复用已有终态，不再次调用 provider。
- 禁用 Execution 时拒绝新 admission，Workflow 被前置阻塞且不激活消费；已有 backlog
  不被领取。仅因 Execution 阻塞时可按既有规则协调 Workflow 自有终态审计，不能发起新执行。
  显式关闭 Workflow、关闭父级 AI 或缺失 Async Task 时的限制继续由原有 gate 测试约束。

## 允许副作用与验证边界

允许 Workflow 上下文、队列状态、异步任务审计及 provider 调用记录发生已有定义的写入；允许失败
重试导致多次 provider 调用。成功任务重放与 terminal drain 不允许产生新的 provider 调用。

独立组合测试：
`test/08-qm-worker/ai-workflow-execution-collaboration.e2e-spec.ts`，已加入默认 Worker 清单。
它运行真实 API/Worker 根模块、MySQL、Redis/BullMQ、handler、AiWorkerService、registry、
事务与审计。API 测试根额外导入已有 AiWorkflowUsecasesModule，以调用现有应用入口；不改变生产
API 装配。仅替换基础设施 OpenAI/Qwen/local provider 客户端，返回值由测试独立给定。

```bash
npm run test:e2e:file -- test/08-qm-worker/ai-workflow-execution-collaboration.e2e-spec.ts --needs=mysql,redis,bullmq
npm run test:e2e:worker
```

上述测试证明本地组合与消费语义，不证明外部模型质量、远程 SDK/网络或供应商可用性。
原有以 AiWorkerService mock 驱动 Workflow 的测试继续保留，只计入局部编排证据。
本轮实际执行结果、临时变异检测与还原复验见[验收记录](../../reports/2026-09-12-baseline-alignment.md)；未执行的独立人员审查不能由作者自检代替。

## 重验条件

修改生成参数/结果、provider 选择或 DI、Workflow handler、输入校验、错误传播、重试/去重、
持久化、队列、Capability requires/gate/activation/drain 时，重跑对应组合断言及提供者局部测试。
共享工具链、配置、事务、鉴权或存储升级需扩展到完整 core/worker 回归。
改变历史断言必须有获接受的语义变化或原断言错误的独立依据，不能仅因新实现失败而修改。
