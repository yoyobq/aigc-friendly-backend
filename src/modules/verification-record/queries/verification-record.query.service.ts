// src/modules/verification-record/queries/verification-record.query.service.ts
import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { VerificationRecordType } from '@app-types/models/verification-record.types';
import { Injectable } from '@nestjs/common';
import {
  VerificationReadService,
  VerificationRecordDetailView,
  VerificationRecordView,
} from '../services/verification-read.service';
import { VerificationRecordEntity } from '../verification-record.entity';

export type { VerificationRecordDetailView, VerificationRecordView };

@Injectable()
export class VerificationRecordQueryService {
  constructor(private readonly verificationReadService: VerificationReadService) {}

  async isTokenExists(
    token: string,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<boolean> {
    return await this.verificationReadService.isTokenExists(token, transactionContext);
  }

  async findActiveConsumableByToken(params: {
    token: string;
    forAccountId?: number;
    expectedType?: VerificationRecordType;
    ignoreTargetRestriction?: boolean;
    now?: Date;
    transactionContext?: PersistenceTransactionContext;
  }): Promise<VerificationRecordView | null> {
    return await this.verificationReadService.findActiveConsumableByToken(params);
  }

  async findActiveConsumableById(params: {
    recordId: number;
    forAccountId?: number;
    expectedType?: VerificationRecordType;
    ignoreTargetRestriction?: boolean;
    now?: Date;
    transactionContext?: PersistenceTransactionContext;
  }): Promise<VerificationRecordView | null> {
    return await this.verificationReadService.findActiveConsumableById(params);
  }

  async getTargetAccountIdByRecordId(params: {
    recordId: number;
    transactionContext?: PersistenceTransactionContext;
  }): Promise<number | null> {
    return await this.verificationReadService.getTargetAccountIdByRecordId(params);
  }

  toCleanView(record: VerificationRecordEntity): VerificationRecordView {
    return this.verificationReadService.toCleanView(record);
  }

  toDetailView(record: VerificationRecordEntity): VerificationRecordDetailView {
    return this.verificationReadService.toDetailView(record);
  }
}
