// Set this to your HTTPS API before producing a store release.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
export const APP_VERSION = '1.0.0';
export function validateApiUrl(url: string, development: boolean) {
  if (!/^https:\/\//.test(url) && !(development && /^http:\/\//.test(url))) {
    throw new Error('Configure an HTTPS Koreva API for release builds.');
  }
  return url.replace(/\/$/, '');
}
