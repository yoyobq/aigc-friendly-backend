// src/adapters/api/graphql/graphql-adapter.module.ts

import { AccountUsecasesModule } from '@src/usecases/account/account-usecases.module';
import { AiQueueUsecasesModule } from '@src/usecases/ai-queue/ai-queue-usecases.module';
import { AuthUsecasesModule } from '@src/usecases/auth/auth-usecases.module';
import { AsyncTaskRecordUsecasesModule } from '@src/usecases/async-task-record/async-task-record-usecases.module';
import { EmailQueueUsecasesModule } from '@src/usecases/email-queue/email-queue-usecases.module';
import { RegistrationUsecasesModule } from '@src/usecases/registration/registration-usecases.module';
import { ThirdPartyAccountsUsecasesModule } from '@src/usecases/third-party-accounts/third-party-accounts-usecases.module';
import { VerificationRecordUsecasesModule } from '@src/usecases/verification-record/verification-record-usecases.module';
import { VerificationUsecasesModule } from '@src/usecases/verification/verification-usecases.module';

import { Module } from '@nestjs/common';

// Resolvers
import { AccountResolver } from './account/account.resolver';
import { AiResolver } from './ai/ai.resolver';
import { UserInfoResolver } from './account/user-info.resolver';
import { AuthResolver } from './auth/auth.resolver';
import { EmailResolver } from './email/email.resolver';
import { RegistrationResolver } from './registration/registration.resolver';
import { ThirdPartyAuthResolver } from './third-party-auth/third-party-auth.resolver';
import { VerificationRecordResolver } from './verification-record/verification-record.resolver';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { QmWorkerEntryGuard } from './guards/qm-worker-entry.guard';

/**
 * GraphQL 适配器模块
 * 统一管理所有 GraphQL Resolvers 和相关的 Guards，遵循适配器层架构原则
 */
@Module({
  imports: [
    // 导入业务模块以获取服务
    AccountUsecasesModule,
    AiQueueUsecasesModule,
    AsyncTaskRecordUsecasesModule,
    AuthUsecasesModule,
    EmailQueueUsecasesModule,
    RegistrationUsecasesModule,
    ThirdPartyAccountsUsecasesModule,
    VerificationRecordUsecasesModule,
    VerificationUsecasesModule,
  ],
  providers: [
    // Resolvers
    AccountResolver,
    AiResolver,
    AuthResolver,
    ThirdPartyAuthResolver,
    EmailResolver,
    RegistrationResolver,
    VerificationRecordResolver,
    UserInfoResolver,
    // Guards
    QmWorkerEntryGuard,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    // Resolvers
    AccountResolver,
    AiResolver,
    AuthResolver,
    ThirdPartyAuthResolver,
    EmailResolver,
    RegistrationResolver,
    VerificationRecordResolver,
    UserInfoResolver,
    QmWorkerEntryGuard,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class GraphQLAdapterModule {}
