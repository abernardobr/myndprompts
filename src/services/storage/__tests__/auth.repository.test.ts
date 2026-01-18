import { describe, it, expect } from 'vitest';
import { setupStorageTests } from './setup';
import { getAuthRepository } from '../repositories/auth.repository';

describe('AuthRepository', () => {
  setupStorageTests();

  it('should return undefined when no user is authenticated', async () => {
    const repo = getAuthRepository();
    const user = await repo.getCurrentUser();
    expect(user).toBeUndefined();
  });

  it('should set and get current user', async () => {
    const repo = getAuthRepository();

    await repo.setCurrentUser({
      email: 'test@example.com',
      displayName: 'Test User',
      lastLoginAt: new Date(),
    });

    const user = await repo.getCurrentUser();
    expect(user).toBeDefined();
    expect(user?.email).toBe('test@example.com');
    expect(user?.displayName).toBe('Test User');
  });

  it('should update tokens', async () => {
    const repo = getAuthRepository();

    await repo.setCurrentUser({
      email: 'test@example.com',
      displayName: 'Test User',
      lastLoginAt: new Date(),
    });

    const expiresAt = new Date(Date.now() + 3600000);
    await repo.updateTokens('access-token-123', 'refresh-token-456', expiresAt);

    const user = await repo.getCurrentUser();
    expect(user?.googleAccessToken).toBe('access-token-123');
    expect(user?.googleRefreshToken).toBe('refresh-token-456');
  });

  it('should check if user is authenticated', async () => {
    const repo = getAuthRepository();

    expect(await repo.isAuthenticated()).toBe(false);

    await repo.setCurrentUser({
      email: 'test@example.com',
      displayName: 'Test User',
      lastLoginAt: new Date(),
    });

    expect(await repo.isAuthenticated()).toBe(true);
  });

  it('should logout user', async () => {
    const repo = getAuthRepository();

    await repo.setCurrentUser({
      email: 'test@example.com',
      displayName: 'Test User',
      lastLoginAt: new Date(),
    });

    expect(await repo.isAuthenticated()).toBe(true);

    await repo.logout();

    expect(await repo.isAuthenticated()).toBe(false);
  });

  it('should check token expiration', async () => {
    const repo = getAuthRepository();

    // No user - token should be considered expired
    expect(await repo.isTokenExpired()).toBe(true);

    // User with future expiration
    await repo.setCurrentUser({
      email: 'test@example.com',
      displayName: 'Test User',
      lastLoginAt: new Date(),
      tokenExpiresAt: new Date(Date.now() + 3600000),
    });

    expect(await repo.isTokenExpired()).toBe(false);

    // User with past expiration
    await repo.setCurrentUser({
      email: 'test@example.com',
      displayName: 'Test User',
      lastLoginAt: new Date(),
      tokenExpiresAt: new Date(Date.now() - 1000),
    });

    expect(await repo.isTokenExpired()).toBe(true);
  });
});
