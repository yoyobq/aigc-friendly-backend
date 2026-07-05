// src/infrastructure/capability/capability-error.mapper.spec.ts
import type { CapabilityErrorCode } from '@app-types/common/capability.types';
import { DomainError } from '@core/common/errors/domain-error';
import {
  mapCapabilityErrorToGraphql,
  mapThrownErrorToCapabilityError,
} from './capability-error.mapper';

describe('mapCapabilityErrorToGraphql', () => {
  it.each<{
    readonly code: CapabilityErrorCode;
    readonly graphqlCode: string;
    readonly httpStatus: number;
  }>([
    {
      code: 'CAPABILITY_NOT_INSTALLED',
      graphqlCode: 'INTERNAL_SERVER_ERROR',
      httpStatus: 500,
    },
    { code: 'CAPABILITY_DISABLED', graphqlCode: 'FORBIDDEN', httpStatus: 403 },
    { code: 'CAPABILITY_OPERATION_DISABLED', graphqlCode: 'FORBIDDEN', httpStatus: 403 },
    { code: 'CAPABILITY_OPERATION_NOT_FOUND', graphqlCode: 'BAD_USER_INPUT', httpStatus: 400 },
    { code: 'CAPABILITY_PERMISSION_DENIED', graphqlCode: 'FORBIDDEN', httpStatus: 403 },
    { code: 'CAPABILITY_VALIDATION_FAILED', graphqlCode: 'BAD_USER_INPUT', httpStatus: 400 },
    { code: 'CAPABILITY_TIMEOUT', graphqlCode: 'INTERNAL_SERVER_ERROR', httpStatus: 500 },
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
    {
      code: 'CAPABILITY_TRANSPORT_UNAVAILABLE',
      graphqlCode: 'INTERNAL_SERVER_ERROR',
      httpStatus: 500,
    },
    {
      code: 'CAPABILITY_CONTRACT_VERSION_UNSUPPORTED',
      graphqlCode: 'BAD_USER_INPUT',
      httpStatus: 400,
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

  it('folds DomainError into CapabilityError with cause code details', () => {
    expect(
      mapThrownErrorToCapabilityError({
        error: new DomainError('TEST_DOMAIN_ERROR', 'domain failed', { field: 'name' }),
        capabilityId: 'test.capability',
        operation: 'publish',
      }),
    ).toEqual({
      code: 'CAPABILITY_VALIDATION_FAILED',
      message: 'domain failed',
      capabilityId: 'test.capability',
      operation: 'publish',
      details: {
        causeCode: 'TEST_DOMAIN_ERROR',
        causeDetails: { field: 'name' },
      },
    });
  });
});
