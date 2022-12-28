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
import {
  getConfigurationMsgInterceptor,
  openAPIServicePanelMsgInterceptor,
  openNativeSettingMsgInterceptor,
  sendRequestMsgInterceptor,
  vscodeCommandExecuteMsgInterceptor,
} from '../msgInterceptorsInExtension';
import { WebviewReqMsg } from '../../common';
import { APIService } from '../../types';
import { APIServicePanelProvider } from './serviceDetail';
import { getNonce } from '../util/extUtils';

export class SidebarWebviewProvider implements vscode.WebviewViewProvider {
  view?: vscode.WebviewView;

  _doc?: vscode.TextDocument;

  // eslint-disable-next-line no-useless-constructor
  constructor(private readonly extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;

    // Allow scripts in the webview
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (msg: WebviewReqMsg) => {
      vscodeCommandExecuteMsgInterceptor(webviewView.webview, msg);
      sendRequestMsgInterceptor(webviewView.webview, msg);
      getConfigurationMsgInterceptor(webviewView.webview, msg);
      openNativeSettingMsgInterceptor(webviewView.webview, msg);
      openAPIServicePanelMsgInterceptor(msg, (apiService: APIService) => {
        APIServicePanelProvider.createOrShow(
          this.extensionUri,
          // this._client,
          apiService,
          undefined,
          this,
        );
      });
    });
  }

  public revive(panel: vscode.WebviewView) {
    this.view = panel;
  }

  private getHtmlForWebview(webview: vscode.Webview) {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'service-list.css'),
    );
    const styleAntdLightUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'antd.light.css'),
    );
    const styleAntdDarkUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'antd.dark.css'),
    );
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'reset.css'),
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'vscode.css'),
    );

    const darkLogoUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'api-insights-dark.svg'),
    );
    const lightLogoUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'api-insights-light.svg'),
    );

    const successUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'success.png'),
    );

    const errorUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'error.png'),
    );

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'service-list.bundle.js'),
    );
    const sharedUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'shared.bundle.js'),
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
    // <link href="https://cdnjs.cloudflare.com/ajax/libs/antd/4.19.5/antd.dark.min.css" rel="prefetch">
    //     <link href="https://cdnjs.cloudflare.com/ajax/libs/antd/4.19.5/antd.dark.css" rel="prefetch">
    // Use a nonce to only allow a specific script to be run.
    const nonce = getNonce();

    return `
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <!--
             Use a content security policy to only allow loading images from https or from our extension directory,
             and only allow scripts that have a specific nonce.
        -->
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleResetUri}" rel="stylesheet">
        <link href="${styleVSCodeUri}" rel="stylesheet">
        <link href="${codiconsUri}" rel="stylesheet">
        <link href="${styleUri}" rel="stylesheet">
        <script nonce="${nonce}">
         const darkLogoUri = "${darkLogoUri}"
         const lightLogoUri = "${lightLogoUri}"
         const successUri = "${successUri}"
         const errorUri = "${errorUri}"
         const styleAntdLightUri="${styleAntdLightUri}"
         const styleAntdDarkUri="${styleAntdDarkUri}"
         const webviewVsc = acquireVsCodeApi();
        </script>
    </head>
    <body>
        <div id="app"></div>
    </body>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</html>
`;
  }
}
