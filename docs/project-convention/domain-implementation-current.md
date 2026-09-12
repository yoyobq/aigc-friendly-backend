Purpose: Record existing open-source domain ownership and implementation conventions.
Read when: Changing account/userInfo, verification records, or AI Workflow/Execution implementation ownership.
Source of truth: Repository-local implementation conventions only; common layer rules, accepted Capability decisions and API current contracts retain their authority.

# 当前领域实现约定

## Account / UserInfo

- Account 是聚合根；UserInfo 是 1:1 强关联资料，通过 Account 域的细粒度写入口维护。
- AccountQueryService 负责 account/userInfo 稳定读模型。登录、严格读取和可见资料读取可以有不同模式，但共享字段投影，不复制默认值逻辑。
- FetchUserInfoUsecase 负责登录读取及安全校验，不成为通用 View 拼装来源。
- userInfo 可见性复用 core/account 的纯可见性 policy。身份与角色语义保持开源版现有 API 契约。
- 字段加密继续由 infrastructure 的 FieldEncryptionService/Subscriber 与 account registrar 装配；保留 crypto-js AES-CBC 密文格式。

## VerificationRecord

- VerificationRecord 是独立聚合根；消费、target constraint、消费时 target 绑定属于同一次聚合写语义。
- Service 内锁定、写入约束和写后映射需要的读取可以留在写实现中；独立读入口由 QueryService 提供。
- Account、注册及验证跨域流程由 Usecase 显式持有 TransactionRunner，向模块传递同一 PersistenceTransactionContext。

## AI Workflow / Execution

- ai.workflow 持有上下文、admission、队列和 housekeeping；ai.execution 持有 provider 选择与调用。按既有 decision 保持显式 gate、activation 和 terminal drain。
- Workflow handler 通过 AiWorkerService 消费 Execution；真实组合验证从双方 decision 链接的 collaboration agreement 发现。
- Capability ID、mode、requires 和生成观察工具不由目录或规则升级重新定义。

## 历史边界

- 新边界声明使用 *.contract.ts。既有 src/core/ai/ai-provider.interface.ts 仅保留 AI provider 的框架无关签名；不得扩大其运行时职责，也不构成新增 *.interface.ts 或 *.port.ts 的许可。
- Core 中既有通用 normalize、分页及搜索抽象只做兼容维护；不以历史位置扩大运行时职责。
- 写后 View 映射复用已获取的记录，不为统一映射增加查询，不向 Usecase 暴露 ORM Entity。
