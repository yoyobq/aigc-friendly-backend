import type { CapabilityGraphqlOperationBinding } from '@src/infrastructure/capability/capability.registry';
import { buildSchema } from 'graphql';
import {
  CapabilityGraphqlSurfaceError,
  validateCapabilityGraphqlSurface,
} from './capability-graphql-surface.check';

describe('Capability GraphQL surface check', () => {
  it('passes when declared operations exist in the schema', () => {
    const schema = buildSchema(`
      type Query {
        referenceClient: String
      }

      type Mutation {
        publishReferenceClient: Boolean
      }

      type Subscription {
        referenceClientChanged: String
      }
    `);

    expect(
      validateCapabilityGraphqlSurface({
        schema,
        operations: [
          operation('reference.session', 'referenceClient', 'query'),
          operation('reference.session', 'publishReferenceClient', 'mutation'),
          operation('reference.session', 'referenceClientChanged', 'subscription'),
        ],
      }),
    ).toEqual({ issues: [] });
  });

  it('fails when a manifest declares a missing schema operation', () => {
    const schema = buildSchema(`
      type Query {
        referenceClient: String
      }
    `);

    const result = validateCapabilityGraphqlSurface({
      schema,
      operations: [
        operation('reference.session', 'referenceClient', 'query'),
        operation('reference.session', 'missingReferenceClient', 'query'),
      ],
    });

    expect(result.issues).toEqual([
      {
        code: 'CAPABILITY_GRAPHQL_OPERATION_MISSING',
        capabilityId: 'reference.session',
        operationName: 'missingReferenceClient',
        operationKind: 'query',
        message:
          'capability_graphql_operation_missing:reference.session:query:missingReferenceClient',
      },
    ]);
    expect(() => {
      throw new CapabilityGraphqlSurfaceError(result);
    }).toThrow(CapabilityGraphqlSurfaceError);
  });

  it('does not fail for schema operations without manifest declarations', () => {
    const schema = buildSchema(`
      type Query {
        legacyResolver: String
      }
    `);

    expect(validateCapabilityGraphqlSurface({ schema, operations: [] })).toEqual({ issues: [] });
  });
});

function operation(
  capabilityId: string,
  operationName: string,
  operationKind: 'query' | 'mutation' | 'subscription',
): CapabilityGraphqlOperationBinding {
  return {
    capabilityId,
    operationName,
    operationKind,
  };
}
