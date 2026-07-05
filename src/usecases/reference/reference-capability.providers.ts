// src/usecases/reference/reference-capability.providers.ts
import {
  REFERENCE_PROFILE_CAPABILITY_ID,
  REFERENCE_PROFILE_OPERATIONS,
} from '@app-types/reference/reference-profile.types';
import { REFERENCE_REPORT_CAPABILITY_ID } from '@app-types/reference/reference-report.types';
import { Injectable } from '@nestjs/common';
import { CapabilityManifestProvider } from '@src/infrastructure/capability/capability.decorators';

@Injectable()
@CapabilityManifestProvider({
  id: REFERENCE_PROFILE_CAPABILITY_ID,
  kind: 'business',
  displayName: 'Reference Profile',
  version: '0.1.0',
  processes: ['api'],
  operations: {
    queries: [
      {
        kind: 'query',
        name: REFERENCE_PROFILE_OPERATIONS.listByGroupKeys,
        description: 'Reference batch query owned by reference.profile.',
        transport: 'in-process',
      },
    ],
  },
})
export class ReferenceProfileCapabilityDeclaration {}

@Injectable()
@CapabilityManifestProvider({
  id: REFERENCE_REPORT_CAPABILITY_ID,
  kind: 'business',
  displayName: 'Reference Report',
  version: '0.1.0',
  processes: ['api'],
  dependsOn: [{ capabilityId: REFERENCE_PROFILE_CAPABILITY_ID, mode: 'required' }],
})
export class ReferenceReportCapabilityDeclaration {}
