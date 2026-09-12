import { toCleanView } from '../verification-record-view.mapper';
// src/modules/verification-record/queries/verification-read.query.service.ts

import { AudienceTypeEnum } from '@app-types/models/account.types';
import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import {
  VerificationRecordStatus,
  VerificationRecordType,
} from '@app-types/models/verification-record.types';
import { DomainError, VERIFICATION_RECORD_ERROR } from '@core/common/errors/domain-error';
import { TokenFingerprintHelper } from '@modules/common/security/token-fingerprint.helper';
import { Injectable } from '@nestjs/common';
import { VerificationRecordReadRepository } from '../repositories/verification-record.read.repo';
import { VerificationRecordEntity } from '../verification-record.entity';
import type { VerificationRecordView } from '../verification-record.types';

/**
 * 验证记录聚合读取 QueryService
 * 提供高级查询和校验功能，返回清洁的记录视图
 *
 * 职责范围：
 * - 聚合读取操作（结合多个查询条件）
 * - 基础校验逻辑（状态、时效性、上下文匹配）
 * - 返回清洁的记录视图（隐藏敏感信息）
 * - 业务规则验证
 */
@Injectable()
export class VerificationReadQueryService {
  constructor(private readonly readRepository: VerificationRecordReadRepository) {}

  async isTokenExists(
    token: string,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<boolean> {
    const tokenFp = TokenFingerprintHelper.generateTokenFingerprint({ token });
    return await this.readRepository.tokenFingerprintExists(tokenFp, transactionContext);
  }

  async findActiveConsumableByToken(params: {
    token: string;
    forAccountId?: number;
    expectedType?: VerificationRecordType;
    ignoreTargetRestriction?: boolean;
    now?: Date;
    transactionContext?: PersistenceTransactionContext;
  }): Promise<VerificationRecordView | null> {
    const tokenFp = TokenFingerprintHelper.generateTokenFingerprint({ token: params.token });
    const record = await this.readRepository.findActiveConsumableRecord({
      where: { tokenFp },
      forAccountId: params.forAccountId,
      expectedType: params.expectedType,
      ignoreTargetRestriction: params.ignoreTargetRestriction,
      now: params.now,
      transactionContext: params.transactionContext,
    });
    return record ? toCleanView(record) : null;
  }

  async findActiveConsumableById(params: {
    recordId: number;
    forAccountId?: number;
    expectedType?: VerificationRecordType;
    ignoreTargetRestriction?: boolean;
    now?: Date;
    transactionContext?: PersistenceTransactionContext;
  }): Promise<VerificationRecordView | null> {
    const record = await this.readRepository.findActiveConsumableRecord({
      where: { id: params.recordId },
      forAccountId: params.forAccountId,
      expectedType: params.expectedType,
      ignoreTargetRestriction: params.ignoreTargetRestriction,
      now: params.now,
      transactionContext: params.transactionContext,
    });
    return record ? toCleanView(record) : null;
  }

  async getTargetAccountIdByRecordId(params: {
    recordId: number;
    transactionContext?: PersistenceTransactionContext;
  }): Promise<number | null> {
    return await this.readRepository.getTargetAccountIdByRecordId(params);
  }

  /**
   * 根据 token 查找可消费的验证记录
   *
   * 包含完整的业务校验：
   * - 记录存在性
   * - 状态校验（必须为 ACTIVE）
   * - 时效性校验（未过期且已生效）
   * - 上下文匹配校验（可选）
   *
   * @param token 明文 token
   * @param audience 客户端类型（可选，用于上下文校验）
   * @param email 邮箱地址（可选，用于上下文校验）
   * @param phone 手机号码（可选，用于上下文校验）
   * @returns 清洁的验证记录视图
   */
  async findConsumableRecord(
    token: string,
    audience?: AudienceTypeEnum | null,
    email?: string | null,
    phone?: string | null,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<VerificationRecordView> {
    // 生成 token 指纹（不掺入 audience）
    const tokenFp = TokenFingerprintHelper.generateTokenFingerprint({ token });

    // 查找活跃记录
    const record = await this.readRepository.findActiveByTokenFp(tokenFp, transactionContext);
    if (!record) {
      throw new DomainError(VERIFICATION_RECORD_ERROR.RECORD_NOT_FOUND, '验证记录不存在或已失效');
    }

    // 校验记录状态
    this.validateRecordStatus(record);

    // 校验时效性
    this.validateRecordTiming(record);

    // 校验上下文匹配（通过 payload 字段）
    if (audience || email || phone) {
      this.readRepository.ensureContextMatch(record, audience, email, phone);
    }

    // 返回清洁的记录视图
    return toCleanView(record);
  }

  /**
   * 校验记录状态
   * @param record 验证记录实体
   */
  private validateRecordStatus(record: VerificationRecordEntity): void {
    if (record.status !== VerificationRecordStatus.ACTIVE) {
      const statusMessages = {
        [VerificationRecordStatus.CONSUMED]: '验证记录已被消费',
        [VerificationRecordStatus.REVOKED]: '验证记录已被撤销',
        [VerificationRecordStatus.EXPIRED]: '验证记录已过期',
      };

      const message = statusMessages[record.status] || '验证记录状态无效';

      throw new DomainError(VERIFICATION_RECORD_ERROR.RECORD_NOT_ACTIVE, message, {
        recordId: record.id,
        status: record.status,
      });
    }
  }

  /**
   * 校验记录时效性
   * @param record 验证记录实体
   */
  private validateRecordTiming(record: VerificationRecordEntity): void {
    const now = new Date();

    // 检查是否已过期（包含 180 秒宽限期）
    const gracePeriodMs = 180 * 1000; // 180 秒宽限期
    const expiresAtWithGracePeriod = new Date(record.expiresAt.getTime() + gracePeriodMs);

    if (expiresAtWithGracePeriod <= now) {
      throw new DomainError(VERIFICATION_RECORD_ERROR.RECORD_EXPIRED, '验证记录已过期', {
        recordId: record.id,
        expiresAt: record.expiresAt.toISOString(),
        currentTime: now.toISOString(),
        gracePeriodSeconds: 180,
      });
    }

    // 检查是否还未生效（如果设置了 notBefore）
    if (record.notBefore && record.notBefore > now) {
      throw new DomainError(VERIFICATION_RECORD_ERROR.RECORD_NOT_ACTIVE_YET, '验证记录尚未生效', {
        recordId: record.id,
        notBefore: record.notBefore.toISOString(),
        currentTime: now.toISOString(),
      });
    }
  }
}
