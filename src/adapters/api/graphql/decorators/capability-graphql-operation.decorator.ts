import type { CapabilityId, CapabilityOperationKind } from '@app-types/common/capability.types';
import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { CapabilityRuntimeGuard } from '../guards/capability-runtime.guard';

export const CAPABILITY_GRAPHQL_OPERATION_KEY = 'capabilityGraphqlOperation';

export interface CapabilityGraphqlOperationPolicy {
  readonly capabilityId: CapabilityId;
  readonly operation: string;
  readonly operationKind: Exclude<CapabilityOperationKind, 'event'>;
}

export function capabilityGraphqlOperation(
  policy: CapabilityGraphqlOperationPolicy,
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    SetMetadata(CAPABILITY_GRAPHQL_OPERATION_KEY, policy),
    UseGuards(CapabilityRuntimeGuard),
  );
}
