// src/infrastructure/capability/capability.decorators.ts
import type {
  CapabilityId,
  CapabilityManifest,
  CapabilityOperationKind,
  CapabilityProviderKind,
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

export const CAPABILITY_MANIFEST_DISCOVERABLE =
  DiscoveryService.createDecorator<CapabilityManifest>();
export const CAPABILITY_PROVIDER_BINDING_DISCOVERABLE =
  DiscoveryService.createDecorator<CapabilityProviderBindingMetadata>();
export const CAPABILITY_QUEUE_BINDING_DISCOVERABLE =
  DiscoveryService.createDecorator<CapabilityQueueBindingMetadata>();

export const CAPABILITY_MANIFEST_METADATA_KEY = CAPABILITY_MANIFEST_DISCOVERABLE.KEY;
export const CAPABILITY_PROVIDER_BINDING_METADATA_KEY =
  CAPABILITY_PROVIDER_BINDING_DISCOVERABLE.KEY;
export const CAPABILITY_QUEUE_BINDING_METADATA_KEY = CAPABILITY_QUEUE_BINDING_DISCOVERABLE.KEY;

// eslint-disable-next-line @typescript-eslint/naming-convention
export function CapabilityManifestProvider(manifest: CapabilityManifest): ClassDecorator {
  return CAPABILITY_MANIFEST_DISCOVERABLE(manifest);
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
