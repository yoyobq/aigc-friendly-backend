import { DomainError } from '@core/common/errors/domain-error';
import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  CAPABILITY_RUNTIME_STATE_READER,
  type CapabilityRuntimeStateReader,
} from '@src/usecases/common/ports/capability-runtime-state-reader.contract';
import {
  CAPABILITY_GRAPHQL_OPERATION_KEY,
  type CapabilityGraphqlOperationPolicy,
} from '../decorators/capability-graphql-operation.decorator';

@Injectable()
export class CapabilityRuntimeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(CAPABILITY_RUNTIME_STATE_READER)
    private readonly runtimeStateReader: CapabilityRuntimeStateReader,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const policy = this.reflector.getAllAndOverride<CapabilityGraphqlOperationPolicy>(
      CAPABILITY_GRAPHQL_OPERATION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!policy) {
      return true;
    }
    const state = this.runtimeStateReader.getOperationState({
      capabilityId: policy.capabilityId,
      operation: policy.operation,
      operationKind: policy.operationKind,
    });
    if (state.enabled) {
      return true;
    }
    const errorCode =
      state.reason === 'operation_disabled' || state.reason === 'manifest_default_disabled'
        ? 'CAPABILITY_OPERATION_DISABLED'
        : 'CAPABILITY_DISABLED';
    throw new DomainError(
      errorCode,
      errorCode === 'CAPABILITY_OPERATION_DISABLED'
        ? 'capability_operation_disabled'
        : 'capability_disabled',
      {
        capabilityId: policy.capabilityId,
        operation: policy.operation,
        operationKind: policy.operationKind,
        reason: state.reason,
      },
    );
  }
}
