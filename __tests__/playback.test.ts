import { validateApiUrl } from '../src/config';
import { clampPosition } from '../src/storage/progress';
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
it('rejects cleartext release APIs and permits local development', () => {
  expect(() => validateApiUrl('http://localhost:3000', false)).toThrow('HTTPS');
  expect(validateApiUrl('https://api.example.com/', false)).toBe(
    'https://api.example.com',
  );
  expect(validateApiUrl('http://localhost:3000', true)).toContain('localhost');
});
it('bounds resumed playback to the part duration', () => {
  expect(clampPosition(-1, 30)).toBe(0);
  expect(clampPosition(500, 30)).toBe(28);
  expect(clampPosition(NaN, 30)).toBe(0);
});
