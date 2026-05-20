// test/01-auth/auth-identity.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TokenHelper } from '@src/modules/auth/token.helper';

import { IdentityTypeEnum, LoginTypeEnum } from '@app-types/models/account.types';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { UserState } from '@app-types/models/user-info.types';
import { initGraphQLSchema } from '@src/adapters/api/graphql/schema/schema.init';
import { ApiModule } from '@src/bootstraps/api/api.module';
import { CreateAccountUsecase } from '@src/usecases/account/create-account.usecase';
import { cleanupTestAccounts, seedTestAccounts, testAccountsConfig } from '../utils/test-accounts';

/**
 * Auth 通用角色映射 E2E 测试
 */
describe('Auth Identity (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let createAccountUsecase: CreateAccountUsecase;
  let tokenHelper: TokenHelper;

  // 直接使用统一测试账号配置
  const { coach, customer, manager, learner } = testAccountsConfig;

  beforeAll(async () => {
    // 初始化 GraphQL Schema
    initGraphQLSchema();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ApiModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    createAccountUsecase = moduleFixture.get<CreateAccountUsecase>(CreateAccountUsecase);
    tokenHelper = moduleFixture.get<TokenHelper>(TokenHelper);

    await app.init();
    await app.listen(0);

    // 使用统一的测试账号创建函数
    await seedTestAccounts({
      dataSource,
      createAccountUsecase,
      includeKeys: ['coach', 'customer', 'manager', 'learner'],
    });

    console.log('✅ 使用统一测试账号创建成功');
  }, 30000);

  afterAll(async () => {
    // 清理测试账号
    await cleanupTestAccounts(dataSource);

    if (app) {
      await app.close();
    }
  });

  /**
   * 执行 GraphQL 登录请求
   */
  const performLogin = async (
    loginName: string,
    loginPassword: string,
    type: LoginTypeEnum = LoginTypeEnum.PASSWORD,
    audience: string = 'DESKTOP',
    ip: string = '127.0.0.1',
  ) => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation Login($input: AuthLoginInput!) {
            login(input: $input) {
              accessToken
              refreshToken
              accountId
              role
              userInfo {
                userInfoId: id
                accountId
                nickname
                gender
                birthDate
                avatarUrl
                email
                signature
                accessGroup
                address
                phone
                tags
                geographic
                notifyCount
                unreadCount
                userState
                createdAt
                updatedAt
              }
            }
          }
        `,
        variables: {
          input: {
            loginName,
            loginPassword,
            type,
            audience,
            ip,
          },
        },
      });

    if (response.body?.errors?.length) {
      throw new Error(JSON.stringify(response.body.errors));
    }

    return response;
  };

  describe('Coach 身份完整测试', () => {
    it('应该支持 Coach 用户登录成功', async () => {
      const response = await performLogin(coach.loginName, coach.loginPassword);

      const { data } = response.body;
      expect(data?.login.accountId).toBeDefined();
      expect(data?.login.accessToken).toBeDefined();
      expect(data?.login.refreshToken).toBeDefined();
      expect(data?.login.role).toBe(IdentityTypeEnum.STAFF);
      expect(typeof data?.login.accessToken).toBe('string');
      expect(typeof data?.login.refreshToken).toBe('string');

      const payload = tokenHelper.decodeToken({ token: data!.login.accessToken });
      expect(payload?.activeRole).toBe(IdentityTypeEnum.STAFF);
      expect(payload?.accessGroup).toContain(IdentityTypeEnum.STAFF);
    });

    it('应该正确返回 Coach 用户信息', async () => {
      const response = await performLogin(coach.loginName, coach.loginPassword);

      const { data } = response.body;
      expect(data?.login.userInfo).toBeDefined();
      expect(data?.login.userInfo.nickname).toBeDefined();
      expect(data?.login.userInfo.email).toBe(coach.loginEmail);
      expect(data?.login.userInfo.accessGroup).toContain(IdentityTypeEnum.STAFF);
      expect(data?.login.userInfo.userState).toBe(UserState.ACTIVE);
    });
  });

  describe('Customer 身份完整测试', () => {
    it('应该支持 Customer 用户登录成功', async () => {
      const response = await performLogin(customer.loginName, customer.loginPassword);

      const { data } = response.body;
      expect(data?.login.accountId).toBeDefined();
      expect(data?.login.accessToken).toBeDefined();
      expect(data?.login.refreshToken).toBeDefined();
      expect(data?.login.role).toBe(IdentityTypeEnum.GUEST);
      expect(typeof data?.login.accessToken).toBe('string');
      expect(typeof data?.login.refreshToken).toBe('string');

      const payload = tokenHelper.decodeToken({ token: data!.login.accessToken });
      expect(payload?.activeRole).toBe(IdentityTypeEnum.GUEST);
      expect(payload?.accessGroup).toContain(IdentityTypeEnum.GUEST);
    });

    it('应该正确返回 Customer 用户信息', async () => {
      const response = await performLogin(customer.loginName, customer.loginPassword);

      const { data } = response.body;
      expect(data?.login.userInfo).toBeDefined();
      expect(data?.login.userInfo.nickname).toBeDefined();
      expect(data?.login.userInfo.email).toBe(customer.loginEmail);
      expect(data?.login.userInfo.accessGroup).toContain(IdentityTypeEnum.GUEST);
      expect(data?.login.userInfo.userState).toBe(UserState.ACTIVE);
    });
  });

  describe('Manager 身份完整测试', () => {
    it('应该支持 Manager 用户登录成功', async () => {
      const response = await performLogin(manager.loginName, manager.loginPassword);

      const { data } = response.body;
      expect(data?.login.accountId).toBeDefined();
      expect(data?.login.accessToken).toBeDefined();
      expect(data?.login.refreshToken).toBeDefined();
      expect(data?.login.role).toBe(IdentityTypeEnum.STAFF);
      expect(typeof data?.login.accessToken).toBe('string');
      expect(typeof data?.login.refreshToken).toBe('string');

      const payload = tokenHelper.decodeToken({ token: data!.login.accessToken });
      expect(payload?.activeRole).toBe(IdentityTypeEnum.STAFF);
      expect(payload?.accessGroup).toContain(IdentityTypeEnum.STAFF);
    });

    it('应该正确返回 Manager 用户信息', async () => {
      const response = await performLogin(manager.loginName, manager.loginPassword);

      const { data } = response.body;
      expect(data?.login.userInfo).toBeDefined();
      expect(data?.login.userInfo.nickname).toBeDefined();
      expect(data?.login.userInfo.email).toBe(manager.loginEmail);
      expect(data?.login.userInfo.accessGroup).toContain(IdentityTypeEnum.STAFF);
      expect(data?.login.userInfo.userState).toBe(UserState.ACTIVE);
    });
  });

  describe('Learner 身份完整测试', () => {
    it('应该支持 Learner 用户登录成功', async () => {
      const response = await performLogin(learner.loginName, learner.loginPassword);

      const { data } = response.body;
      expect(data?.login.accountId).toBeDefined();
      expect(data?.login.accessToken).toBeDefined();
      expect(data?.login.refreshToken).toBeDefined();
      expect(data?.login.role).toBe(IdentityTypeEnum.GUEST);
      expect(typeof data?.login.accessToken).toBe('string');
      expect(typeof data?.login.refreshToken).toBe('string');

      const payload = tokenHelper.decodeToken({ token: data!.login.accessToken });
      expect(payload?.activeRole).toBe(IdentityTypeEnum.GUEST);
      expect(payload?.accessGroup).toContain(IdentityTypeEnum.GUEST);
    });

    it('应该正确返回 Learner 用户信息', async () => {
      const response = await performLogin(learner.loginName, learner.loginPassword);

      const { data } = response.body;
      expect(data?.login.userInfo).toBeDefined();
      expect(data?.login.userInfo.nickname).toBeDefined();
      expect(data?.login.userInfo.email).toBe(learner.loginEmail);
      expect(data?.login.userInfo.accessGroup).toContain(IdentityTypeEnum.GUEST);
      expect(data?.login.userInfo.userState).toBe(UserState.ACTIVE);
    });
  });

  describe('身份角色决策测试', () => {
    it('应该正确决策 Coach 角色', async () => {
      const response = await performLogin(coach.loginName, coach.loginPassword);

      const { data } = response.body;
      expect(data?.login.role).toBe(IdentityTypeEnum.STAFF);
      expect(data?.login.userInfo.accessGroup).toContain(IdentityTypeEnum.STAFF);
    });

    it('应该正确决策 Customer 角色', async () => {
      const response = await performLogin(customer.loginName, customer.loginPassword);

      const { data } = response.body;
      expect(data?.login.role).toBe(IdentityTypeEnum.GUEST);
      expect(data?.login.userInfo.accessGroup).toContain(IdentityTypeEnum.GUEST);
    });

    it('应该正确决策 Manager 角色', async () => {
      const response = await performLogin(manager.loginName, manager.loginPassword);

      const { data } = response.body;
      expect(data?.login.role).toBe(IdentityTypeEnum.STAFF);
      expect(data?.login.userInfo.accessGroup).toContain(IdentityTypeEnum.STAFF);
    });

    it('应该正确决策 Learner 角色', async () => {
      const response = await performLogin(learner.loginName, learner.loginPassword);

      const { data } = response.body;
      expect(data?.login.role).toBe(IdentityTypeEnum.GUEST);
      expect(data?.login.userInfo.accessGroup).toContain(IdentityTypeEnum.GUEST);
    });
  });

  describe('JWT Token 验证', () => {
    it('Coach 登录应该返回有效的 JWT Token', async () => {
      const response = await performLogin(coach.loginName, coach.loginPassword);

      const { data } = response.body;
      const accessToken = data?.login.accessToken;
      const refreshToken = data?.login.refreshToken;

      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();
      expect(typeof accessToken).toBe('string');
      expect(typeof refreshToken).toBe('string');
      expect(accessToken.split('.')).toHaveLength(3);
      expect(refreshToken.split('.')).toHaveLength(3);
    });

    it('Customer 登录应该返回有效的 JWT Token', async () => {
      const response = await performLogin(customer.loginName, customer.loginPassword);

      const { data } = response.body;
      const accessToken = data?.login.accessToken;
      const refreshToken = data?.login.refreshToken;

      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();
      expect(typeof accessToken).toBe('string');
      expect(typeof refreshToken).toBe('string');
      expect(accessToken.split('.')).toHaveLength(3);
      expect(refreshToken.split('.')).toHaveLength(3);
    });

    it('Manager 登录应该返回有效的 JWT Token', async () => {
      const response = await performLogin(manager.loginName, manager.loginPassword);

      const { data } = response.body;
      const accessToken = data?.login.accessToken;
      const refreshToken = data?.login.refreshToken;

      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();
      expect(typeof accessToken).toBe('string');
      expect(typeof refreshToken).toBe('string');
      expect(accessToken.split('.')).toHaveLength(3);
      expect(refreshToken.split('.')).toHaveLength(3);
    });

    it('Learner 登录应该返回有效的 JWT Token', async () => {
      const response = await performLogin(learner.loginName, learner.loginPassword);

      const { data } = response.body;
      const accessToken = data?.login.accessToken;
      const refreshToken = data?.login.refreshToken;

      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();
      expect(typeof accessToken).toBe('string');
      expect(typeof refreshToken).toBe('string');
      expect(accessToken.split('.')).toHaveLength(3);
      expect(refreshToken.split('.')).toHaveLength(3);
    });
  });

  afterAll(async () => {
    try {
      // 检查数据库连接状态，只有在连接有效时才进行清理
      if (dataSource && dataSource.isInitialized) {
        await cleanupTestAccounts(dataSource);
      }
    } catch (error) {
      console.error('afterAll 清理失败:', error);
    } finally {
      // 确保应用正确关闭，添加延迟以允许 WebSocket 服务器优雅关闭
      if (app) {
        try {
          await app.close();
          // 给 WebSocket 服务器一些时间来完成清理
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (closeError) {
          const msg = (closeError as Error)?.message ?? String(closeError);
          if (!/server is not running/i.test(msg)) {
            console.warn('应用关闭时出现警告:', closeError);
          }
        }
      }
    }
  });
});
