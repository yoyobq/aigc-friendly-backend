# 开源版基线与治理对齐验收（2026-09-12）

本文是本次本地执行记录，不是实现规则。实现规则从 [docs/README](../README.md) 路由。

## 范围与版本

实现仅留在开源仓库，包名及版本保持 `aigc-friendly-architecture-backend@1.6.1`。
开源旧基线为 `8b02035e61e8200af0358bae87712b7a9ced892f`；主项目仅以
`77084d70c12b70d014fc869a811897a03d7f7237` 为只读参考。没有引入学校业务、新 CI，未提交、发布或推送。

本机实测 Node.js `24.20.0`、npm `11.19.0`。旧代码与旧依赖另存独立快照，亦在本机上述运行时验证；
不将这些结果解释为历史 Node 版本的复验。旧包管理器声明为 npm 11.18.0，新声明为 npm 11.19.0。

两边共有的直接依赖范围及根锁定版本差异为零。以下列出有变化或新增的直接依赖，列格式为“范围 / 锁定版本”：

| 依赖                                | 旧版               | 对齐后             |
| ----------------------------------- | ------------------ | ------------------ |
| `@nestjs/apollo`                    | ^13.4.2 / 13.4.2   | ^14.0.0 / 14.0.0   |
| `@nestjs/axios`                     | ^4.0.1 / 4.0.1     | ^12.0.0 / 12.0.0   |
| `@nestjs/bullmq`                    | ^11.0.4 / 11.0.4   | ^12.0.0 / 12.0.0   |
| `@nestjs/common`                    | ^11.1.27 / 11.1.27 | ^12.0.1 / 12.0.1   |
| `@nestjs/config`                    | ^4.0.3 / 4.0.4     | ^12.0.0 / 12.0.0   |
| `@nestjs/core`                      | ^11.1.27 / 11.1.27 | ^12.0.1 / 12.0.1   |
| `@nestjs/graphql`                   | ^13.4.2 / 13.4.2   | ^14.0.0 / 14.0.0   |
| `@nestjs/jwt`                       | ^11.0.2 / 11.0.2   | ^12.0.1 / 12.0.1   |
| `@nestjs/passport`                  | ^11.0.5 / 11.0.5   | ^12.0.0 / 12.0.0   |
| `@nestjs/platform-express`          | ^11.1.27 / 11.1.27 | ^12.0.1 / 12.0.1   |
| `@nestjs/typeorm`                   | ^11.0.3 / 11.0.3   | ^12.0.1 / 12.0.1   |
| `axios`                             | ^1.18.1 / 1.18.1   | ^1.20.0 / 1.20.0   |
| `bullmq`                            | ^5.79.2 / 5.79.2   | ^6.3.4 / 6.3.4     |
| `graphql-ws`                        | ^6.0.7 / 6.0.8     | ^6.2.1 / 6.2.1     |
| `mysql2`                            | ^3.22.5 / 3.22.5   | ^3.24.3 / 3.24.3   |
| `nestjs-pino`                       | ^4.6.1 / 4.6.1     | ^5.1.0 / 5.1.0     |
| `typeorm`                           | ^1.0.0 / 1.0.0     | ^1.1.1 / 1.1.1     |
| `ws`                                | ^8.21.0 / 8.21.0   | ^8.21.3 / 8.21.3   |
| `concurrently`                      | 新增 / —           | ^10.0.5 / 10.0.5   |
| `@eslint/eslintrc`                  | ^3.3.5 / 3.3.5     | ^3.3.7 / 3.3.7     |
| `@nestjs/cli`                       | ^11.0.23 / 11.0.23 | ^12.0.0 / 12.0.0   |
| `@nestjs/schematics`                | ^11.1.0 / 11.1.0   | ^12.0.0 / 12.0.0   |
| `@nestjs/testing`                   | ^11.1.27 / 11.1.27 | ^12.0.1 / 12.0.1   |
| `@swc/core`                         | ^1.15.43 / 1.15.43 | ^1.16.1 / 1.16.1   |
| `@types/node`                       | ^26.1.0 / 26.1.0   | ^24.13.3 / 24.13.3 |
| `@types/supertest`                  | ^7.2.0 / 7.2.0     | ^7.2.1 / 7.2.1     |
| `eslint`                            | ^10.6.0 / 10.6.0   | ^10.9.1 / 10.9.1   |
| `eslint-plugin-boundaries`          | ^6.0.0 / 6.0.2     | ^7.2.0 / 7.2.0     |
| `globals`                           | ^17.7.0 / 17.7.0   | ^17.12.0 / 17.12.0 |
| `jest`                              | ^30.4.2 / 30.4.2   | ^30.5.1 / 30.5.1   |
| `prettier`                          | ^3.9.4 / 3.9.4     | ^3.9.6 / 3.9.6     |
| `ts-jest`                           | ^29.4.11 / 29.4.11 | ^29.4.12 / 29.4.12 |
| `typescript-eslint`                 | ^8.62.1 / 8.62.1   | ^8.69.0 / 8.69.0   |
| `eslint-import-resolver-typescript` | 新增 / —           | ^4.4.5 / 4.4.5     |

`crypto-js` 保留 `^4.2.0 / 4.2.0`，保留 `@types/crypto-js` 和开源专用工具。
未引入主项目的 exceljs、sharp、jszip 等文档/图片处理依赖。
旧 overrides 改为主项目的 `test-exclude -> glob: 11.1.0`。
`.npmrc` 启用 `strict-allow-scripts=true`；许可名单逐项等于实际锁文件的安装脚本包：
`@apollo/protobufjs@1.2.8`、`@parcel/watcher@2.6.0`、`@swc/core@1.16.1`、
`msgpackr-extract@3.0.4`、`unrs-resolver@1.12.2`。

## 兼容适配

- 源码使用 NodeNext 编译与解析，Jest 使用独立 CommonJS/node10 转换配置及 VM Modules 启动。
  `tsconfig.tools.json` 继续独立检查工具脚本；Jest 不扫描忽略的 `.tmp` 验收快照。
- API/Worker 支持各自开发和生产入口、联合 `dev` / `start:all`；生产入口对应实际构建出的
  `dist/src/bootstraps/api/main.js` 和 `dist/src/bootstraps/worker/main.js`。
- 通用架构规则细分 module 纯规则、装配、公开服务和内部运行时；规则与正反例覆盖别名、相对路径、
  重导出、动态导入和 require，并禁止上层借用实现文件中的类型。没有通过关闭规则或扩大豁免通过检查。
- Account 创建、锁定及 Verification 写后结果改为模块内映射稳定快照/View，ORM Entity 留在模块内。
  提取现有投影复用已读记录，不为映射增加查询；写操作内部的锁定、约束读取仍留在写实现。
- Token/验证码运行时公开服务改用 service 文件名，纯 audience 校验独立为 policy；Workflow
  terminal drain 通过现有服务显式入口调用原 gate 规则。DTO 复用移至 adapter common，类名和 schema 不变。
- BullMQ 6 连接类型改用其自己的 RedisOptions；测试基础设施连接改为显式的同等 host/port/db/password/tls
  配置，解决与 ioredis 类型的冲突。Pino 5 装配补明确请求/响应泛型。历史测试仅调整导入、类型和必要装配。
  五个 Worker 等待器在观察终态后重新读取 Job，避免 getState() 不刷新旧对象造成的结果快照竞态；不修改结果断言。
- AST 对比 68 个历史测试文件的 1750 条 expect 表达式，无变化。旧 AiWorkerService mock Workflow
  测试保留且不计作真实跨能力证据。新增实体加密兼容测试与原注册 SQL/ORM 加密存取断言共同验证存储兼容。

## 实测证据

原始日志、执行退出码与耗时保存在开源仓库忽略目录 `.tmp/baseline-alignment/`，索引为 `runs.jsonl`。
凭据仅保存在该目录 `isolated.env`（权限 600），不进入本文或 Git。

| 验收项                                                             | 本次结果                                                               | 日志文件（上述目录内）                                                                             |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 旧源码与工具类型检查、无修改 lint、架构检查、构建、Capability 工具 | 通过                                                                   | `old-typecheck.log`、`old-lint.log`、`old-architecture.log`、`old-build.log`、`old-capability.log` |
| 旧单测                                                             | 48 suites / 312 tests 通过                                             | `old-unit.log`                                                                                     |
| 旧 core E2E                                                        | 12 files / 160 tests 通过                                              | `old-core.log`                                                                                     |
| 旧 Worker E2E                                                      | 5 files / 79 tests 复验通过                                            | `old-worker-recheck.log`                                                                           |
| 可重现安装                                                         | npm ci 成功，1028 packages                                             | `reproducible-install.log`                                                                         |
| 新源码/独立工具/测试类型检查                                       | 通过                                                                   | `acceptance-types.log`、`final-test-types.log`                                                     |
| 全量无修改 lint、normalize、Capability 文档一致性、架构正反例      | 通过，53 cases                                                         | `final-lint-after-waiter.log`                                                                      |
| 新单测                                                             | 49 suites / 315 tests 通过                                             | `acceptance-units.log`                                                                             |
| 构建                                                               | 通过，两个生产入口均存在并通过 node --check                            | `acceptance-build.log`                                                                             |
| 新 core E2E                                                        | 12 files / 160 tests 通过                                              | `acceptance-core.log`                                                                              |
| 空库迁移                                                           | 7 条迁移及关键表、索引、外键校验通过                                   | `acceptance-migration.log`                                                                         |
| 真实协作组合                                                       | 6 tests 通过，变异还原后 6 tests 再通过                                | `collaboration-initial.log`、`collaboration-restored.log`                                          |
| 新 Worker E2E                                                      | 6 files / 85 tests 通过（完整清单含协作测试）                          | `acceptance-worker-final.log`                                                                      |
| API/Worker 本地冒烟                                                | 联合启动、API readiness、Worker 装配、双进程输出和退出时队列暂停均通过 | `acceptance-local-smoke.log`                                                                       |
| 最终历史断言、变异还原和主项目工作区核对                           | 通过                                                                   | `final-audit.log`、`final-audit.json`                                                              |

公开 GraphQL schema 由旧/新版本各自的 8 个 resolver 实际重新生成并排序，均为 16619 字节，SHA-256 相同：
`20b40e5f5ea73e15229572c11d1b2e21f017147127e753db963a780b16ecda8d`。
没有业务接口变化；原 GraphQL 错误/鉴权/会话契约未被主项目特有行为覆盖。
文件为 `old-generated-schema.graphql`、`new-generated-schema.graphql`。
另对完整 E2E 实际 API 装配产出的两个 src/schema.graphql 做规范化比较，得到同一哈希，见 `actual-api-schema.log`。

`capability:list` 旧/新 9 行观察清单完全一致，生成文档检查通过；未修改 ID、mode、requires、
显式 gate 或 terminal drain 语义。旧 gate 单测加新增真实禁用组合验证：Execution 关闭时拒绝新 admission、
不领取 backlog；只协调自有终态审计，不重新调用 provider。

## 协作与变异检测

协议：[Workflow 消费 Execution 文本生成](../collaborations/ai.workflow/ai.execution--text-generation.md)，
双方 decision 均可发现。真实装配覆盖参数和结果、非法输入无 provider 调用、两次暂时失败后第三次成功、
三次耗尽失败且无输出、成功任务队列重放不重复调用，以及 Execution 禁用后的 admission/activation/drain。
只在基础设施 provider 客户端边界控制返回与失败，没有替换 AiWorkerService、registry、handler、数据库或队列。

两种有效临时变异均只修改 AiWorkerService.generate，逐个运行、逐个还原：

| 临时回归                   | 原断言实际检测                                               | 证据                                                       |
| -------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| 传递错误 model             | 精确参数比较收到 wrong-model-mutation 而非 consumer-model-42 | `mutation-wrong-model.log`，1 failed / 5 skipped           |
| 吞 provider 错误并伪造成功 | 耗尽场景期望 failed，实际 completed                          | `mutation-swallowed-error-valid.log`，1 failed / 5 skipped |

`mutations.json` 记录两个 detected=true、实现 restored=true、断言 assertionsUnchanged=true。
还原后的实现 SHA-256 为 `bbd66ad53246f91024180741cc0dd163cedc0c0cd46b82a13104e923917149c6`。
第一次伪成功试验缺少 providerJobId 而编译失败，未计入语义检测；补齐返回类型后才取得上述断言证据。

## 隔离、异常与证据范围

MySQL 仅使用 `aigc_alignment_test_20260912` 和 `aigc_alignment_drill_20260912`；
从未使用或清理 `edu_platform_test`。Redis 为专用 `127.0.0.1:16489/0`，E2E 前缀
`aigc-alignment-20260912`，本地冒烟使用另一个随机专用前缀；临时文件与证据均放开源仓库忽略目录。
AI 使用本地 provider 边界控制，邮件使用既有 mock/禁用投递；没有调用真实 AI、邮件或其他外部服务。

旧 Worker 首跑在“先读取 Job 快照、后查询终态”之间遇到竞态，completed 对应的旧快照 returnvalue 为 null；
未改变旧代码或断言，完整复跑通过。新版第一次完整 Worker 在 WSL 重启时遇到 MySQL
PROTOCOL_CONNECTION_LOST；该轮不计完整验收，保留 `acceptance-worker.log`。重启后 Execution 测试也复现上述快照竞态，
保留 `acceptance-worker-after-reboot.log`；修正测试等待器后再次完整运行，不以重复抽跑代替修复。

这些结果是本地实现者验证、历史断言比较及有界变异证据；不等价于独立审查者结论，也不证明外部供应商行为。
本轮未取得独立人员审查或真实外部服务证据，不配置 CI。人类说明文档只解释测试与信任体系，不成为实现规则来源。

最后核对主项目 HEAD 仍为 `77084d70c12b70d014fc869a811897a03d7f7237`，工作区与开始时一样干净。
所有实现变更仅留在开源仓库；本地冒烟进程已正常退出，专用 Redis 在验收后关闭，专用 MySQL 库及证据文件保留。

忽略目录内的 `run.cjs` 可加载隔离配置并为一次复验保存日志（执行前需启动对应专用基础设施）：

```bash
node .tmp/baseline-alignment/run.cjs replay-worker npm run test:e2e:worker
node .tmp/baseline-alignment/run.cjs replay-smoke npm run smoke:dev
node .tmp/baseline-alignment/run.cjs replay-migration env MIGRATION_DRILL_DATABASE=aigc_alignment_drill_20260912 npm run migration:drill:empty-db
```
