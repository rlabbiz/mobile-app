/** Guest credentials remain in the platform keystore; this test exercises rotation and recovery. */
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => `key-${Math.random()}`) }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device',
}));
import * as Keychain from 'expo-secure-store';
let get = Keychain.getItemAsync as jest.Mock;
let set = Keychain.setItemAsync as jest.Mock;
const credentials = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  accessTokenExpiresIn: 900,
  userId: 'user-1',
  deviceId: 'device-1',
};
const response = (data: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => ({ data }),
});
let storage: string | null;
let fetchMock: jest.Mock;
beforeEach(() => {
  jest.resetModules();
  const keychain = require('expo-secure-store');
  get = keychain.getItemAsync;
  set = keychain.setItemAsync;
  storage = null;
  get.mockReset();
  set.mockReset();
  get.mockImplementation(async () => storage);
  set.mockImplementation(async (_name: string, value: string) => {
    storage = value;
    return { service: 'test' };
  });
  fetchMock = jest.fn();
  globalThis.fetch = fetchMock;
});
it('bootstraps once for concurrent requests and persists the key before sending', async () => {
  const { request } = require('../src/api/client');
  fetchMock.mockImplementation(async (url: string, options: RequestInit) => {
    if (url.endsWith('/auth/guest')) {
      expect(JSON.parse(storage!).pending.key).toBe(
        (options.headers as Record<string, string>)['Idempotency-Key'],
      );
      return response(credentials);
    }
    expect((options.headers as Record<string, string>).Authorization).toBe(
      'Bearer access-1',
    );
    return response({ items: [] });
  });
  await Promise.all([request('/v1/films'), request('/v1/films')]);
  expect(
    fetchMock.mock.calls.filter(([url]) => url.endsWith('/auth/guest')),
  ).toHaveLength(1);
  expect(JSON.parse(storage!).credentials.refreshToken).toBe('refresh-1');
});
it('reuses the persisted operation after an ambiguous network failure', async () => {
  storage = JSON.stringify({
    installationId: 'installation',
    credentials,
    expiresAt: 0,
  });
  const { session } = require('../src/api/client');
  fetchMock
    .mockRejectedValueOnce(new Error('connection lost'))
    .mockResolvedValueOnce(
      response({
        ...credentials,
        accessToken: 'access-2',
        refreshToken: 'refresh-2',
      }),
    );
  await expect(session()).rejects.toThrow('Cannot connect');
  const key = JSON.parse(storage!).pending.key;
  await session();
  expect(
    fetchMock.mock.calls.map(
      ([, options]) => options.headers['Idempotency-Key'],
    ),
  ).toEqual([key, key]);
  expect(JSON.parse(storage!).credentials.refreshToken).toBe('refresh-2');
  expect(JSON.parse(storage!).pending).toBeUndefined();
});
it('keeps the same user after reloading the JavaScript runtime', async () => {
  fetchMock.mockResolvedValue(response(credentials));
  const first = await require('../src/api/client').session();
  expect(first.userId).toBe('user-1');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  jest.resetModules();
  fetchMock.mockClear();
  require('expo-secure-store').getItemAsync.mockImplementation(async () => storage);
  require('expo-secure-store').setItemAsync.mockImplementation(async (_name: string, value: string) => { storage = value; });
  const reloaded = await require('../src/api/client').session();
  expect(reloaded.userId).toBe(first.userId);
  expect(reloaded.deviceId).toBe(first.deviceId);
  expect(fetchMock).not.toHaveBeenCalled();
});
it('does not create a new guest when saved identity is damaged', async () => {
  storage = '{broken';
  await expect(require('../src/api/client').session()).rejects.toThrow('saved guest session');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(storage).toBe('{broken');
});
it('does not replace a suspended guest with a new identity', async () => {
  storage = JSON.stringify({
    installationId: 'installation',
    credentials,
    expiresAt: 0,
  });
  const { session } = require('../src/api/client');
  fetchMock.mockResolvedValue({
    ok: false,
    status: 403,
    json: async () => ({ detail: 'Account suspended.' }),
  });
  await expect(session()).rejects.toThrow('Account suspended');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toContain('/guest/refresh');
});
it('never sends a bootstrap request if secure persistence fails', async () => {
  const { session } = require('../src/api/client');
  set.mockRejectedValue(new Error('secure storage failed'));
  await expect(session()).rejects.toThrow('secure guest session');
  expect(fetchMock).not.toHaveBeenCalled();
});
it('recovers the same anonymous identity after a confirmed refresh expiry', async () => {
  storage = JSON.stringify({
    installationId: 'installation',
    credentials,
    expiresAt: 0,
  });
  const { session } = require('../src/api/client');
  fetchMock
    .mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        code: 'TOKEN_EXPIRED',
        detail: 'Guest session expired.',
      }),
    })
    .mockResolvedValueOnce(response(credentials));
  expect((await session()).userId).toBe('user-1');
  expect(fetchMock.mock.calls[0][0]).toContain('/guest/refresh');
  expect(fetchMock.mock.calls[1][0]).toContain('/guest/recover');
});
it('does not bootstrap again after session revocation', async () => {
  storage = JSON.stringify({
    installationId: 'installation',
    credentials,
    expiresAt: 0,
  });
  const { session } = require('../src/api/client');
  fetchMock.mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ code: 'TOKEN_REVOKED', detail: 'Session revoked.' }),
  });
  await expect(session()).rejects.toThrow('Session revoked');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('adopts account credentials without replacing the installation or recovery identity',async()=>{
  storage=JSON.stringify({installationId:'installation',credentials:{...credentials,recoveryToken:'recovery'},expiresAt:Date.now()+900000});
  const {adoptAccountSession,session}=require('../src/api/client');
  await adoptAccountSession({...credentials,userId:'linked-user',accessToken:'linked-access'});
  expect((await session()).userId).toBe('linked-user');expect(fetchMock).not.toHaveBeenCalled();
  expect(JSON.parse(storage!)).toMatchObject({installationId:'installation',credentials:{recoveryToken:'recovery',userId:'linked-user'}});
});
it('recovers a sign-in whose response was lost without creating a new guest',async()=>{
  storage=JSON.stringify({installationId:'installation',credentials:{...credentials,recoveryToken:'recovery'},expiresAt:Date.now()+900000});
  const linked={...credentials,userId:'account-user',accessToken:'linked-access',refreshToken:'linked-refresh'};
  fetchMock.mockImplementation(async(url:string)=>{
    if(url.endsWith('/auth/login'))throw new Error('lost response');
    if(url.endsWith('/guest/refresh'))return response(linked);
    if(url.endsWith('/profile'))return response({id:'account-user',status:'linked',email:'user@example.test',displayName:'Viewer',locale:'fr'});
    throw new Error('Unexpected bootstrap');
  });
  const {changeAccount}=require('../src/api/profile');
  expect((await changeAccount('login',{email:'user@example.test',password:'valid-password-123'})).id).toBe('account-user');
  expect(JSON.parse(storage!).credentials.userId).toBe('account-user');
  expect(fetchMock.mock.calls.some(([url])=>url.endsWith('/auth/guest'))).toBe(false);
});
