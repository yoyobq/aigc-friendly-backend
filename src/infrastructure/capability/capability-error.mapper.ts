// src/infrastructure/capability/capability-error.mapper.ts
import type { CapabilityError, CapabilityErrorCode } from '@app-types/common/capability.types';
import { isDomainError } from '@core/common/errors/domain-error';

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

export function mapThrownErrorToCapabilityError(input: {
  readonly error: unknown;
  readonly capabilityId?: string;
  readonly operation?: string;
  readonly defaultDomainErrorCode?: CapabilityErrorCode;
}): CapabilityError {
  if (isDomainError(input.error)) {
    return {
      code: input.defaultDomainErrorCode ?? 'CAPABILITY_VALIDATION_FAILED',
      message: input.error.message,
      capabilityId: input.capabilityId,
      operation: input.operation,
      details: {
        causeCode: input.error.code,
        ...(input.error.details === undefined ? {} : { causeDetails: input.error.details }),
      },
    };
  }
  if (input.error instanceof Error) {
    return {
      code: 'CAPABILITY_INTERNAL_ERROR',
      message: input.error.message,
      capabilityId: input.capabilityId,
      operation: input.operation,
    };
  }
  return {
    code: 'CAPABILITY_INTERNAL_ERROR',
    message: 'capability_internal_error',
    capabilityId: input.capabilityId,
    operation: input.operation,
  };
}

function resolveGraphqlCategory(
  code: CapabilityErrorCode,
): Pick<CapabilityGraphqlErrorMapping, 'code' | 'httpStatus'> {
  switch (code) {
    case 'CAPABILITY_NOT_INSTALLED':
      return { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500 };
    case 'CAPABILITY_DISABLED':
    case 'CAPABILITY_OPERATION_DISABLED':
    case 'CAPABILITY_PERMISSION_DENIED':
      return { code: 'FORBIDDEN', httpStatus: 403 };
    case 'CAPABILITY_OPERATION_NOT_FOUND':
    case 'CAPABILITY_VALIDATION_FAILED':
    case 'CAPABILITY_CONTRACT_VERSION_UNSUPPORTED':
      return { code: 'BAD_USER_INPUT', httpStatus: 400 };
    case 'CAPABILITY_IDEMPOTENCY_CONFLICT':
      return { code: 'CONFLICT', httpStatus: 409 };
    case 'CAPABILITY_TIMEOUT':
    case 'CAPABILITY_TEMPORARILY_UNAVAILABLE':
    case 'CAPABILITY_PROVIDER_UNAVAILABLE':
    case 'CAPABILITY_TRANSPORT_UNAVAILABLE':
    case 'CAPABILITY_INTERNAL_ERROR':
      return { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500 };
  }
}
