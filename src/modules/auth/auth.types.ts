import type { AccountStatus, IdentityTypeEnum } from '@app-types/models/account.types';

export interface LoginUserDataCollection {
  userWithAccessGroup: {
    id: number;
    loginEmail: string | null;
    accessGroup: IdentityTypeEnum[];
  };
  account: {
    id: number;
    loginName: string | null;
    loginEmail: string | null;
    status: AccountStatus;
    identityHint: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  userInfo: {
    id: number;
    accountId: number;
    nickname: string;
    avatarUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}
