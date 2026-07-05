// src/infrastructure/capability/capability.module.ts
import type { CapabilityProcess } from '@app-types/common/capability.types';
import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import {
  CAPABILITY_COMMAND_BUS,
  CAPABILITY_EVENT_PUBLISHER,
  CAPABILITY_PERMISSION_CHECKER,
  CAPABILITY_QUEUE_CONSUMER,
  CAPABILITY_QUEUE_TRANSPORT,
  CAPABILITY_QUERY_BUS,
} from '@src/usecases/common/ports/capability-bus.contract';
import { CAPABILITY_REQUEST_CONTEXT_STORE } from '@src/usecases/common/ports/capability-request-context-store.contract';
import { CAPABILITY_RUNTIME_STATE_READER } from '@src/usecases/common/ports/capability-runtime-state-reader.contract';
import { CAPABILITY_SESSION_CONTEXT_BUILDER } from '@src/usecases/common/ports/capability-session-context-builder.contract';
import { BullMqCapabilityQueueTransport } from './bullmq-capability-queue.transport';
import { CapabilityBootstrapCheck } from './capability-bootstrap-check';
import { CapabilityDispatcher } from './capability.dispatcher';
import { AsyncLocalStorageCapabilityRequestContextStore } from './capability-request-context.store';
import { RegistryCapabilitySessionContextBuilder } from './capability-session-context.builder';
import { ConfigCapabilityPermissionChecker } from './config-capability-permission.checker';
import { ConfigCapabilityRuntimeStateReader } from './config-capability-runtime-state.reader';
import { InProcessCapabilityEventPublisher } from './in-process-capability-event.publisher';
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
      imports: [ConfigModule, DiscoveryModule],
      providers: [
        {
          provide: CAPABILITY_PROCESS,
          useValue: options.process,
        },
        CapabilityRegistry,
        CapabilityBootstrapCheck,
        CapabilityDispatcher,
        ConfigCapabilityPermissionChecker,
        ConfigCapabilityRuntimeStateReader,
        BullMqCapabilityQueueTransport,
        InProcessCapabilityEventPublisher,
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
          useExisting: ConfigCapabilityPermissionChecker,
        },
        {
          provide: CAPABILITY_RUNTIME_STATE_READER,
          useExisting: ConfigCapabilityRuntimeStateReader,
        },
        {
          provide: CAPABILITY_QUEUE_TRANSPORT,
          useExisting: BullMqCapabilityQueueTransport,
        },
        {
          provide: CAPABILITY_QUEUE_CONSUMER,
          useExisting: CapabilityDispatcher,
        },
        {
          provide: CAPABILITY_EVENT_PUBLISHER,
          useExisting: InProcessCapabilityEventPublisher,
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
        CAPABILITY_RUNTIME_STATE_READER,
        CAPABILITY_QUEUE_TRANSPORT,
        CAPABILITY_QUEUE_CONSUMER,
        CAPABILITY_EVENT_PUBLISHER,
        CAPABILITY_REQUEST_CONTEXT_STORE,
        CAPABILITY_SESSION_CONTEXT_BUILDER,
      ],
    };
  }
}
