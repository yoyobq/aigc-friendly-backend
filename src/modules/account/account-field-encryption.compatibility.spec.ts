import { ConfigService } from '@nestjs/config';
import { UserInfoEntity } from '@src/modules/account/base/entities/user-info.entity';
import { registerEncryptedField } from '@src/infrastructure/field-encryption/field-encryption.metadata';
import { FieldEncryptionService } from '@src/infrastructure/field-encryption/field-encryption.service';

// Captured with the pre-upgrade crypto-js 4.2.0 implementation; never regenerate in the test.
const LEGACY_TEXT = 'cZhdcTY/MatEpSNeIIeqOPSJtUWbnHicdMGoU0/oNgQ=';
const LEGACY_ARRAY = 'fNr8XBHx/5lBh99JA97GshtIYAEPvInAs22x37ZJ1Ww=';
const LEGACY_OBJECT = 'hXMv+lrH9A1RwW90073GBUq6+jIZLd4mzo0KrwAZERQ=';

function createService(): FieldEncryptionService {
  return new FieldEncryptionService(
    new ConfigService({
      FIELD_ENCRYPTION_KEY: '0123456789abcdef-extra-key',
      FIELD_ENCRYPTION_IV: 'fedcba9876543210-extra-iv',
    }),
  );
}

describe('Field encryption stored-data compatibility', () => {
  it('reads fixed old AES-CBC ciphertext and preserves 16-byte key/IV truncation', () => {
    const service = createService();
    expect(service.decrypt(LEGACY_TEXT)).toBe('既有密文 compatibility 🔐');
    expect(service.encrypt('既有密文 compatibility 🔐')).toBe(LEGACY_TEXT);
    expect(service.decrypt(LEGACY_ARRAY)).toBe('["USER","ADMIN"]');
    expect(service.decrypt(LEGACY_OBJECT)).toBe('{"label":"旧资料","count":2}');
  });

  it('reads an existing encrypted UserInfo field and round-trips it without changing other fields', () => {
    registerEncryptedField(UserInfoEntity, 'metaDigest');
    const service = createService();
    const entity = Object.assign(new UserInfoEntity(), {
      nickname: 'unchanged',
      metaDigest: LEGACY_ARRAY,
    });
    service.decryptEntity(entity);
    expect(entity.metaDigest).toEqual(['USER', 'ADMIN']);
    service.encryptEntity(entity);
    expect(entity.metaDigest).toBe(LEGACY_ARRAY);
    service.decryptEntity(entity);
    expect(entity.metaDigest).toEqual(['USER', 'ADMIN']);
    expect(entity.nickname).toBe('unchanged');
  });

  it('round-trips JSON objects and retains null/empty field handling', () => {
    class StoredDocument {
      value: unknown;
    }
    registerEncryptedField(StoredDocument, 'value');
    const service = createService();
    const entity: StoredDocument = Object.assign(new StoredDocument(), { value: LEGACY_OBJECT });
    service.decryptEntity(entity);
    expect(entity.value).toEqual({ label: '旧资料', count: 2 });
    service.encryptEntity(entity);
    expect(entity.value).toBe(LEGACY_OBJECT);
    for (const value of [null, '', undefined]) {
      entity.value = value;
      service.encryptEntity(entity);
      service.decryptEntity(entity);
      expect(entity.value).toBe(value);
    }
  });
});
