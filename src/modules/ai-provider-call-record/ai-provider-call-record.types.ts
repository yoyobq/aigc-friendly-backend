import { RECORD_SOURCES, type RecordSource } from '@app-types/common/record-source.types';

export const AI_PROVIDER_CALL_RECORD_SOURCES = RECORD_SOURCES;

export type AiProviderCallRecordSource = RecordSource;

export const AI_PROVIDER_CALL_RECORD_PROVIDER_STATUSES = ['succeeded', 'failed'] as const;

export type AiProviderCallRecordProviderStatus =
  (typeof AI_PROVIDER_CALL_RECORD_PROVIDER_STATUSES)[number];

export interface CreateAiProviderCallRecordInput {
  readonly asyncTaskRecordId?: number | null;
  readonly traceId: string;
  readonly accountId?: number | null;
  readonly nicknameSnapshot?: string | null;
  readonly bizType?: string | null;
  readonly bizKey?: string | null;
  readonly bizSubKey?: string | null;
  readonly source: AiProviderCallRecordSource;
  readonly provider: string;
  readonly model: string;
  readonly taskType: string;
  readonly providerRequestId?: string | null;
  readonly providerStatus: AiProviderCallRecordProviderStatus;
  readonly promptTokens?: number | null;
  readonly completionTokens?: number | null;
  readonly totalTokens?: number | null;
  readonly costAmount?: string | null;
  readonly costCurrency?: string | null;
  readonly normalizedErrorCode?: string | null;
  readonly providerErrorCode?: string | null;
  readonly errorMessage?: string | null;
  readonly providerStartedAt?: Date | null;
  readonly providerFinishedAt?: Date | null;
  readonly providerLatencyMs?: number | null;
}

export interface UpdateAiProviderCallRecordPatch {
  readonly providerRequestId?: string | null;
  readonly providerStatus?: AiProviderCallRecordProviderStatus;
  readonly promptTokens?: number | null;
  readonly completionTokens?: number | null;
  readonly totalTokens?: number | null;
  readonly costAmount?: string | null;
  readonly costCurrency?: string | null;
  readonly normalizedErrorCode?: string | null;
  readonly providerErrorCode?: string | null;
  readonly errorMessage?: string | null;
  readonly providerStartedAt?: Date | null;
  readonly providerFinishedAt?: Date | null;
  readonly providerLatencyMs?: number | null;
}

export interface AiProviderCallRecordView {
  readonly id: number;
  readonly asyncTaskRecordId: number | null;
  readonly traceId: string;
  readonly callSeq: number;
  readonly accountId: number | null;
  readonly nicknameSnapshot: string | null;
  readonly bizType: string | null;
  readonly bizKey: string | null;
  readonly bizSubKey: string | null;
  readonly source: AiProviderCallRecordSource;
  readonly provider: string;
  readonly model: string;
  readonly taskType: string;
  readonly providerRequestId: string | null;
  readonly providerStatus: AiProviderCallRecordProviderStatus;
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
  readonly totalTokens: number | null;
  readonly costAmount: string | null;
  readonly costCurrency: string | null;
  readonly normalizedErrorCode: string | null;
  readonly providerErrorCode: string | null;
  readonly errorMessage: string | null;
  readonly providerStartedAt: Date | null;
  readonly providerFinishedAt: Date | null;
  readonly providerLatencyMs: number | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
