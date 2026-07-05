// src/infrastructure/capability/capability-error.mapper.ts
import type { CapabilityError, CapabilityErrorCode } from '@app-types/common/capability.types';

export interface CapabilityGraphqlErrorMapping {
  readonly code: string;
  readonly httpStatus: number;
  readonly errorCode: CapabilityErrorCode;
  readonly errorMessage: string;
}

export function mapCapabilityErrorToGraphql(input: {
  readonly error: CapabilityError;
}): CapabilityGraphqlErrorMapping {
  return {
    ...resolveGraphqlCategory(input.error.code),
    errorCode: input.error.code,
    errorMessage: input.error.message,
  };
}

function resolveGraphqlCategory(
  code: CapabilityErrorCode,
): Pick<CapabilityGraphqlErrorMapping, 'code' | 'httpStatus'> {
  switch (code) {
    case 'CAPABILITY_DISABLED':
    case 'CAPABILITY_OPERATION_DISABLED':
      return { code: 'FORBIDDEN', httpStatus: 403 };
    case 'CAPABILITY_IDEMPOTENCY_CONFLICT':
      return { code: 'CONFLICT', httpStatus: 409 };
    case 'CAPABILITY_TEMPORARILY_UNAVAILABLE':
    case 'CAPABILITY_PROVIDER_UNAVAILABLE':
    case 'CAPABILITY_INTERNAL_ERROR':
      return { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500 };
  }
}
