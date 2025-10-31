import * as vscode from 'vscode';
import { SidebarProvider } from './SidebarProvider';
import { ApiKeyService } from './services/ApiKeyService';

export function activate(context: vscode.ExtensionContext) {
  console.log('Causable extension is now active!');

  // Initialize API key service
  const apiKeyService = new ApiKeyService(context);

  // Register sidebar provider
  const sidebarProvider = new SidebarProvider(context.extensionUri, apiKeyService);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'causable.timelineView',
      sidebarProvider
    )
  );

  // Register command to set API key
  context.subscriptions.push(
    vscode.commands.registerCommand('causable.setApiKey', async () => {
      const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your Causable Cloud API Key',
        password: true,
        placeHolder: 'Your API key from the Causable Cloud dashboard',
      });

      if (apiKey) {
        await apiKeyService.setApiKey(apiKey);
        vscode.window.showInformationMessage('Causable API key saved successfully!');
        // Notify the webview to reconnect
        sidebarProvider.refresh();
      }
    })
  );

  // Register command to set API URL
  context.subscriptions.push(
    vscode.commands.registerCommand('causable.setApiUrl', async () => {
      const currentUrl = await apiKeyService.getApiUrl();
      const apiUrl = await vscode.window.showInputBox({
        prompt: 'Enter the Causable Cloud API URL',
        value: currentUrl || 'http://localhost:8000',
        placeHolder: 'http://localhost:8000',
      });

      if (apiUrl) {
        await apiKeyService.setApiUrl(apiUrl);
        vscode.window.showInformationMessage('Causable API URL saved successfully!');
        // Notify the webview to reconnect
        sidebarProvider.refresh();
      }
    })
  );

  // Create status bar item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = '$(circle-outline) Causable';
  statusBarItem.tooltip = 'Causable: Disconnected';
  statusBarItem.command = 'workbench.view.extension.causable-sidebar';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Store status bar item for updates
  context.workspaceState.update('statusBarItem', statusBarItem);
}

export function deactivate() {
  console.log('Causable extension is now deactivated');
}
