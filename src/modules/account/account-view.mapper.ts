import type { AccountSnapshot } from './account.types';
import type { AccountEntity } from './base/entities/account.entity';

export function toAccountSnapshot(account: AccountEntity): AccountSnapshot {
  return {
    id: account.id,
    loginName: account.loginName,
    loginEmail: account.loginEmail,
    status: account.status,
    identityHint: account.identityHint,
    recentLoginHistory: account.recentLoginHistory || null,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}
