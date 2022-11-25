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
import { ExtensionContext } from 'vscode';
import { SidebarWebviewProvider } from './webviewPanelProviders/serviceList';
import { DiffSummaryProvider } from './webviewPanelProviders/diffSummary';
import { WelcomePanelProvider } from './webviewPanelProviders/welcome';
import { postConfigurationChangeMsgToWebview } from './toWebviewMsgSender';
import specDiagnosticsRegister from './diagnostic';
import specDiffRegister from './diff';
import fileViewerRegister from './fileViewer';
import specCompare from './compare';
import spectralLinter from './diagnostic/spectralLinter';
import {
  clearGlobalStateStorage,
  getConfiguration,
  openSetting,
  setupAxiosCache,
} from './util/extUtils';
import {
  checkConfiguration,
  handleHostBarStatusChange,
  checkIsLocal,
} from './util';

import { APIServicePanelProvider } from './webviewPanelProviders/serviceDetail';
import { CONFIG_KEY_SPEC_FORMAT, MEM_CACHE } from '../const';
import {
  WELCOME_COMMAND,
  CONFIGURE_EXPLORER_COMMAND,
} from '../commands';
import { isWebExt } from '../common';

let extensionContext: ExtensionContext;
let memCache = {};
function startAPIInsights(context: ExtensionContext) {
  // distinguish between web and extension
  if (isWebExt()) {
    specDiagnosticsRegister(context);
  } else {
    specDiagnosticsRegister(context, spectralLinter);
  }

  extensionContext = context;
  memCache = setupAxiosCache(context);
  fileViewerRegister(context);
  specDiffRegister(context);
  specCompare(context);

  const diffSummaryProvider = new DiffSummaryProvider(context.extensionUri);
  const sidebarProvider = new SidebarWebviewProvider(context.extensionUri);

  function startHandleHostBarStatusChange() {
    const isLocal = checkIsLocal();
    handleHostBarStatusChange({ isLocal });
  }
  startHandleHostBarStatusChange();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'api-insights-sidebar',
      sidebarProvider,
    ),
    vscode.window.registerWebviewViewProvider(
      'api-insights-diff-summary',
      diffSummaryProvider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
    vscode.commands.registerCommand(WELCOME_COMMAND, () => {
      WelcomePanelProvider.createOrShow(context.extensionUri);
    }),
    vscode.commands.registerCommand(
      CONFIGURE_EXPLORER_COMMAND,
      async () => {
        openSetting();
      },
    ),

    vscode.workspace.onDidChangeConfiguration(() => {
      startHandleHostBarStatusChange();
    }),
  );

  function startWelcomePanel() {
    if (!context.globalState.get(`${WELCOME_COMMAND}-has-shown`)) {
      setTimeout(() => {
        // delay the welcome page to show up so that it won't conflict with setting's display
        WelcomePanelProvider.createOrShow(context.extensionUri);
        context.globalState.update(`${WELCOME_COMMAND}-has-shown`, 'true');
      }, 3000);
    }
  }
  startWelcomePanel();

  let isLatestCfgOk = true;
  let cfgChangeId = 0;
  vscode.workspace.onDidChangeConfiguration(async (e) => {
    const currentId = cfgChangeId;
    cfgChangeId += 1;
    const cfg = getConfiguration();

    const specFormatChanged = e.affectsConfiguration(CONFIG_KEY_SPEC_FORMAT);
    if (!specFormatChanged) {
      clearGlobalStateStorage();

      const alertError = (
        msg: string,
        actionText = 'Check Settings',
        actionFn: Function = openSetting,
      ) => {
        vscode.window.showErrorMessage(msg, actionText).then((r) => {
          if (r === actionText) {
            actionFn();
          }
        });
      };

      const errorMsg = await checkConfiguration();

      if (currentId !== cfgChangeId - 1) {
        console.log('new cfg change coming, ignore');
        isLatestCfgOk = !errorMsg;
        return;
      }

      if (errorMsg) {
        alertError(errorMsg);
        if (isLatestCfgOk) {
          // @ts-ignore
          cfg.showErrorIfAny = false;
          postConfigurationChangeMsgToWebview(
            sidebarProvider.view?.webview,
            cfg,
          );
        }
        isLatestCfgOk = false;
      } else {
        isLatestCfgOk = true;
        postConfigurationChangeMsgToWebview(
          sidebarProvider.view?.webview,
          cfg,
        );
      }
    }

    postConfigurationChangeMsgToWebview(
      APIServicePanelProvider.currentPanel?.panel?.webview,
      cfg,
    );
  });
}

export function activate(context: ExtensionContext) {
  startAPIInsights(context);
}

export async function deactivate() {
  await extensionContext.globalState.update(MEM_CACHE, memCache);
  setTimeout(() => {
    console.log('deactive memCache!=>', memCache);
  }, 0);
}
