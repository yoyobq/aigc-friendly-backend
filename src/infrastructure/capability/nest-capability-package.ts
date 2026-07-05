// src/infrastructure/capability/nest-capability-package.ts
import type { CapabilityId, CapabilityProcess } from '@app-types/common/capability.types';
import type { DynamicModule, Type } from '@nestjs/common';

export interface NestCapabilityPackage {
  readonly capabilityId: CapabilityId;
  readonly processes: readonly CapabilityProcess[];
  readonly module: Type<unknown> | DynamicModule;
}
