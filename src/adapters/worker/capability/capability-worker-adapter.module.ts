import { Module } from '@nestjs/common';
import { CapabilityDispatchHandler } from './capability-dispatch.handler';
import { CapabilityDispatchProcessor } from './capability-dispatch.processor';

@Module({
  providers: [CapabilityDispatchHandler, CapabilityDispatchProcessor],
})
export class CapabilityWorkerAdapterModule {}
