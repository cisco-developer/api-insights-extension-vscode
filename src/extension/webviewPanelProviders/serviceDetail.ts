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
import { APIService } from '../../types';
import {
  postAPIServiceMsgToWebview,
  postReloadSidebarMsgToWebview,
  postUploadHistoryUpdateToWebview,
} from '../toWebviewMsgSender';
import {
  getConfigurationMsgInterceptor,
  vscodeCommandExecuteMsgInterceptor,
  // saveFileMsgInterceptor,
  sendRequestMsgInterceptor,
  vscodeGetObjectValueMsgInterceptor,
  getSpecsAnalysesInterceptor,
  openFileInterceptor,
} from '../msgInterceptorsInExtension';
import { API_SERVICE_MST_TYPES } from '../../common';
import { clearGlobalStateStorage, getNonce } from '../util/extUtils';
import { setStoreServices } from '../store';
import { SidebarWebviewProvider } from './serviceList';
import { uploadMemCache } from '../fileViewer';

// eslint-disable-next-line import/prefer-default-export
export class APIServicePanelProvider {
  /**
   * Track the currently panel. Only allow a single panel to exist at a time.
   */
  // eslint-disable-next-line no-use-before-define
  public static currentPanel: APIServicePanelProvider | undefined;

  public static readonly viewType = 'info-panel';

  public readonly panel: vscode.WebviewPanel;

  private readonly extensionUri: vscode.Uri;

  private apiService: any;

  private disposables: vscode.Disposable[] = [];

  private creator: SidebarWebviewProvider | null = null;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    apiService?: APIService,
  ) {
    this.panel = panel;
    this.apiService = apiService;
    this.extensionUri = extensionUri;
    // Set the webview's initial html content
    this.update();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programatically
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  private static getPanelTitle(apiService: APIService) {
    const { title } = apiService;
    if (title) {
      return title ? `${title} ` : 'API Details';
    }
    return 'API Details';
  }

  public static async createOrShow(
    extensionUri: vscode.Uri,
    apiService: APIService,
    title?: string,
    creator?: SidebarWebviewProvider,
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    const panelTitle: string = title || this.getPanelTitle(apiService);

    // If we already have a panel, show it.
    if (APIServicePanelProvider.currentPanel) {
      APIServicePanelProvider.currentPanel.panel.reveal(column);
      APIServicePanelProvider.currentPanel.panel.title = panelTitle;
      APIServicePanelProvider.currentPanel.apiService = apiService;
      postAPIServiceMsgToWebview(
        APIServicePanelProvider.currentPanel.panel.webview,
        apiService,
      );
      postUploadHistoryUpdateToWebview(
        APIServicePanelProvider.currentPanel.panel.webview,
      );
      console.log(
        'finished post api info changed msg',
        new Date().toLocaleString(),
      );
    } else {
      // Otherwise, create a new panel.
      const panel = vscode.window.createWebviewPanel(
        APIServicePanelProvider.viewType,
        // "API Details",
        panelTitle,
        column || vscode.ViewColumn.One,
        {
          // Enable javascript in the webview
          enableScripts: true,
          retainContextWhenHidden: true,

          // eslint-disable-next-line max-len
          // And restrict the webview to only loading content from our extension's `media` directory.
          localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, 'node_modules/@vscode'),
            vscode.Uri.joinPath(extensionUri, 'media'),
            vscode.Uri.joinPath(extensionUri, 'webviews'),
            vscode.Uri.joinPath(extensionUri, 'dist'),
          ],
        },
      );

      APIServicePanelProvider.currentPanel = new APIServicePanelProvider(
        panel,
        extensionUri,
        apiService,
      );
      APIServicePanelProvider.currentPanel.apiService = apiService;
      if (creator) {
        APIServicePanelProvider.currentPanel.creator = creator;
      }
    }
  }

  private async update() {
    const { webview } = this.panel;
    this.panel.webview.html = this.getHtmlForWebview(webview);

    webview.onDidReceiveMessage(async (data) => {
      getConfigurationMsgInterceptor(webview, data);

      sendRequestMsgInterceptor(webview, data);

      getConfigurationMsgInterceptor(webview, data);

      // saveFileMsgInterceptor(webview, data);

      vscodeCommandExecuteMsgInterceptor(webview, data);

      vscodeGetObjectValueMsgInterceptor(webview, data);

      getSpecsAnalysesInterceptor(webview, data);

      openFileInterceptor(webview, data);

      if (data.type === API_SERVICE_MST_TYPES.APP_IS_READY) {
        postAPIServiceMsgToWebview(webview, this.apiService);
        postUploadHistoryUpdateToWebview(this.panel.webview);
      }
    });
    uploadMemCache.on(uploadMemCache.updateEventName, () => {
      postUploadHistoryUpdateToWebview(this.panel.webview);
    });
  }

  public static reveal() {
    if (!APIServicePanelProvider.currentPanel) return;

    setStoreServices([]);

    clearGlobalStateStorage();

    postAPIServiceMsgToWebview(
      APIServicePanelProvider.currentPanel?.panel.webview,
      APIServicePanelProvider.currentPanel?.apiService,
    );
    APIServicePanelProvider.currentPanel?.panel.reveal();

    postReloadSidebarMsgToWebview(
      APIServicePanelProvider.currentPanel?.creator?.view?.webview,
    );
  }

  public static kill() {
    APIServicePanelProvider.currentPanel?.dispose();
    APIServicePanelProvider.currentPanel = undefined;
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    APIServicePanelProvider.currentPanel = new APIServicePanelProvider(
      panel,
      extensionUri,
    );
  }

  public dispose() {
    APIServicePanelProvider.currentPanel = undefined;
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
      vscode.Uri.joinPath(
        this.extensionUri,
        'dist',
        'service-detail.bundle.js',
      ),
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
        <meta http-equiv="Content-Security-Policy" content="style-src 'unsafe-inline' ${webview.cspSource}; script-src 'nonce-${nonce}' 'self' blob:;">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">

        <link href="${stylesResetUri}" rel="stylesheet">
        <link href="${stylesMainUri}" rel="stylesheet">
        <link href="${codiconsUri}" rel="stylesheet">
        <script nonce="${nonce}">
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
