import { Injectable } from '@nestjs/common';
import type {
  CapabilityPermissionCheckInput,
  CapabilityPermissionChecker,
} from '@src/usecases/common/ports/capability-bus.contract';

@Injectable()
export class AllowAllCapabilityPermissionChecker implements CapabilityPermissionChecker {
  canAccess(_input: CapabilityPermissionCheckInput): Promise<boolean> {
    return Promise.resolve(true);
  }
}
