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
  vscodeCommandExecuteMsgInterceptor,
} from '../msgInterceptorsInExtension';
import { WebviewReqMsg, DIFF_SUMMARY_MSG_TYPES } from '../../common';
import { DiffSummaryUpdateData } from '../../types';
import { getNonce } from '../util/extUtils';
import { postUpdateDiffSummaryMesgToWebview } from '../toWebviewMsgSender';

export class DiffSummaryProvider implements vscode.WebviewViewProvider {
  static view?: vscode.WebviewView;

  private extensionUri:vscode.Uri;

  _doc?: vscode.TextDocument;

  static updateData?: DiffSummaryUpdateData;

  constructor(extensionUri:vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    DiffSummaryProvider.view = webviewView;

    // Allow scripts in the webview
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (msg: WebviewReqMsg) => {
      vscodeCommandExecuteMsgInterceptor(webviewView.webview, msg);
      getConfigurationMsgInterceptor(webviewView.webview, msg);
      if (msg.type === DIFF_SUMMARY_MSG_TYPES.APP_IS_READY) {
        if (DiffSummaryProvider.updateData) {
          postUpdateDiffSummaryMesgToWebview(
            webviewView.webview,
            DiffSummaryProvider.updateData,
          );
        }
      }
    });
  }

  static update(data?: DiffSummaryUpdateData) {
    const webview = DiffSummaryProvider.view;
    if (data) {
      DiffSummaryProvider.updateData = data;
      if (webview) {
        postUpdateDiffSummaryMesgToWebview(webview.webview, data);
      }
    }
    if (webview) {
      webview.show();
    } else {
      vscode.commands.executeCommand(
        'workbench.view.extension.api-insights-diff-summary',
      );
    }
  }

  public revive(panel: vscode.WebviewView) {
    DiffSummaryProvider.view = panel;
  }

  private getHtmlForWebview(webview: vscode.Webview) {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'diff-summary.css'),
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

    const successUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'success.png'),
    );

    const errorUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'error.png'),
    );

    const scriptUri = webview.asWebviewUri(
      // eslint-disable-next-line no-underscore-dangle
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'diff-summary.bundle.js'),
    );
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        // eslint-disable-next-line no-underscore-dangle
        this.extensionUri,
        'node_modules',
        '@vscode/codicons',
        'dist',
        'codicon.css',
      ),
    );

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
         const successUri = "${successUri}"
         const errorUri = "${errorUri}"
         const styleAntdLightUri="${styleAntdLightUri}"
         const styleAntdDarkUri="${styleAntdDarkUri}"
         const webviewVsc = acquireVsCodeApi();
         let globalInitialized=false
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

export default DiffSummaryProvider;
