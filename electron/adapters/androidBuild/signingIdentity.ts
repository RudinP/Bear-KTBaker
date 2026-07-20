import { randomBytes } from 'node:crypto';
import {
  chmod,
  link,
  mkdir,
  readFile,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { PackageSigner } from 'android-package-signer';
import type { AndroidSigningIdentity } from './types';

class DamagedSigningIdentityError extends Error {
  constructor() {
    super(
      '저장된 Android 서명 정보가 손상되었습니다. 기존 테마를 업데이트하려면 서명 파일을 복구해야 합니다.',
    );
  }
}

function parseSigningIdentity(content: string): AndroidSigningIdentity {
  try {
    const value = JSON.parse(content) as Partial<AndroidSigningIdentity>;
    if (
      value.schema !== 1
      || typeof value.alias !== 'string'
      || value.alias.length === 0
      || typeof value.password !== 'string'
      || value.password.length < 6
      || typeof value.pkcs12DataUrl !== 'string'
      || !value.pkcs12DataUrl.startsWith('data:application/x-pkcs12;base64,')
    ) throw new Error('invalid identity');
    return value as AndroidSigningIdentity;
  } catch {
    throw new DamagedSigningIdentityError();
  }
}

interface SigningIdentityDependencies {
  randomPassword?: () => string;
  generateKey?: (
    password: string,
    alias: string,
  ) => Promise<string>;
  waitForIdentityRetry?: (attempt: number) => Promise<void>;
}

const SIGNING_IDENTITY_READ_ATTEMPTS = 5;
const signingIdentityOperations = new Map<
  string,
  Promise<AndroidSigningIdentity>
>();

export async function loadOrCreateSigningIdentity(
  identityPath: string,
  dependencies: SigningIdentityDependencies = {},
): Promise<AndroidSigningIdentity> {
  const current = signingIdentityOperations.get(identityPath);
  if (current) return current;
  const operation = loadOrCreateSigningIdentityExclusive(
    identityPath,
    dependencies,
  ).finally(() => {
    if (signingIdentityOperations.get(identityPath) === operation) {
      signingIdentityOperations.delete(identityPath);
    }
  });
  signingIdentityOperations.set(identityPath, operation);
  return operation;
}

async function loadOrCreateSigningIdentityExclusive(
  identityPath: string,
  dependencies: SigningIdentityDependencies,
): Promise<AndroidSigningIdentity> {
  try {
    return await readPersistedSigningIdentityWithRetry(
      identityPath,
      dependencies,
      false,
    );
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }

  await mkdir(path.dirname(identityPath), { recursive: true });
  const alias = 'kakaotheme';
  const password = dependencies.randomPassword?.() ?? randomBytes(24).toString('base64url');
  const generateKey = dependencies.generateKey ?? (async (keyPassword: string, keyAlias: string) => {
    const signer = new PackageSigner(keyPassword, keyAlias);
    return signer.generateKey({
      commonName: 'KakaoTalk Theme Studio',
      organizationName: 'KakaoTalk Theme Studio',
      organizationUnit: 'Local Theme Export',
      countryCode: 'KR',
    });
  });
  const identity: AndroidSigningIdentity = {
    schema: 1,
    alias,
    password,
    pkcs12DataUrl: await generateKey(password, alias),
  };
  const temporaryPath = `${identityPath}.${process.pid}.${
    randomBytes(12).toString('hex')
  }.tmp`;
  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify(identity, null, 2)}\n`,
      {
        mode: 0o600,
        flag: 'wx',
        flush: true,
      },
    );
    try {
      await link(temporaryPath, identityPath);
      await chmod(identityPath, 0o600);
      return identity;
    } catch (error) {
      if (
        error instanceof Error
        && 'code' in error
        && error.code === 'EEXIST'
      ) {
        return readPersistedSigningIdentityWithRetry(
          identityPath,
          dependencies,
          true,
        );
      }
      throw error;
    }
  } finally {
    try {
      await unlink(temporaryPath);
    } catch (error) {
      if (!(
        error instanceof Error
        && 'code' in error
        && error.code === 'ENOENT'
      )) {
        throw error;
      }
    }
  }
}

async function readPersistedSigningIdentityWithRetry(
  identityPath: string,
  dependencies: SigningIdentityDependencies,
  retryMissing: boolean,
) {
  let lastError: unknown;
  for (
    let attempt = 0;
    attempt < SIGNING_IDENTITY_READ_ATTEMPTS;
    attempt += 1
  ) {
    try {
      return await readPersistedSigningIdentity(identityPath);
    } catch (error) {
      const missing = error instanceof Error
        && 'code' in error
        && error.code === 'ENOENT';
      if (
        !(error instanceof DamagedSigningIdentityError)
        && !(retryMissing && missing)
      ) {
        throw error;
      }
      lastError = error;
      if (attempt === SIGNING_IDENTITY_READ_ATTEMPTS - 1) {
        break;
      }
      if (dependencies.waitForIdentityRetry) {
        await dependencies.waitForIdentityRetry(attempt);
      } else {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 20);
        });
      }
    }
  }
  throw lastError;
}

async function readPersistedSigningIdentity(
  identityPath: string,
): Promise<AndroidSigningIdentity> {
  const identity = parseSigningIdentity(
    await readFile(identityPath, 'utf8'),
  );
  await chmod(identityPath, 0o600);
  return identity;
}
