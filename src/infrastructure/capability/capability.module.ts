// src/infrastructure/capability/capability.module.ts
import type { CapabilityProcess } from '@app-types/common/capability.types';
import { type DynamicModule, Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import {
  CAPABILITY_COMMAND_BUS,
  CAPABILITY_PERMISSION_CHECKER,
  CAPABILITY_QUERY_BUS,
} from '@src/usecases/common/ports/capability-bus.contract';
import { CAPABILITY_REQUEST_CONTEXT_STORE } from '@src/usecases/common/ports/capability-request-context-store.contract';
import { CAPABILITY_SESSION_CONTEXT_BUILDER } from '@src/usecases/common/ports/capability-session-context-builder.contract';
import { AllowAllCapabilityPermissionChecker } from './allow-all-capability-permission.checker';
import { CapabilityBootstrapCheck } from './capability-bootstrap-check';
import { CapabilityDispatcher } from './capability.dispatcher';
import { AsyncLocalStorageCapabilityRequestContextStore } from './capability-request-context.store';
import { RegistryCapabilitySessionContextBuilder } from './capability-session-context.builder';
import { CAPABILITY_PROCESS, CapabilityRegistry } from './capability.registry';
import {
  PlatformAccountCapabilityDeclaration,
  PlatformAuthCapabilityDeclaration,
} from './platform-capability.declarations';

export interface CapabilityModuleOptions {
  readonly process: CapabilityProcess;
}

@Global()
@Module({})
export class CapabilityModule {
  static forRoot(options: CapabilityModuleOptions): DynamicModule {
    return {
      module: CapabilityModule,
      global: true,
      imports: [DiscoveryModule],
      providers: [
        {
          provide: CAPABILITY_PROCESS,
          useValue: options.process,
        },
        CapabilityRegistry,
        CapabilityBootstrapCheck,
        CapabilityDispatcher,
        AllowAllCapabilityPermissionChecker,
        AsyncLocalStorageCapabilityRequestContextStore,
        RegistryCapabilitySessionContextBuilder,
        {
          provide: CAPABILITY_COMMAND_BUS,
          useExisting: CapabilityDispatcher,
        },
        {
          provide: CAPABILITY_QUERY_BUS,
          useExisting: CapabilityDispatcher,
        },
        {
          provide: CAPABILITY_PERMISSION_CHECKER,
          useExisting: AllowAllCapabilityPermissionChecker,
        },
        {
          provide: CAPABILITY_REQUEST_CONTEXT_STORE,
          useExisting: AsyncLocalStorageCapabilityRequestContextStore,
        },
        {
          provide: CAPABILITY_SESSION_CONTEXT_BUILDER,
          useExisting: RegistryCapabilitySessionContextBuilder,
        },
        PlatformAccountCapabilityDeclaration,
        PlatformAuthCapabilityDeclaration,
      ],
      exports: [
        CapabilityRegistry,
        CAPABILITY_COMMAND_BUS,
        CAPABILITY_QUERY_BUS,
        CAPABILITY_PERMISSION_CHECKER,
        CAPABILITY_REQUEST_CONTEXT_STORE,
        CAPABILITY_SESSION_CONTEXT_BUILDER,
      ],
    };
  }
}
