// src/infrastructure/capability/capability-bootstrap-check.ts
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { CapabilityBootstrapError, CapabilityRegistry } from './capability.registry';
import { ConfigCapabilityRuntimeStateReader } from './config-capability-runtime-state.reader';

@Injectable()
export class CapabilityBootstrapCheck implements OnApplicationBootstrap {
  private readonly logger = new Logger(CapabilityBootstrapCheck.name);

  constructor(
    private readonly capabilityRegistry: CapabilityRegistry,
    private readonly runtimeStateReader: ConfigCapabilityRuntimeStateReader,
  ) {}

  onApplicationBootstrap(): void {
    const result = this.capabilityRegistry.validateBootstrap();
    for (const issue of result.issues.filter((item) => item.severity === 'warning')) {
      this.logger.warn(issue.message);
    }
    for (const warning of this.runtimeStateReader.getConfigurationWarnings()) {
      this.logger.warn(warning.message);
    }

    const blockingIssues = result.issues.filter((issue) => issue.severity !== 'warning');
    if (blockingIssues.length > 0) {
      throw new CapabilityBootstrapError({ ...result, issues: blockingIssues });
    }
  }
}
