import { ENGINE_VERSION } from './version';

describe('ENGINE_VERSION', () => {
  it('is the expected semver string', () => {
    expect(ENGINE_VERSION).toBe('0.1.0');
  });

  it('matches a semver-like pattern', () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
