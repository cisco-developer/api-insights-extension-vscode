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
  ExtensionContext,
  window,
  workspace,
  Uri,
  commands,
  TextDocument,
  ProgressLocation,
} from 'vscode';
import { Utils } from 'vscode-uri';
import { homedir } from 'os';
import * as YAML from 'yaml';
import {
  READ_COMMAND,
  EDIT_COMMAND,
  UPLOAD_COMMAND,
  SAVE_ON_LOCAL_COMMAND,
} from '../../commands';
import { DEFAULT_MSG_TYPES } from '../../common';
import {
  getUriBySpec,
  stringToUint8Array,
  specFileName as getSpecFileName,
  getQueryFromSpecUri,
  exists,
} from '../util';
import {
  FILE_SCHEME,
  Position,
  FileQuery,
  APIServiceSpec,
} from '../../types';
import { specUploadToCloud } from '../services';
import { APIServicePanelProvider } from '../webviewPanelProviders/serviceDetail';
import fsProvider from './fsProvider';
import DownloadMemCache from './downloadMemCache';

const { joinPath: join } = Utils;

const DEFAULT_POSITION = new vscode.Position(0, 0);

const NO_ACTION = 'Got It';
enum TAB_MODE {
  EDIT = 'edit',
  READ = 'read',
}

enum SAVE_ACTION {
  toLocal = 'Download',
  toCloud = 'Upload',
}

enum UPLOADED_ACTION {
  checkResult = 'Check It Now',
}

// eslint-disable-next-line import/no-mutable-exports
export let downloadMemCache: DownloadMemCache;

class FileManager {
  private activeTabs: any = {};

  constructor() {
    this.init();
  }

  private init() {
    workspace.onDidSaveTextDocument(async (document) => {
      const { scheme } = document.uri;
      if (scheme === FILE_SCHEME.edit) {
        const action = await window.showInformationMessage(
          `You are saving the ${document.uri.fsPath} file. Where do you want to go`,
          SAVE_ACTION.toLocal,
          SAVE_ACTION.toCloud,
        );
        if (action === SAVE_ACTION.toCloud) {
          await this.specToCloud(document);
        } else if (action === SAVE_ACTION.toLocal) {
          await this.specToLocal(document, false);
        }
      }
    });
  }

  public async specToCloud(document: TextDocument) {
    const revision = await window.showInputBox({
      title: 'Upload as New Revision',
      placeHolder: 'Enter revision',
    });
    const { uri } = document;
    const { query } = uri;
    const queryObj = query.split('&').reduce((o, q) => {
      const d: any[] = q.split('=');
      return { ...o, [d[0]]: d[1] };
    }, {}) as FileQuery;
    if (revision) {
      const res: APIServiceSpec = await window.withProgress(
        {
          location: ProgressLocation.Notification,
        },
        async (progress) => {
          progress.report({ message: 'Uploading...' });
          const result = await specUploadToCloud(
            document.getText(),
            revision,
            queryObj.serviceId,
          );
          return result;
        },
      );
      const { revision: newRevision, version } = res;
      const [service] = uri.path.split('/').slice(-1)[0].split('-');
      const uploadedAction = await window.showInformationMessage(
        `The ${getSpecFileName(
          service,
          version,
          newRevision,
        )} uploaded successfully.`,
        'Check It Now',
        NO_ACTION,
      );
      if (uploadedAction === UPLOADED_ACTION.checkResult) {
        APIServicePanelProvider.reveal();
      }
    }
  }

  public async specToLocal(document: TextDocument, show: boolean) {
    const folders = workspace.workspaceFolders;
    const { uri: originUri } = document;
    const fileName = originUri.fsPath.split('/').slice(-1)[0];
    let defaultUri = join(Uri.file(homedir()), 'Downloads', fileName);

    if (folders && folders.length > 0) {
      defaultUri = join(Uri.file(folders[0].uri.path), fileName);
    }

    const uri = await window.showSaveDialog({
      title: SAVE_ACTION.toLocal,
      defaultUri,
    });

    if (uri) {
      await workspace.fs.writeFile(uri, stringToUint8Array(document.getText()));
      window.showInformationMessage(`${fileName} saved on local successfully.`);
      downloadMemCache.set(uri.path, getQueryFromSpecUri(originUri));
    }

    if (show && uri) {
      window.showTextDocument(uri);
    }
  }

  private async closeEditor(document: vscode.TextDocument) {
    if (!document.isClosed) {
      await window.showTextDocument(document, { preserveFocus: false });
      await commands.executeCommand('workbench.action.closeActiveEditor');
    }
  }

  private async createTabAndShow(
    uri: Uri,
    mode: TAB_MODE,
    show: boolean,
    position?: string | Position,
  ) {
    const _uri = uri.with({
      scheme: this.getScheme(mode),
    });
    if (show) {
      await commands.executeCommand('vscode.open', _uri);
    }

    const document = await workspace.openTextDocument(_uri);

    if (show && position && position !== DEFAULT_POSITION) {
      const pos = position
        ? this.goToDefinition(document, position)
        : new vscode.Position(0, 0);
      await window.showTextDocument(document, {
        selection: new vscode.Range(pos, pos),
      });
    }

    const key = this.uriToKey(uri);
    this.activeTabs[key] = {
      document,
      mode,
      dispose: async () => {
        await this.closeEditor(document);
        delete this.activeTabs[key];
      },
    };
  }

  public getActiveTab(...uris: Uri[]) {
    let activeTab;
    for (let i = 0; i < uris.length; i += 1) {
      const uri = uris[i];
      const key = this.uriToKey(uri);
      activeTab = this.activeTabs[key];
      if (activeTab) {
        break;
      }
    }

    return activeTab;
  }

  private goToDefinition(
    document: vscode.TextDocument,
    position: string | Position,
  ) {
    const { languageId, getText } = document;
    if (languageId !== 'json' && languageId !== 'yaml') return DEFAULT_POSITION;
    const text = getText();
    let pos = null;
    if (typeof position === 'string') {
      const obj = YAML.parse(text);
      let pathDef = '';
      Object.keys(obj.paths || {}).forEach((path: string) => {
        // eslint-disable-next-line no-useless-escape
        const re = new RegExp(path.replace(/\{[^\}]*?}/, '.*?'));
        if (position?.match(re)) {
          if (!pathDef || pathDef.length < path.length) {
            pathDef = path;
          }
        }
      });

      if (pathDef) {
        const findIdx = text.indexOf(pathDef);

        if (findIdx > -1) {
          pos = document.positionAt(findIdx);
        }
      }
    } else if (typeof position === 'object') {
      pos = new vscode.Position(position.line, position.character);
    }

    return pos || DEFAULT_POSITION;
  }

  private async tryFocusTab(
    position: string | Position,
    show: boolean,
    ...uris: Uri[]
  ) {
    const activeTab = this.getActiveTab(...uris);
    if (!activeTab) return;
    const document = await workspace.openTextDocument(activeTab?.document?.uri);
    if (show) {
      const pos = this.goToDefinition(document, position);
      const editor = await window.showTextDocument(document, {
        selection: new vscode.Range(pos, pos),
      });
    }
    activeTab.document = document;
    return activeTab;
  }

  public async openInEdit(uri: Uri, show?: boolean) {
    if (show === undefined) {
      show = true;
    }
    const activeTab = await this.tryFocusTab(
      DEFAULT_POSITION,
      show,
      uri.with({ scheme: FILE_SCHEME.read }),
    );
    if (activeTab) {
      await activeTab.dispose();
    }
    await this.createTabAndShow(uri, TAB_MODE.EDIT, show);
  }

  public async openInRead(uri: Uri, position?: string | Position) {
    const activeTab = await this.tryFocusTab(
      position || DEFAULT_POSITION,
      true,
      uri,
      uri.with({ scheme: FILE_SCHEME.edit }),
    );
    if (activeTab) {
      return;
    }
    await this.createTabAndShow(uri, TAB_MODE.READ, true, position);
  }

  private uriToKey(uri: Uri) {
    return uri
      .with({
        fragment: '',
      })
      .toString();
  }

  private getScheme(mode: TAB_MODE) {
    if (mode === TAB_MODE.EDIT) {
      return FILE_SCHEME.edit;
    } if (mode === TAB_MODE.READ) {
      return FILE_SCHEME.read;
    }
    return 'file';
  }
}

export const fileManager = new FileManager();

async function readFileCommand(
  spec: APIServiceSpec | Uri | string,
  position?: string | Position,
) {
  if (typeof spec === 'string') {
    if (!await exists(Uri.file(spec))) {
      downloadMemCache.delete(spec);
    }
    await commands.executeCommand('vscode.open', Uri.file(spec));
    return;
  }
  let uri;
  if (spec instanceof Uri) {
    uri = spec.with({ scheme: FILE_SCHEME.read });
  } else {
    uri = getUriBySpec(spec, FILE_SCHEME.read);
  }

  if (uri) {
    await fileManager.openInRead(uri, position);
  }
}

async function saveOnLocalCommand(uri: Uri | APIServiceSpec, show: boolean) {
  let _uri;
  if (!(uri instanceof Uri)) {
    _uri = getUriBySpec(uri);
  } else {
    _uri = uri;
  }
  if (!_uri) return;
  const document = await workspace.openTextDocument(_uri);
  await fileManager.specToLocal(document, show);
}

async function editFileCommand(uri: Uri, show?: boolean) {
  if (show === undefined) {
    show = true;
  }

  const isMarkdown = uri.path.endsWith('.md');
  const action = await window.showInformationMessage(
    `Please download the ${isMarkdown ? 'changelog' : 'spec'
    } file before editing`,
    'Download',
  );
  if (action === 'Download') {
    await saveOnLocalCommand(uri, true);
  }
}

async function uploadToCloudCommand(uri: Uri) {
  const document = await workspace.openTextDocument(uri);
  await fileManager.specToCloud(document);
}

export default function register(context: ExtensionContext) {
  downloadMemCache = DownloadMemCache.run(
    context,
    DEFAULT_MSG_TYPES.UPLOAD_HISTORY_UPDATE,
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(READ_COMMAND, readFileCommand),
    vscode.commands.registerCommand(EDIT_COMMAND, editFileCommand),
    vscode.commands.registerCommand(
      SAVE_ON_LOCAL_COMMAND,
      saveOnLocalCommand,
    ),
    vscode.commands.registerCommand(UPLOAD_COMMAND, uploadToCloudCommand),
  );
  fsProvider(context);
}
