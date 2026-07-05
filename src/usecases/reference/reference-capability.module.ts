// src/usecases/reference/reference-capability.module.ts
import { Module } from '@nestjs/common';
import {
  ReferenceProfileCapabilityDeclaration,
  ReferenceReportCapabilityDeclaration,
} from './reference-capability.providers';
import { ReferenceProfileListByGroupKeysHandler } from './reference-profile-list-by-group-keys.handler';

@Module({
  providers: [
    ReferenceProfileCapabilityDeclaration,
    ReferenceReportCapabilityDeclaration,
    ReferenceProfileListByGroupKeysHandler,
  ],
  exports: [
    ReferenceProfileCapabilityDeclaration,
    ReferenceReportCapabilityDeclaration,
    ReferenceProfileListByGroupKeysHandler,
  ],
})
export class ReferenceCapabilityModule {}
