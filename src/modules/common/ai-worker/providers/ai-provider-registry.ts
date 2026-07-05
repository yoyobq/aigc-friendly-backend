// src/modules/common/ai-worker/providers/ai-provider-registry.ts
import { DomainError, THIRDPARTY_ERROR } from '@core/common/errors/domain-error';
import { Inject, Injectable } from '@nestjs/common';
import type { AiProviderClient } from '@core/ai/ai-provider.interface';
import { CapabilityRegistry } from '@src/infrastructure/capability/capability.registry';
import { AI_PROVIDER_KIND } from '../../ai-capability/ai-capability.constants';
import { AI_PROVIDER_REGISTRY_OPTIONS, type AiProviderRegistryOptions } from '../ai-worker.options';

@Injectable()
export class AiProviderRegistry {
  constructor(
    @Inject(AI_PROVIDER_REGISTRY_OPTIONS)
    private readonly options: AiProviderRegistryOptions,
    private readonly capabilityRegistry: CapabilityRegistry,
  ) {}

  getGenerateProvider(name?: string): AiProviderClient {
    return this.resolveProvider(name);
  }

  getEmbedProvider(): AiProviderClient {
    return this.resolveProviderByName('mock');
  }

  private isMockMode(): boolean {
    return this.options.providerMode.trim().toLowerCase() === 'mock';
  }

  private resolveProviderName(inputProvider?: string): string {
    return inputProvider?.trim().toLowerCase() ?? '';
  }

  private resolveProvider(inputProvider?: string): AiProviderClient {
    if (this.isMockMode()) {
      return this.resolveProviderByName('mock');
    }
    const providerName = this.resolveProviderName(inputProvider);
    if (!providerName) {
      return this.resolveProviderByName('mock');
    }
    return this.resolveProviderByName(providerName);
  }

  private resolveProviderByName(providerName: string): AiProviderClient {
    const provider = this.capabilityRegistry.getProviderClient<AiProviderClient>({
      providerKind: AI_PROVIDER_KIND,
      providerName,
    });
    if (provider && provider.name.trim().toLowerCase() === providerName) {
      return provider;
    }
    throw new DomainError(
      THIRDPARTY_ERROR.PROVIDER_NOT_SUPPORTED,
      `unsupported_ai_provider:${providerName}`,
    );
  }
}
