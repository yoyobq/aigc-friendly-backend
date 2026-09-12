import { ESLint } from 'eslint';

const RULES = {
  adapterTypesFromUsecase: 'local-architecture/no-adapter-types-from-usecase-implementations',
  adapterToQueryService: 'local-architecture/no-adapter-to-queryservice-imports',
  boundaries: 'boundaries/dependencies',
  infrastructureToUsecases: 'local-architecture/no-infrastructure-to-usecases-imports',
};

const cases = [
  {
    name: 'reject adapter importing infrastructure through a TypeScript path alias',
    filePath: 'src/adapters/api/graphql/account/account.resolver.ts',
    code: `
      import '@src/infrastructure/logger/logger.module';
    `,
    ruleId: RULES.boundaries,
    expectViolation: true,
  },
  {
    name: 'reject adapter importing infrastructure through an extensionless relative path',
    filePath: 'src/adapters/api/graphql/account/account.resolver.ts',
    code: `
      import '../../../../infrastructure/logger/logger.module';
    `,
    ruleId: RULES.boundaries,
    expectViolation: true,
  },
  {
    name: 'allow adapter importing a same-scope Usecase through a TypeScript path alias',
    filePath: 'src/adapters/api/graphql/account/account.resolver.ts',
    code: `
      import { FetchUserInfoUsecase } from '@src/usecases/account/fetch-user-info.usecase';
      void FetchUserInfoUsecase;
    `,
    ruleId: RULES.boundaries,
    expectViolation: false,
  },
  {
    name: 'reject adapter importing a flow type from a Usecase implementation',
    filePath: 'src/adapters/api/graphql/account/account.resolver.ts',
    code: `
      import { FetchUserInfoUsecase, type FetchUserInfoResult } from '@src/usecases/account/fetch-user-info.usecase';
      void FetchUserInfoUsecase;
      type Probe = FetchUserInfoResult;
      void (null as unknown as Probe);
    `,
    ruleId: RULES.adapterTypesFromUsecase,
    expectViolation: true,
  },
  {
    name: 'allow adapter importing a flow type from a dedicated types file',
    filePath: 'src/adapters/api/graphql/account/account.resolver.ts',
    code: `
      import type { SessionSnapshotModel } from '@src/usecases/account/get-my-session.types';
      type Probe = SessionSnapshotModel;
      void (null as unknown as Probe);
    `,
    ruleId: RULES.adapterTypesFromUsecase,
    expectViolation: false,
  },
  {
    name: 'allow adapter using an inline type-only import from a dedicated types file',
    filePath: 'src/adapters/api/graphql/account/account.resolver.ts',
    code: `
      import { type SessionSnapshotModel } from '@src/usecases/account/get-my-session.types';
      type Probe = SessionSnapshotModel;
      void (null as unknown as Probe);
    `,
    ruleId: RULES.adapterTypesFromUsecase,
    expectViolation: false,
  },
  {
    name: 'reject adapter value-importing from a dedicated types file',
    filePath: 'src/adapters/api/graphql/account/account.resolver.ts',
    code: `
      import { SessionSnapshotModel } from '@src/usecases/account/get-my-session.types';
      type Probe = SessionSnapshotModel;
      void (null as unknown as Probe);
    `,
    ruleId: RULES.adapterTypesFromUsecase,
    expectViolation: true,
  },
  {
    name: 'reject adapter importing a type from a Usecase helper',
    filePath: 'src/adapters/api/graphql/ai/ai.resolver.ts',
    code: `
      import type { AiWorkflowHandlerProcessResult } from '@src/usecases/ai-worker/ai-workflow-handler.registry';
      type Probe = AiWorkflowHandlerProcessResult;
      void (null as unknown as Probe);
    `,
    ruleId: RULES.adapterTypesFromUsecase,
    expectViolation: true,
  },
  {
    name: 'allow adapter importing a Usecases module for DI assembly',
    filePath: 'src/adapters/api/graphql/graphql-adapter.module.ts',
    code: `
      import { AccountUsecasesModule } from '@src/usecases/account/account-usecases.module';
      void AccountUsecasesModule;
    `,
    ruleId: RULES.adapterTypesFromUsecase,
    expectViolation: false,
  },
  {
    name: 'reject adapter importing QueryService implementation',
    filePath: 'src/adapters/api/graphql/account/account.resolver.ts',
    code: `
      import { AccountQueryService } from '@src/modules/account/queries/account.query.service';
      void AccountQueryService;
    `,
    ruleId: RULES.adapterToQueryService,
    expectViolation: true,
  },
  {
    name: 'allow adapter importing Usecase',
    filePath: 'src/adapters/api/graphql/account/account.resolver.ts',
    code: `
      import { FetchUserInfoUsecase } from '@src/usecases/account/fetch-user-info.usecase';
      void FetchUserInfoUsecase;
    `,
    ruleId: RULES.adapterToQueryService,
    expectViolation: false,
  },
  {
    name: 'reject infrastructure importing Usecase implementation',
    filePath: 'src/infrastructure/database/transaction/typeorm-transaction.runner.ts',
    code: `
      import { FetchUserInfoUsecase } from '@src/usecases/account/fetch-user-info.usecase';
      void FetchUserInfoUsecase;
    `,
    ruleId: RULES.infrastructureToUsecases,
    expectViolation: true,
  },
  {
    name: 'allow infrastructure importing common usecase contract',
    filePath: 'src/infrastructure/database/transaction/typeorm-transaction.runner.ts',
    code: `
      import type { TransactionRunner } from '@src/usecases/common/ports/transaction-runner.contract';
      type Probe = TransactionRunner;
      void (null as unknown as Probe);
    `,
    ruleId: RULES.infrastructureToUsecases,
    expectViolation: false,
  },
  {
    name: 'allow infrastructure importing colocated usecase contract',
    filePath: 'src/infrastructure/database/transaction/typeorm-transaction.runner.ts',
    code: `
      import type { TransactionRunner } from '@src/usecases/ai-worker/example-provider.contract';
      type Probe = TransactionRunner;
      void (null as unknown as Probe);
    `,
    ruleId: RULES.infrastructureToUsecases,
    expectViolation: false,
  },
];

// Probe production paths: test-file exemptions must not hide dependency regressions.
const boundaryProbes = [
  [
    'schema cannot call usecases',
    'src/adapters/api/graphql/schema/schema.init.ts',
    "import '@src/usecases/account/fetch-user-info.usecase';",
    true,
  ],
  [
    'decorators cannot call usecases',
    'src/adapters/api/graphql/decorators/current-user.decorator.ts',
    "import '@src/usecases/account/fetch-user-info.usecase';",
    true,
  ],
  [
    'guards can invoke authorization usecases',
    'src/adapters/api/graphql/guards/jwt-auth.guard.ts',
    "import '@src/usecases/auth/verify-access-token.usecase';",
    false,
  ],
  [
    'DTOs stay in their adapter scope',
    'src/adapters/api/graphql/auth/auth.resolver.ts',
    "import '@src/adapters/api/graphql/account/dto/user-account.dto';",
    true,
  ],
  [
    'same-scope DTO reuse is allowed',
    'src/adapters/api/graphql/account/account.resolver.ts',
    "import './dto/user-account.dto';",
    false,
  ],
  [
    'ordinary usecases cannot import Nest modules',
    'src/usecases/account/create-account.usecase.ts',
    "import '@src/modules/common/search.module';",
    true,
  ],
  [
    'usecase wiring can import Nest modules',
    'src/usecases/account/account-usecases.module.ts',
    "import '@src/modules/account/account.module';",
    false,
  ],
  [
    'same-domain pure policies are reusable',
    'src/usecases/auth/login-with-password.usecase.ts',
    "import '@src/modules/auth/audience.policy';",
    false,
  ],
  [
    'cross-domain module policies are internal',
    'src/usecases/account/create-account.usecase.ts',
    "import '@src/modules/auth/audience.policy';",
    true,
  ],
  [
    'pure policies cannot import infrastructure',
    'src/modules/auth/audience.policy.ts',
    "import '@src/infrastructure/logger/logger.module';",
    true,
  ],
  [
    'pure policies cannot import services',
    'src/modules/auth/audience.policy.ts',
    "import './auth.service';",
    true,
  ],
  [
    'pure policies cannot re-export infrastructure',
    'src/modules/auth/audience.policy.ts',
    "export * from '@src/infrastructure/logger/logger.module';",
    true,
  ],
  [
    'common pure constants are reusable',
    'src/modules/auth/audience.policy.ts',
    "import '../common/ai-capability/ai-capability.constants';",
    false,
  ],
  [
    'cross-domain QueryService composition is rejected',
    'src/modules/account/queries/account.query.service.ts',
    "import '@src/modules/verification-record/queries/verification-record.query.service';",
    true,
  ],
  [
    'search uses a stable DI token',
    'src/modules/account/queries/account.query.service.ts',
    "import '@src/modules/common/tokens/pagination.tokens';",
    false,
  ],
  [
    'usecases cannot access runtime codecs',
    'src/usecases/auth/login-with-password.usecase.ts',
    "import '@src/modules/common/security/token-fingerprint.helper';",
    true,
  ],
];
cases.push(
  ...boundaryProbes.map(([name, filePath, code, expectViolation]) => ({
    name,
    filePath,
    code,
    expectViolation,
    ruleId: RULES.boundaries,
  })),
);
cases.push({
  name: 'pure policy cannot import Nest even when no internal dependency is involved',
  filePath: 'src/modules/auth/audience.policy.ts',
  code: "import { Injectable } from '@nestjs/common'; void Injectable;",
  ruleId: 'no-restricted-imports',
  expectViolation: true,
});

for (const filePath of [
  'src/modules/auth/audience.policy.ts',
  'src/modules/common/ai-capability/ai-capability.constants.ts',
]) {
  for (const [specifier, expectViolation] of [
    ['src/types/models/account.types', true],
    ['@src/types/models/account.types', true],
    [`${process.cwd()}/src/types/models/account.types`, true],
    ['@app-types/models/account.types', false],
  ]) {
    cases.push({
      name: `${filePath}: shared types via ${specifier}`,
      filePath,
      code: `import { AccountStatus } from '${specifier}'; void AccountStatus;`,
      ruleId: 'no-restricted-imports',
      expectViolation,
    });
  }
}

for (const specifier of [
  '@src/infrastructure/logger/logger.module',
  '../../../../infrastructure/logger/logger.module',
]) {
  for (const code of [
    `export * from '${specifier}';`,
    `void import('${specifier}');`,
    `require('${specifier}');`,
  ]) {
    cases.push({
      name: `reject adapter dependency: ${code}`,
      filePath: 'src/adapters/api/graphql/account/account.resolver.ts',
      code,
      ruleId: RULES.boundaries,
      expectViolation: true,
    });
  }
}
for (const code of [
  "export { AccountStatus } from '@app-types/models/account.types';",
  "void import('@app-types/models/account.types');",
  "require('@app-types/models/account.types');",
]) {
  cases.push({
    name: `allow stable shared dependency: ${code}`,
    filePath: 'src/adapters/api/graphql/account/account.resolver.ts',
    code,
    ruleId: RULES.boundaries,
    expectViolation: false,
  });
}

for (const [code, expectViolation] of [
  [
    "import type { AccountService } from '@src/modules/account/base/services/account.service';",
    true,
  ],
  [
    "import { type AccountService } from '@src/modules/account/base/services/account.service';",
    true,
  ],
  [
    "type Borrowed = import('@src/modules/account/base/services/account.service').AccountService;",
    true,
  ],
  ["import type { AccountSnapshot } from '@src/modules/account/account.types';", false],
  [
    "import { AccountService } from '@src/modules/account/base/services/account.service'; void AccountService;",
    false,
  ],
]) {
  cases.push({
    name: `module type source: ${code}`,
    filePath: 'src/usecases/account/create-account.usecase.ts',
    code,
    ruleId: 'local-architecture/no-upper-types-from-module-implementations',
    expectViolation,
  });
}

const eslint = new ESLint({ cwd: process.cwd(), cache: false });
const failures = [];

for (const fixture of cases) {
  const [result] = await eslint.lintText(fixture.code, { filePath: fixture.filePath });
  const fatalMessage = result.messages.find((message) => message.fatal);
  if (fatalMessage) {
    failures.push(`${fixture.name}: fixture did not parse: ${fatalMessage.message}`);
    continue;
  }

  const hasViolation = result.messages.some((message) => message.ruleId === fixture.ruleId);
  if (hasViolation !== fixture.expectViolation) {
    failures.push(
      `${fixture.name}: expected ${fixture.expectViolation ? 'a violation' : 'no violation'} from ${fixture.ruleId}`,
    );
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(`eslint architecture fixtures passed (${cases.length} cases)\n`);
