import {
  CapabilityRegistry,
  type CapabilityGraphqlOperationBinding,
} from '@src/infrastructure/capability/capability.registry';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import type { GraphQLSchema } from 'graphql';

export interface CapabilityGraphqlSurfaceIssue {
  readonly code: 'CAPABILITY_GRAPHQL_OPERATION_MISSING';
  readonly capabilityId: string;
  readonly operationName: string;
  readonly operationKind: 'query' | 'mutation' | 'subscription';
  readonly message: string;
}

export interface CapabilityGraphqlSurfaceValidationResult {
  readonly issues: readonly CapabilityGraphqlSurfaceIssue[];
}

@Injectable()
export class CapabilityGraphqlSurfaceCheck implements OnApplicationBootstrap {
  constructor(
    private readonly schemaHost: GraphQLSchemaHost,
    private readonly capabilityRegistry: CapabilityRegistry,
  ) {}

  onApplicationBootstrap(): void {
    const result = validateCapabilityGraphqlSurface({
      schema: this.schemaHost.schema,
      operations: this.capabilityRegistry.getGraphqlOperationContributions(),
    });
    if (result.issues.length > 0) {
      throw new CapabilityGraphqlSurfaceError(result);
    }
  }
}

export class CapabilityGraphqlSurfaceError extends Error {
  constructor(readonly result: CapabilityGraphqlSurfaceValidationResult) {
    super(formatGraphqlSurfaceIssues(result.issues));
    this.name = 'CapabilityGraphqlSurfaceError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function validateCapabilityGraphqlSurface(input: {
  readonly schema: GraphQLSchema;
  readonly operations: readonly CapabilityGraphqlOperationBinding[];
}): CapabilityGraphqlSurfaceValidationResult {
  const operationNames = {
    query: listSchemaOperationNames(input.schema, 'query'),
    mutation: listSchemaOperationNames(input.schema, 'mutation'),
    subscription: listSchemaOperationNames(input.schema, 'subscription'),
  };
  const issues = input.operations
    .filter((operation) => !operationNames[operation.operationKind].has(operation.operationName))
    .map((operation): CapabilityGraphqlSurfaceIssue => ({
      code: 'CAPABILITY_GRAPHQL_OPERATION_MISSING',
      capabilityId: operation.capabilityId,
      operationName: operation.operationName,
      operationKind: operation.operationKind,
      message: `capability_graphql_operation_missing:${operation.capabilityId}:${operation.operationKind}:${operation.operationName}`,
    }));
  return { issues };
}

function listSchemaOperationNames(
  schema: GraphQLSchema,
  operationKind: 'query' | 'mutation' | 'subscription',
): ReadonlySet<string> {
  const operationType =
    operationKind === 'query'
      ? schema.getQueryType()
      : operationKind === 'mutation'
        ? schema.getMutationType()
        : schema.getSubscriptionType();
  if (!operationType) {
    return new Set();
  }
  return new Set(Object.keys(operationType.getFields()));
}

function formatGraphqlSurfaceIssues(issues: readonly CapabilityGraphqlSurfaceIssue[]): string {
  return `Capability GraphQL surface validation failed:\n- ${issues
    .map((issue) => issue.message)
    .join('\n- ')}`;
}
