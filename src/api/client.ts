import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { randomUUID as uuid } from 'expo-crypto';
import { API_URL, APP_VERSION, validateApiUrl } from '../config';
import type { Credentials } from './types';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}
type Saved = {
  installationId: string;
  credentials?: Credentials;
  expiresAt?: number;
  pending?: { key: string; refreshToken?: string; recoveryToken?: string; recover?: boolean };
};
const service = 'com.filmstream.mobile.session';
// Keep this key and the Expo project slug stable when changing display branding.
let saved: Saved | undefined;
let flight: Promise<Credentials> | undefined;
async function persist(value: Saved) {
  try {
    await SecureStore.setItemAsync(service, JSON.stringify(value), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  } catch {
    throw new Error('Cannot save your secure guest session.');
  }
  saved = value;
}
export async function transport<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) {
    abort();
  }
  options.signal?.addEventListener('abort', abort);
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(validateApiUrl(API_URL, __DEV__) + path, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    const body = await response.json();
    if (!response.ok) {
      throw new ApiError(
        response.status,
        body.error?.message ??
          body.detail ??
          body.message ??
          'The request could not be completed.',
        body.code ?? body.error?.code,
      );
    }
    return body.data ?? body;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new Error(
      'Cannot connect to Koreva. Check your connection and try again.',
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}
async function sessionWork(force: boolean): Promise<Credentials> {
  if (!saved) {
    const stored = await SecureStore.getItemAsync(service);
    if (stored) {
      try {
        const value = JSON.parse(stored) as Saved;
        if (!value || typeof value.installationId !== 'string' || !value.installationId ||
          (value.credentials && (!value.credentials.userId || !value.credentials.deviceId || !value.credentials.refreshToken))) {
          throw new Error('Invalid saved identity');
        }
        saved = value;
      } catch {
        // Never silently overwrite a damaged identity with a new guest.
        throw new Error('Cannot read your saved guest session. Please retry without clearing app storage.');
      }
    } else {
      await persist({ installationId: uuid() });
    }
  }
  const current = saved!;
  if (
    !force &&
    current.credentials &&
    !current.pending &&
    (current.expiresAt ?? 0) > Date.now() + 60000
  ) {
    return current.credentials;
  }
  const pending = current.pending ?? {
    key: uuid(),
    refreshToken: current.credentials?.refreshToken,
  };
  // Persist the operation key before sending. A lost response retries the SAME rotation.
  await persist({ ...current, pending });
  let credentials: Credentials;
  try {
    credentials = await transport<Credentials>(
      pending.recover ? '/v1/auth/guest/recover' : pending.refreshToken ? '/v1/auth/guest/refresh' : '/v1/auth/guest',
      {
        method: 'POST',
        headers: { 'Idempotency-Key': pending.key },
        body: JSON.stringify(
          pending.recover && pending.recoveryToken
            ? { recoveryToken: pending.recoveryToken }
            : pending.refreshToken
            ? { refreshToken: pending.refreshToken }
            : {
                installationId: current.installationId,
                platform: Platform.OS,
                appVersion: APP_VERSION,
              },
        ),
      },
    );
  } catch (error) {
    if (
      pending.refreshToken &&
      !pending.recover &&
      error instanceof ApiError &&
      error.code === 'TOKEN_EXPIRED'
    ) {
      // A verified recovery credential preserves the user and all their loves.
      await persist({
        ...current,
        pending: { key: uuid(), recover: true, refreshToken: pending.refreshToken, recoveryToken: current.credentials?.recoveryToken },
      });
      return sessionWork(false);
    }
    throw error;
  }
  await persist({
    installationId: current.installationId,
    credentials: { ...credentials, recoveryToken: credentials.recoveryToken ?? current.credentials?.recoveryToken },
    expiresAt: Date.now() + credentials.accessTokenExpiresIn * 1000,
  });
  return credentials;
}
export function session(force = false): Promise<Credentials> {
  if (!flight) {
    flight = sessionWork(force).finally(() => {
      flight = undefined;
    });
  }
  return flight;
}
export async function adoptAccountSession(credentials:Credentials){
  if(flight)await flight;
  if(!saved)await session();
  await persist({...saved!,pending:undefined,credentials:{...credentials,recoveryToken:credentials.recoveryToken??saved?.credentials?.recoveryToken},expiresAt:Date.now()+credentials.accessTokenExpiresIn*1000});
}
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let credentials = await session();
  const send = () =>
    transport<T>(path, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${credentials.accessToken}`,
      },
    });
  try {
    return await send();
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }
    // Another request may already have rotated the token while this one was in flight.
    credentials =
      saved?.credentials?.accessToken !== credentials.accessToken
        ? await session()
        : await session(true);
    return send();
  }
}
