// src/infrastructure/capability/capability-error.mapper.spec.ts
import type { CapabilityErrorCode } from '@app-types/common/capability.types';
import { mapCapabilityErrorToGraphql } from './capability-error.mapper';

describe('mapCapabilityErrorToGraphql', () => {
  it.each<{
    readonly code: CapabilityErrorCode;
    readonly graphqlCode: string;
    readonly httpStatus: number;
  }>([
    { code: 'CAPABILITY_DISABLED', graphqlCode: 'FORBIDDEN', httpStatus: 403 },
    { code: 'CAPABILITY_OPERATION_DISABLED', graphqlCode: 'FORBIDDEN', httpStatus: 403 },
    { code: 'CAPABILITY_IDEMPOTENCY_CONFLICT', graphqlCode: 'CONFLICT', httpStatus: 409 },
    {
      code: 'CAPABILITY_TEMPORARILY_UNAVAILABLE',
      graphqlCode: 'INTERNAL_SERVER_ERROR',
      httpStatus: 500,
    },
    {
      code: 'CAPABILITY_PROVIDER_UNAVAILABLE',
      graphqlCode: 'INTERNAL_SERVER_ERROR',
      httpStatus: 500,
    },
    { code: 'CAPABILITY_INTERNAL_ERROR', graphqlCode: 'INTERNAL_SERVER_ERROR', httpStatus: 500 },
  ])('maps $code to GraphQL category', ({ code, graphqlCode, httpStatus }) => {
    expect(
      mapCapabilityErrorToGraphql({
        error: {
          code,
          message: 'capability failed',
        },
      }),
    ).toEqual({
      code: graphqlCode,
      httpStatus,
      errorCode: code,
      errorMessage: 'capability failed',
    });
  });
});
