// src/infrastructure/capability/capability-bootstrap-check.ts
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { CapabilityRegistry } from './capability.registry';

@Injectable()
export class CapabilityBootstrapCheck implements OnApplicationBootstrap {
  constructor(private readonly capabilityRegistry: CapabilityRegistry) {}

  onApplicationBootstrap(): void {
    this.capabilityRegistry.assertBootstrapValid();
  }
}
