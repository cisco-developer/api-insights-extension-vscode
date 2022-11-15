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
import { writeFile } from 'fs';
import { AxiosRequestConfig } from 'axios';
import { get } from 'lodash';
import {
  WebviewVsc,
  WebviewReqMsg,
  DEFAULT_MSG_TYPES,
  postResponseMessage,
  SIDEBAR_MSG_TYPES,
  postErrorResponseMessage,
  stringifyReplacer,
  API_SERVICE_MST_TYPES,
  isWebExt,
} from '../common';
import { APIService } from '../types';
import { doAjax, getConfiguration, openSetting } from './util/extUtils';
import { getSpecAnalyses, fetchSpecDiff } from './services/index';
import { READ_COMMAND } from '../commands';

export async function getConfigurationMsgInterceptor(
  webview: WebviewVsc,
  msg: WebviewReqMsg,
) {
  if (msg.type === DEFAULT_MSG_TYPES.GET_EXTENSION_CONFIG) {
    const cfg = getConfiguration();
    postResponseMessage(webview, msg, cfg);
  }
}

export async function openNativeSettingMsgInterceptor(
  webview: WebviewVsc,
  msg: WebviewReqMsg,
) {
  if (msg.type === DEFAULT_MSG_TYPES.OPEN_NATIVE_SETTING) {
    openSetting();
  }
}

export function openAPIServicePanelMsgInterceptor(
  msg: WebviewReqMsg,
  handler: Function,
) {
  if (msg.type === SIDEBAR_MSG_TYPES.OPEN_API_SERVICE_PANEL) {
    handler(msg.data as APIService);
  }
}

export function saveFileMsgInterceptor(
  webview: WebviewVsc,
  msg: WebviewReqMsg<
    DEFAULT_MSG_TYPES.SAVE_FILE,
    { filePath: string; content: string }
  >,
) {
  if (msg.type === DEFAULT_MSG_TYPES.SAVE_FILE) {
    const { filePath, content } = msg.data;
    if (!isWebExt()) {
      writeFile(filePath, content, { encoding: 'utf-8' }, (err) => {
        if (!err) {
          postResponseMessage(webview, msg, {
            status: 'ok',
          });
        }
      });
    }
  }
}

export function vscodeCommandExecuteMsgInterceptor(webview: WebviewVsc, msg: WebviewReqMsg) {
  if (msg.type === DEFAULT_MSG_TYPES.EXECUTE_VSCODE_COMMAND) {
    const { command, args, namespace = 'window' } = msg.data;
    const res = (resp: any, isError?: boolean) => (isError
      ? postErrorResponseMessage(webview, msg, resp)
      : postResponseMessage(webview, msg, resp));
    try {
      const _args = args as any[];
      _args.forEach((arg, idx) => {
        if (typeof arg === 'string' && arg.slice(0, 7) === 'file://') {
          _args[idx] = vscode.Uri.file(arg.slice(7));
        }
      });
      // @ts-ignore
      const result = get(vscode[namespace], command).call(vscode.window, ...args);
      if (result.then && typeof result.then === 'function') {
        result
          .then((...args: any[]) => {
            try {
              if (args.length === 1 && args[0] === undefined) {
                args = ['ok'];
              }
              res(JSON.parse(JSON.stringify(args, stringifyReplacer)));
            } catch (error) {
              res('ok');
            }
          })
          .catch((e: any) => {
            res(e, true);
          });
      }
      if (result.catch) {
        result.catch((e: any) => {
          res(e, true);
        });
      }
      res('done');
    } catch (error) {
      console.log('error=>', error);
      res(error, true);
    }
  }
}
export function vscodeGetObjectValueMsgInterceptor(
  webview: WebviewVsc,
  msg: WebviewReqMsg,
) {
  if (msg.type === DEFAULT_MSG_TYPES.GET_VSCODE_OBJECT_VALUE) {
    const path = msg.data;
    const res = (resp: any, isError?: boolean) => (
      isError
        ? postErrorResponseMessage(webview, msg, resp)
        : postResponseMessage(webview, msg, resp)
    );
    try {
      const result = get(vscode, path);
      res(result);
    } catch (error) {
      res(error, true);
    }
  }
}

export function sendRequestMsgInterceptor(
  webview: WebviewVsc,
  msg: WebviewReqMsg,
) {
  if (msg.type === DEFAULT_MSG_TYPES.SEND_REQUEST) {
    const { data } = msg;
    doAjax(data)
      .then((r) => {
        postResponseMessage(webview, msg, r.data);
      })
      .catch((e) => {
        console.log('err=>', e);
        postErrorResponseMessage(webview, msg, e);
      });
  }
}

export function openFileInterceptor(webview: WebviewVsc, msg: WebviewReqMsg) {
  if (msg.type === API_SERVICE_MST_TYPES.OPEN_FILE) {
    vscode.commands.executeCommand(READ_COMMAND, msg.data);
  }
}
export function getSpecsAnalysesInterceptor(
  webview: WebviewVsc,
  msg: WebviewReqMsg,
) {
  if (msg.type === API_SERVICE_MST_TYPES.GET_SPECS_ANALYSES) {
    getSpecAnalyses(msg.data[0], msg.data[1], true).then((data: any) => {
      if (data?.error) {
        postErrorResponseMessage(webview, msg, data.error);
      } else {
        postResponseMessage(webview, msg, data);
      }
    });
  }
}

export function getSpecDiffSummaryInterceptor(
  webview: WebviewVsc,
  msg: WebviewReqMsg,
) {
  if (msg.type === DEFAULT_MSG_TYPES.GET_SPEC_DIFF_SUMMARY) {
    const { data } = msg;
    const { newSpec, oldSpec } = data;
    fetchSpecDiff({
      service_id: newSpec.service_id,
      new_spec_id: newSpec.id,
      old_spec_id: oldSpec.id,
    }).then((data: any) => {
      if (data?.error) {
        postErrorResponseMessage(webview, msg, data.error);
      } else {
        postResponseMessage(webview, msg, data);
      }
    });
  }
}
