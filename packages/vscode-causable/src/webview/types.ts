/**
 * Shared type declarations for webview components
 */

/**
 * VS Code Webview API
 * Available in webview context via acquireVsCodeApi()
 */
export interface VSCodeAPI {
  postMessage: (message: any) => void;
  setState: (state: any) => void;
  getState: () => any;
}

/**
 * Type declaration for VS Code API acquisition function
 */
declare global {
  function acquireVsCodeApi(): VSCodeAPI;
}

export {};
