import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiProviderCallRecordEntity } from './ai-provider-call-record.entity';
import { AiProviderCallRecordService } from './ai-provider-call-record.service';
import { AiProviderCallObservationCapabilityAnchor } from './ai-provider-call-observation.capability';

@Module({
  imports: [TypeOrmModule.forFeature([AiProviderCallRecordEntity])],
  providers: [AiProviderCallObservationCapabilityAnchor, AiProviderCallRecordService],
  exports: [TypeOrmModule, AiProviderCallRecordService],
})
export class AiProviderCallRecordModule {}
