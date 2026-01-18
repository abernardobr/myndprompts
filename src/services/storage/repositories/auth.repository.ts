import { getDB } from '../db';
import { BaseRepository } from './base.repository';
import type { IUserAuth } from '../entities';

/**
 * Repository for managing user authentication state.
 *
 * Note: Only one user can be authenticated at a time in this app.
 */
export class AuthRepository extends BaseRepository<IUserAuth, string> {
  private static instance: AuthRepository | null = null;
  private static readonly CURRENT_USER_ID = 'current';

  private constructor() {
    super(getDB().userAuth);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AuthRepository {
    if (!AuthRepository.instance) {
      AuthRepository.instance = new AuthRepository();
    }
    return AuthRepository.instance;
  }

  /**
   * Get the currently authenticated user
   */
  async getCurrentUser(): Promise<IUserAuth | undefined> {
    return this.getById(AuthRepository.CURRENT_USER_ID);
  }

  /**
   * Set the current authenticated user
   */
  async setCurrentUser(user: Omit<IUserAuth, 'id'>): Promise<void> {
    await this.upsert({
      ...user,
      id: AuthRepository.CURRENT_USER_ID,
    });
  }

  /**
   * Update the current user's tokens
   */
  async updateTokens(accessToken: string, refreshToken?: string, expiresAt?: Date): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) {
      throw new Error('No authenticated user found');
    }

    await this.update(AuthRepository.CURRENT_USER_ID, {
      googleAccessToken: accessToken,
      googleRefreshToken: refreshToken ?? user.googleRefreshToken,
      tokenExpiresAt: expiresAt,
    });
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user !== undefined;
  }

  /**
   * Check if the access token is expired
   */
  async isTokenExpired(): Promise<boolean> {
    const user = await this.getCurrentUser();
    if (!user?.tokenExpiresAt) {
      return true;
    }
    return new Date() >= user.tokenExpiresAt;
  }

  /**
   * Log out the current user (clear auth state)
   */
  async logout(): Promise<void> {
    await this.delete(AuthRepository.CURRENT_USER_ID);
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(): Promise<void> {
    await this.update(AuthRepository.CURRENT_USER_ID, {
      lastLoginAt: new Date(),
    });
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    AuthRepository.instance = null;
  }
}

// Export a convenience function to get the repository
export function getAuthRepository(): AuthRepository {
  return AuthRepository.getInstance();
}
