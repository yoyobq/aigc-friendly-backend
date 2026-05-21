// src/modules/third-party-auth/queries/third-party-auth.query.service.ts
import { ThirdPartyProviderEnum } from '@app-types/models/account.types';
import { ThirdPartyAuthView } from '@app-types/models/third-party-auth.types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ThirdPartyAuthEntity } from '../third-party-auth.entity';

@Injectable()
export class ThirdPartyAuthQueryService {
  constructor(
    @InjectRepository(ThirdPartyAuthEntity)
    private readonly thirdPartyAuthRepository: Repository<ThirdPartyAuthEntity>,
  ) {}

  async findAccountByThirdParty(params: {
    readonly provider: ThirdPartyProviderEnum;
    readonly providerUserId: string;
  }): Promise<ThirdPartyAuthView | null> {
    const record = await this.thirdPartyAuthRepository.findOne({
      where: { provider: params.provider, providerUserId: params.providerUserId },
      select: [
        'id',
        'accountId',
        'provider',
        'providerUserId',
        'unionId',
        'createdAt',
        'updatedAt',
      ],
    });
    return record ? this.toView(record) : null;
  }

  async getThirdPartyAuths(accountId: number): Promise<ThirdPartyAuthView[]> {
    const records = await this.thirdPartyAuthRepository.find({
      where: { accountId },
      select: [
        'id',
        'accountId',
        'provider',
        'providerUserId',
        'unionId',
        'createdAt',
        'updatedAt',
      ],
    });
    return records.map((record) => ({
      id: record.id,
      accountId: record.accountId,
      provider: record.provider,
      providerUserId: record.providerUserId,
      unionId: record.unionId ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));
  }

  async findThirdPartyAuthByAccountId(
    accountId: number,
    provider: ThirdPartyProviderEnum,
  ): Promise<ThirdPartyAuthView | null> {
    const record = await this.thirdPartyAuthRepository.findOne({
      where: { accountId, provider },
      select: [
        'id',
        'accountId',
        'provider',
        'providerUserId',
        'unionId',
        'createdAt',
        'updatedAt',
      ],
    });
    return record ? this.toView(record) : null;
  }

  private toView(record: ThirdPartyAuthEntity): ThirdPartyAuthView {
    return {
      id: record.id,
      accountId: record.accountId,
      provider: record.provider,
      providerUserId: record.providerUserId,
      unionId: record.unionId ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
