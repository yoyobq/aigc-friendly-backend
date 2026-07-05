// src/infrastructure/capability/platform-capability.declarations.ts
import { Injectable } from '@nestjs/common';
import { CapabilityManifestProvider } from './capability.decorators';

@Injectable()
@CapabilityManifestProvider({
  id: 'platform.account',
  kind: 'platform',
  displayName: 'Platform Account',
  version: '0.1.0',
  processes: ['api', 'worker'],
  runtime: {
    defaultState: 'enabled',
    isReadonly: true,
  },
})
export class PlatformAccountCapabilityDeclaration {}

@Injectable()
@CapabilityManifestProvider({
  id: 'platform.auth',
  kind: 'platform',
  displayName: 'Platform Auth',
  version: '0.1.0',
  processes: ['api', 'worker'],
  runtime: {
    defaultState: 'enabled',
    isReadonly: true,
  },
})
export class PlatformAuthCapabilityDeclaration {}
