/**
 * Copyright 2022 Cisco Systems, Inc. and its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode';
import { WebviewReqMsg } from '../../common';
import { getNonce } from '../util/extUtils';
import { vscodeCommandExecuteMsgInterceptor } from '../msgInterceptorsInExtension';

export class WelcomePanelProvider {
  /**
   * Track the currently panel. Only allow a single panel to exist at a time.
   */
  // eslint-disable-next-line no-use-before-define
  public static currentPanel: WelcomePanelProvider | undefined;

  public static readonly viewType = 'welcome-panel';

  public readonly panel: vscode.WebviewPanel;

  private readonly extensionUri: vscode.Uri;

  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    // Set the webview's initial html content
    this.update();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programatically
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  public static async createOrShow(extensionUri: vscode.Uri, title?: string) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    const panelTitle: string = title || 'Welcome';

    // If we already have a panel, show it.
    if (WelcomePanelProvider.currentPanel) {
      WelcomePanelProvider.currentPanel.panel.reveal(column);
      WelcomePanelProvider.currentPanel.panel.title = panelTitle;
    } else {
      // Otherwise, create a new panel.
      const panel = vscode.window.createWebviewPanel(
        WelcomePanelProvider.viewType,
        // "API Details",
        panelTitle,
        column || vscode.ViewColumn.One,
        {
          // Enable javascript in the webview
          enableScripts: true,
          retainContextWhenHidden: true,

          // And restrict the webview to only loading content
          // from our extension's `media` directory.
          localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, 'node_modules/@vscode'),
            vscode.Uri.joinPath(extensionUri, 'media'),
            vscode.Uri.joinPath(extensionUri, 'webviews'),
            vscode.Uri.joinPath(extensionUri, 'dist'),
          ],
        },
      );

      WelcomePanelProvider.currentPanel = new WelcomePanelProvider(
        panel,
        extensionUri,
      );
    }
  }

  private async update() {
    const { webview } = this.panel;
    this.panel.webview.html = this.getHtmlForWebview(webview);

    webview.onDidReceiveMessage(async (msg: WebviewReqMsg) => {
      vscodeCommandExecuteMsgInterceptor(webview, msg);
    });
  }

  public static kill() {
    WelcomePanelProvider.currentPanel?.dispose();
    WelcomePanelProvider.currentPanel = undefined;
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    WelcomePanelProvider.currentPanel = new WelcomePanelProvider(
      panel,
      extensionUri,
    );
  }

  public dispose() {
    WelcomePanelProvider.currentPanel = undefined;
    // Clean up our resources
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) {
        d.dispose();
      }
    }
  }

  private getHtmlForWebview(webview: vscode.Webview) {
    // // And the uri we use to load this script in the webview
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'welcome.bundle.js'),
    );
    const styleAntdLightUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'antd.light.css'),
    );
    const styleAntdDarkUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'antd.dark.css'),
    );
    // Uri to load styles into webview
    const stylesResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'reset.css'),
    );
    const stylesMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'vscode.css'),
    );

    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
        'node_modules',
        '@vscode/codicons',
        'dist',
        'codicon.css',
      ),
    );

    // // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
    <html lang="en">
    <head> 
     <meta charset="UTF-8">
     <!--
      Use a content security policy to only allow loading images from https or from our extension directory,
      and only allow scripts that have a specific nonce.
         -->
        <meta name="viewport" content="width=device-width, initial-scale=1.0">

        <link href="${stylesResetUri}" rel="stylesheet">
        <link href="${stylesMainUri}" rel="stylesheet">
        <link href="${codiconsUri}" rel="stylesheet">
        <script nonce="${nonce}">
        const styleAntdLightUri="${styleAntdLightUri}"
         const styleAntdDarkUri="${styleAntdDarkUri}"
        const webviewVsc = acquireVsCodeApi();
        </script>
        </head>
        <body>
            <div id="app"></div>

        </body>
        <script src="${scriptUri}" nonce="${nonce}">
    </html>`;
  }
}
