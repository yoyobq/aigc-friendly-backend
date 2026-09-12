import type { VerificationRecordEntity } from './verification-record.entity';
import type {
  VerificationRecordView,
  VerificationRecordDetailView,
  VerificationRecordPublicPayload,
} from './verification-record.types';

/**
 * 从原始 payload 中提取公开的非敏感字段
 *
 * @param payload 原始载荷数据
 * @returns 公开载荷数据
 */
export function extractPublicPayload(
  payload: Record<string, unknown> | null,
): VerificationRecordPublicPayload | null {
  if (!payload) {
    return null;
  }

  const publicPayload: VerificationRecordPublicPayload = {};

  // 白名单：只提取非敏感的公开字段
  const allowedFields = [
    'audience',
    'flowId',
    'title',
    'description',
    'issuer',
    'verifyUrl',
    'inviteUrl',
    'roleName',
    'avatarUrl',
    'remark',
    'department',
    'orgId',
    'projectId',
  ];

  for (const field of allowedFields) {
    if (payload[field] !== undefined) {
      let value = payload[field];

      // 对 URL 字段进行安全净化，移除敏感查询参数和 hash
      if ((field === 'verifyUrl' || field === 'inviteUrl') && typeof value === 'string') {
        const sanitizedValue = sanitizeUrl(value);
        // 如果净化失败（返回 null），则不包含该字段
        if (sanitizedValue !== null) {
          value = sanitizedValue;
        } else {
          // 跳过该字段，不添加到 publicPayload 中
          continue;
        }
      }

      publicPayload[field] = value;
    }
  }

  return Object.keys(publicPayload).length > 0 ? publicPayload : null;
}

/**
 * 净化 URL，移除敏感查询参数和 hash 片段
 *
 * 安全策略：
 * - 保留 origin + pathname
 * - 只保留白名单查询参数（如 utm_ 系列）
 * - 明确排除敏感参数（token、code、signature 等）
 * - 移除 hash 片段
 *
 * @param url 原始 URL
 * @returns 净化后的安全 URL，解析失败时返回 null
 */
function sanitizeUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);

    // 敏感参数黑名单（精确匹配）
    const sensitiveParams = new Set([
      'token',
      'code',
      'signature',
      'secret',
      'key',
      'auth',
      'access_token',
      'refresh_token',
      'session',
      'sid',
      'csrf',
      'nonce',
      'state',
      'ticket',
    ]);

    // 安全参数前缀白名单
    const safeParamPrefixes = ['utm_', 'fb_', 'gclid', 'fbclid'];

    // 安全参数精确匹配白名单
    const safeParamExact = new Set([
      'ref',
      'source',
      'from',
      'lang',
      'locale',
      'theme',
      'version',
      'page',
      'tab',
      'view',
    ]);

    // 创建新的 URLSearchParams，只保留安全参数
    const newSearchParams = new URLSearchParams();

    for (const [key, value] of urlObj.searchParams.entries()) {
      const lowerKey = key.toLowerCase();

      // 检查是否为敏感参数（精确匹配）
      const isSensitive = sensitiveParams.has(lowerKey);

      // 检查是否为安全参数（前缀匹配或精确匹配）
      const isSafePrefix = safeParamPrefixes.some((prefix) => lowerKey.startsWith(prefix));
      const isSafeExact = safeParamExact.has(lowerKey);
      const isSafe = isSafePrefix || isSafeExact;

      // 只保留安全参数，排除敏感参数
      if (isSafe && !isSensitive) {
        newSearchParams.append(key, value);
      }
    }

    // 构建净化后的 URL：origin + pathname + 安全查询参数
    const sanitizedUrl = new URL(urlObj.origin + urlObj.pathname);
    sanitizedUrl.search = newSearchParams.toString();

    return sanitizedUrl.toString();
  } catch {
    // 如果 URL 解析失败，返回 null 而不是空字符串
    // console.warn(`URL 净化失败: ${url}`, error);
    return null;
  }
}

/**
 * 转换为清洁的记录视图
 * 隐藏敏感信息，只返回必要的字段
 *
 * @param record 验证记录实体
 * @returns 清洁的记录视图
 */
export function toCleanView(record: VerificationRecordEntity): VerificationRecordView {
  return {
    id: record.id,
    type: record.type,
    status: record.status,
    expiresAt: record.expiresAt,
    notBefore: record.notBefore,
    targetAccountId: record.targetAccountId,
    subjectType: record.subjectType,
    subjectId: record.subjectId,
    publicPayload: extractPublicPayload(record.payload),
    issuedByAccountId: record.issuedByAccountId,
    createdAt: record.createdAt,
    // 注意：不包含 tokenFp、consumedByAccountId、consumedAt、updatedAt 等敏感信息
    // 注意：不包含原始 payload，避免泄露 email/phone 等 PII 信息
  };
}

export function toDetailView(record: VerificationRecordEntity): VerificationRecordDetailView {
  return {
    id: record.id,
    type: record.type,
    status: record.status,
    expiresAt: record.expiresAt,
    notBefore: record.notBefore,
    targetAccountId: record.targetAccountId,
    subjectType: record.subjectType,
    subjectId: record.subjectId,
    payload: record.payload,
    issuedByAccountId: record.issuedByAccountId,
    consumedByAccountId: record.consumedByAccountId,
    consumedAt: record.consumedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
