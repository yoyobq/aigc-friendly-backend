import { Module } from '@nestjs/common';
import { REFERENCE_PROFILE_CLIENT } from '@src/usecases/common/ports/reference-profile-client.contract';
import { DispatcherReferenceProfileClient } from './reference-profile.client';

@Module({
  providers: [
    DispatcherReferenceProfileClient,
    {
      provide: REFERENCE_PROFILE_CLIENT,
      useExisting: DispatcherReferenceProfileClient,
    },
  ],
  exports: [REFERENCE_PROFILE_CLIENT],
})
export class ReferenceProfileClientModule {}
