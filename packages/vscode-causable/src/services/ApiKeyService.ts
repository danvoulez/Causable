import * as vscode from 'vscode';

/**
 * Service for securely storing and retrieving the Causable API key
 * Uses VS Code's SecretStorage API
 */
export class ApiKeyService {
  private static readonly API_KEY_SECRET = 'causable.apiKey';
  private static readonly API_URL_KEY = 'causable.apiUrl';
  private static readonly DEFAULT_API_URL = 'http://localhost:8000';

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Store the API key securely
   */
  async setApiKey(apiKey: string): Promise<void> {
    await this.context.secrets.store(ApiKeyService.API_KEY_SECRET, apiKey);
  }

  /**
   * Retrieve the stored API key
   */
  async getApiKey(): Promise<string | undefined> {
    return await this.context.secrets.get(ApiKeyService.API_KEY_SECRET);
  }

  /**
   * Delete the stored API key
   */
  async deleteApiKey(): Promise<void> {
    await this.context.secrets.delete(ApiKeyService.API_KEY_SECRET);
  }

  /**
   * Store the API URL
   */
  async setApiUrl(url: string): Promise<void> {
    await this.context.globalState.update(ApiKeyService.API_URL_KEY, url);
  }

  /**
   * Retrieve the stored API URL
   */
  async getApiUrl(): Promise<string> {
    return this.context.globalState.get(
      ApiKeyService.API_URL_KEY,
      ApiKeyService.DEFAULT_API_URL
    );
  }

  /**
   * Check if API key is configured
   */
  async hasApiKey(): Promise<boolean> {
    const apiKey = await this.getApiKey();
    return apiKey !== undefined && apiKey.length > 0;
  }
}
