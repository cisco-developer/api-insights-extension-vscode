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
  window, ExtensionContext, TextDocument, workspace, Uri, languages,
} from 'vscode';

import {
  specAnalyze,
  CancelToken,
  CancelTokenSourceType,
  fetchAnalyzersMeta,
} from '../services';
import { getTableData } from '../util/compliance';

import { BASE_NAME, TIMEOUT_MS } from '../../const';
import { Analyses, Linter } from '../../types';

import { debounce, checkIsLocal, isLocalFile, checkDocument } from '../util';
import * as FileDiagnostic from './file';
import Solutions from './solutions';
import { ADD_FILE_DIAGNOSTIC_COMMAND, CLEAN_DIAGNOSTICS_COMMAND, OPEN_FILE_DIAGNOSTIC_COMMAND, UPDATE_BAR_STATUS_COMMAND } from '../../commands';

enum LINTER_SCENES {
  installed,
  changeActiveTextEditor,
  save,
}

let cancelTokenSource: CancelTokenSourceType | null = null;
let configurationAvailable = false;

function checkConfigurationAvailable() {
  const isLocal = checkIsLocal();
  if (isLocal) {
    configurationAvailable = false;
  } else {
    configurationAvailable = true;
  }
}

class ServiceLinter {
  public lintSpec;

  constructor(private offlineLinter?: Linter) {
    this.lintSpec = debounce(this.lint, 2000, this);
  }

  public async lint(
    spec: string,
    document: TextDocument,
    scenes: LINTER_SCENES,
  ) {
    try {
      if (cancelTokenSource) {
        cancelTokenSource.cancel();
      }
      cancelTokenSource = CancelToken.source();
      const { uri } = document;
      const { query } = uri;

      await this.setStatus('$(sync~spin) Checking ...', BASE_NAME);
      const meta = await fetchAnalyzersMeta();
      const analyzers = meta.map((_) => _.name_id);

      let serviceId = uri.path;
      let specId;
      if (query) {
        query.split('&').forEach((_) => {
          const data = _.split('=');
          const [key, value] = data;
          if (key === 'specId') {
            specId = value;
          }
          if (key === 'serviceName') {
            serviceId = value;
          }
        });
      }
      const res = await specAnalyze(
        spec,
        serviceId,
        analyzers,
        undefined,
        specId,
      );
      // cancelTokenSource
      cancelTokenSource = null;
      const { results, spec_score: score } = res;
      const r = results ? Object.values(results) : [];
      const data = getTableData(r, meta);

      await this.addFileDiagnostic(uri, data.list, score);
      if (scenes === LINTER_SCENES.save) {
        this.showUpdatedNotification(uri);
      }
    } catch (err: any) {
      this.hideStatus();
      if (typeof err?.message === 'string') {
        if (err.message.toLowerCase().indexOf('timeout') > -1) {
          window.showErrorMessage(
            `${err.message.replace(`${TIMEOUT_MS}ms`, '2 mins')
            }, please try again later.`,
          );
        } else {
          window.showErrorMessage(err.message);
        }
      }
    }
  }

  public async updateDiagnostics(
    document: TextDocument,
    scenes: LINTER_SCENES,
  ) {
    if (checkDocument(document)) {
      if (configurationAvailable) {
        if (this.offlineLinter) {
          this.offlineLinter.deleteDiagnostic(document.uri);
        }
        this.lintSpec(document.getText(), document, scenes);
      } else {
        await this.cleanFileDiagnostic(document.uri);
        if (this.offlineLinter) {
          this.offlineLinter.lint(document);
        }
      }
    }
  }

  public async openDiagnostics(document: TextDocument, scenes: LINTER_SCENES) {
    if (!checkDocument(document)) return;
    let openDiagnosticsRes;
    if (configurationAvailable) {
      openDiagnosticsRes = await vscode.commands.executeCommand(
        OPEN_FILE_DIAGNOSTIC_COMMAND,
        document.uri,
      );
    }

    if (!openDiagnosticsRes) {
      this.updateDiagnostics(document, scenes);
    }
  }

  private async showUpdatedNotification(uri: Uri) {
    window.showInformationMessage(
      `The diagnostics for “${uri.path}” has been updated.`,
      'OK',
    );
  }

  private async addFileDiagnostic(
    uri: Uri,
    analyses: Analyses[],
    score: string,
  ) {
    await vscode.commands.executeCommand(
      ADD_FILE_DIAGNOSTIC_COMMAND,
      uri,
      analyses,
      score,
      false,
    );
  }

  private async cleanFileDiagnostic(uri: Uri) {
    await vscode.commands.executeCommand(CLEAN_DIAGNOSTICS_COMMAND, uri);
  }

  private async setStatus(text: string | number, tooltip?: string) {
    await vscode.commands.executeCommand(
      UPDATE_BAR_STATUS_COMMAND,
      text,
      tooltip,
    );
  }

  public async hideStatus() {
    this.setStatus('');
  }
}

export default async function start(context: ExtensionContext, offlineLinter?:Linter) {
  FileDiagnostic.register(context);
  const linter = new ServiceLinter(offlineLinter);

  checkConfigurationAvailable();

  if (window.activeTextEditor) {
    if (isLocalFile(window.activeTextEditor.document)) {
      linter.updateDiagnostics(
        window.activeTextEditor.document,
        LINTER_SCENES.installed,
      );
    }
  }
  context.subscriptions.push(
    window.onDidChangeActiveTextEditor((editor) => {
      if (!editor) {
        linter.hideStatus();
      }

      if (editor) {
        linter.openDiagnostics(
          editor.document,
          LINTER_SCENES.changeActiveTextEditor,
        );
      }
    }),
    workspace.onDidSaveTextDocument((document) => {
      if (document) {
        linter.updateDiagnostics(document, LINTER_SCENES.save);
      }
    }),
    workspace.onDidChangeConfiguration(() => {
      checkConfigurationAvailable();
    }),
    languages.registerCodeActionsProvider(
      'json',
      new Solutions(FileDiagnostic.fileDiagnostics, offlineLinter),
      {
        providedCodeActionKinds: Solutions.providedCodeActionsKind,
      },
    ),
  );
}
