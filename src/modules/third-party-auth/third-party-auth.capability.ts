// src/modules/third-party-auth/third-party-auth.capability.ts
import { Injectable } from '@nestjs/common';
import { CapabilityManifestProvider } from '@src/infrastructure/capability/capability.decorators';

@Injectable()
@CapabilityManifestProvider({
  id: 'third-party-auth.weapp',
  kind: 'technical',
  version: '0.1.0',
  processes: ['api'],
  runtime: { healthCheck: true },
  contributions: {
    providers: [{ providerKind: 'third-party-auth.provider', providerName: 'weapp' }],
  },
})
export class ThirdPartyAuthWeappCapabilityDeclaration {}
