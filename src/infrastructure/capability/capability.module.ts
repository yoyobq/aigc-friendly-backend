// src/infrastructure/capability/capability.module.ts
import type { CapabilityProcess } from '@app-types/common/capability.types';
import { type DynamicModule, Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { CapabilityBootstrapCheck } from './capability-bootstrap-check';
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
        PlatformAccountCapabilityDeclaration,
        PlatformAuthCapabilityDeclaration,
      ],
      exports: [CapabilityRegistry],
    };
  }
}
