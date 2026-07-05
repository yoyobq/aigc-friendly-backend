// src/infrastructure/capability/nest-capability-package.ts
import type { CapabilityId, CapabilityProcess } from '@app-types/common/capability.types';
import type { DynamicModule, Type } from '@nestjs/common';

// Reserved for later API / Worker bootstrap aggregation; owner manifests remain the source of truth.
export interface NestCapabilityPackage {
  readonly capabilityId: CapabilityId;
  readonly processes: readonly CapabilityProcess[];
  readonly module: Type<unknown> | DynamicModule;
}
