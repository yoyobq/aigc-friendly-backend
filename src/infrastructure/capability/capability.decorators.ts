// src/infrastructure/capability/capability.decorators.ts
import type {
  CapabilityId,
  CapabilityAnchor,
  CapabilityHealthCheck,
  CapabilityOperationKind,
  CapabilityProcess,
  CapabilityProviderKind,
  CapabilityRuntimeContribution,
} from '@app-types/common/capability.types';
import { DiscoveryService } from '@nestjs/core';

export interface CapabilityProviderBindingMetadata {
  readonly capabilityId: CapabilityId;
  readonly providerKind: CapabilityProviderKind;
  readonly providerName: string;
}

export interface CapabilityQueueBindingMetadata {
  readonly capabilityId: CapabilityId;
  readonly operation: string;
  readonly operationKind: CapabilityOperationKind;
  readonly queueName: string;
  readonly jobName: string;
  readonly dedupKeyMapping?: 'jobId' | 'bullmq-dedup-option' | 'none';
}

export interface CapabilityHealthCheckMetadata {
  readonly capabilityId: CapabilityId;
  readonly name: string;
}

export interface CapabilityOperationHandlerMetadata {
  readonly capabilityId: CapabilityId;
  readonly operation: string;
  readonly operationKind: Exclude<CapabilityOperationKind, 'event'>;
  readonly processes?: readonly CapabilityProcess[];
}

export interface CapabilityEventSubscriberMetadata {
  readonly capabilityId: CapabilityId;
  readonly event: string;
  readonly processes?: readonly CapabilityProcess[];
}

export interface CapabilitySessionIdentityResolverMetadata {
  readonly capabilityId: CapabilityId;
  readonly resolverName: string;
}

export interface CapabilitySessionAuthoritySummaryResolverMetadata {
  readonly capabilityId: CapabilityId;
  readonly resolverName: string;
}

export interface CapabilitySessionAuthorityScopeAuthorizerMetadata {
  readonly capabilityId: CapabilityId;
  readonly authorizerName: string;
}

export const CAPABILITY_ANCHOR_DISCOVERABLE = DiscoveryService.createDecorator<CapabilityAnchor>();
export const CAPABILITY_RUNTIME_CONTRIBUTION_DISCOVERABLE =
  DiscoveryService.createDecorator<CapabilityRuntimeContribution>();
export const CAPABILITY_PROVIDER_BINDING_DISCOVERABLE =
  DiscoveryService.createDecorator<CapabilityProviderBindingMetadata>();
export const CAPABILITY_QUEUE_BINDING_DISCOVERABLE =
  DiscoveryService.createDecorator<CapabilityQueueBindingMetadata>();
export const CAPABILITY_HEALTH_CHECK_DISCOVERABLE =
  DiscoveryService.createDecorator<CapabilityHealthCheckMetadata>();
export const CAPABILITY_OPERATION_HANDLER_DISCOVERABLE =
  DiscoveryService.createDecorator<CapabilityOperationHandlerMetadata>();
export const CAPABILITY_EVENT_SUBSCRIBER_DISCOVERABLE =
  DiscoveryService.createDecorator<CapabilityEventSubscriberMetadata>();
export const CAPABILITY_SESSION_IDENTITY_RESOLVER_DISCOVERABLE =
  DiscoveryService.createDecorator<CapabilitySessionIdentityResolverMetadata>();
export const CAPABILITY_SESSION_AUTHORITY_SUMMARY_RESOLVER_DISCOVERABLE =
  DiscoveryService.createDecorator<CapabilitySessionAuthoritySummaryResolverMetadata>();
export const CAPABILITY_SESSION_AUTHORITY_SCOPE_AUTHORIZER_DISCOVERABLE =
  DiscoveryService.createDecorator<CapabilitySessionAuthorityScopeAuthorizerMetadata>();

export const CAPABILITY_ANCHOR_METADATA_KEY = CAPABILITY_ANCHOR_DISCOVERABLE.KEY;
export const CAPABILITY_RUNTIME_CONTRIBUTION_METADATA_KEY =
  CAPABILITY_RUNTIME_CONTRIBUTION_DISCOVERABLE.KEY;
export const CAPABILITY_PROVIDER_BINDING_METADATA_KEY =
  CAPABILITY_PROVIDER_BINDING_DISCOVERABLE.KEY;
export const CAPABILITY_QUEUE_BINDING_METADATA_KEY = CAPABILITY_QUEUE_BINDING_DISCOVERABLE.KEY;
export const CAPABILITY_HEALTH_CHECK_METADATA_KEY = CAPABILITY_HEALTH_CHECK_DISCOVERABLE.KEY;
export const CAPABILITY_OPERATION_HANDLER_METADATA_KEY =
  CAPABILITY_OPERATION_HANDLER_DISCOVERABLE.KEY;
export const CAPABILITY_EVENT_SUBSCRIBER_METADATA_KEY =
  CAPABILITY_EVENT_SUBSCRIBER_DISCOVERABLE.KEY;
export const CAPABILITY_SESSION_IDENTITY_RESOLVER_METADATA_KEY =
  CAPABILITY_SESSION_IDENTITY_RESOLVER_DISCOVERABLE.KEY;
export const CAPABILITY_SESSION_AUTHORITY_SUMMARY_RESOLVER_METADATA_KEY =
  CAPABILITY_SESSION_AUTHORITY_SUMMARY_RESOLVER_DISCOVERABLE.KEY;
export const CAPABILITY_SESSION_AUTHORITY_SCOPE_AUTHORIZER_METADATA_KEY =
  CAPABILITY_SESSION_AUTHORITY_SCOPE_AUTHORIZER_DISCOVERABLE.KEY;

// eslint-disable-next-line @typescript-eslint/naming-convention
export function CapabilityAnchorProvider(anchor: CapabilityAnchor): ClassDecorator {
  return CAPABILITY_ANCHOR_DISCOVERABLE(anchor);
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function CapabilityRuntimeContributionProvider(
  contribution: CapabilityRuntimeContribution,
): ClassDecorator {
  return CAPABILITY_RUNTIME_CONTRIBUTION_DISCOVERABLE(contribution);
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function CapabilityProviderBindingProvider(
  metadata: CapabilityProviderBindingMetadata,
): ClassDecorator {
  return CAPABILITY_PROVIDER_BINDING_DISCOVERABLE(metadata);
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function CapabilityQueueBindingProvider(
  metadata: CapabilityQueueBindingMetadata,
): ClassDecorator {
  return CAPABILITY_QUEUE_BINDING_DISCOVERABLE(metadata);
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function CapabilityHealthCheckProvider(
  metadata: CapabilityHealthCheckMetadata,
): ClassDecorator {
  return CAPABILITY_HEALTH_CHECK_DISCOVERABLE(metadata);
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function CapabilityOperationHandlerProvider(
  metadata: CapabilityOperationHandlerMetadata,
): ClassDecorator {
  return CAPABILITY_OPERATION_HANDLER_DISCOVERABLE(metadata);
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function CapabilityEventSubscriberProvider(
  metadata: CapabilityEventSubscriberMetadata,
): ClassDecorator {
  return CAPABILITY_EVENT_SUBSCRIBER_DISCOVERABLE(metadata);
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function CapabilitySessionIdentityResolverProvider(
  metadata: CapabilitySessionIdentityResolverMetadata,
): ClassDecorator {
  return CAPABILITY_SESSION_IDENTITY_RESOLVER_DISCOVERABLE(metadata);
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function CapabilitySessionAuthoritySummaryResolverProvider(
  metadata: CapabilitySessionAuthoritySummaryResolverMetadata,
): ClassDecorator {
  return CAPABILITY_SESSION_AUTHORITY_SUMMARY_RESOLVER_DISCOVERABLE(metadata);
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function CapabilitySessionAuthorityScopeAuthorizerProvider(
  metadata: CapabilitySessionAuthorityScopeAuthorizerMetadata,
): ClassDecorator {
  return CAPABILITY_SESSION_AUTHORITY_SCOPE_AUTHORIZER_DISCOVERABLE(metadata);
}

export function isCapabilityHealthCheck(value: unknown): value is CapabilityHealthCheck {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { readonly check?: unknown };
  return typeof candidate.check === 'function';
}
