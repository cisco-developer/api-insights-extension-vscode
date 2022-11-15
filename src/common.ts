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

import { APIServiceSpec } from './types';

export const SPEC_ANALYSES_SEVERITY = ['error', 'warning', 'info', 'hint'];
export const SPEC_ANALYSES_SEVERITY_COLORS = [
  '#EB5757',
  '#F0AD42',
  '#00BCEB',
  '#C3C9D2',
];

export enum SPEC_FORMATS {
  JSON = 'json',
  YAML = 'yaml',
}
export type Configuration = {
  endpoint: string;
  authType?: string;
  tokenType?: string;
  tokenValue?: string;
  tokenURL?: string;
  clientID?: string;
  clientSecret?: string;
  format?: SPEC_FORMATS;
};

export enum SIDEBAR_MSG_TYPES {
  OPEN_API_SERVICE_PANEL = 'OPEN_API_SERVICE_PANEL',
  RELOAD = 'RELOAD',
}

export enum DIFF_SUMMARY_MSG_TYPES {
  UPDATE = 'UPDATE',
  APP_IS_READY = 'APP_IS_READY',
}
export enum API_SERVICE_MST_TYPES {
  API_SERVICE_CHANGED = 'API_SERVICE_CHANGED',
  GET_API_SERVICE = 'GET_API_SERVICE',
  DOWNLOAD_API_SPEC = 'DOWNLOAD_API_SPEC',
  APP_IS_READY = 'APP_IS_READY',
  OPEN_FILE = 'OPEN_FILE',
  GET_SPECS_ANALYSES = 'GET_SPECS_ANALYSES',
}

export enum DEFAULT_MSG_TYPES {
  SEND_REQUEST = 'SEND_REQUEST',
  GET_EXTENSION_CONFIG = 'GET_EXTENSION_CONFIG',
  OPEN_NATIVE_SETTING = 'OPEN_NATIVE_SETTING',
  CONFIGURATION_CHANGED = 'CONFIGURATION_CHANGED',
  SAVE_FILE = 'SAVE_FILE',
  EXECUTE_VSCODE_COMMAND = 'EXECUTE_VSCODE_COMMAND',
  GET_VSCODE_OBJECT_VALUE = 'GET_VSCODE_OBJECT_VALUE',
  GET_SPEC_DIFF_SUMMARY = 'GET_SPEC_DIFF_SUMMARY',
  UPLOAD_HISTORY_UPDATE = 'UPLOAD_HISTORY_UPDATE',
}
export type WebviewMsgType =
  | DIFF_SUMMARY_MSG_TYPES
  | DEFAULT_MSG_TYPES
  | SIDEBAR_MSG_TYPES
  | API_SERVICE_MST_TYPES;

export interface WebviewReqMsg<T = WebviewMsgType, D = any> {
  id: number;
  type: T;
  data: D;
}
export type WebviewResponeMsg = {
  req: WebviewReqMsg;
  code?: number;
  data?: any;
  msg?: string;
};
export type WebviewVsc = {
  postMessage: (msg: WebviewReqMsg | WebviewResponeMsg) => void;
};

export const REQUEST_TIMEOUT = 120000;
export const ID_GETTER = (() => {
  let ID = 0;
  return () => { ID += 1; return ID; };
})();

export class PostMessageTimeoutError extends Error {
  constructor(reason: { req: WebviewReqMsg }) {
    super();
    this.name = 'PostMessageTimeoutError';
    this.message = JSON.stringify(reason.req);
  }
}
type PromisedWebviewResponeMsg = Promise<WebviewResponeMsg> & {
  release: Function;
};
export const promisifyPostMessage = async function (
  webviewApi: WebviewVsc,
  type: WebviewMsgType,
  data?: any,
  timeout: number = REQUEST_TIMEOUT,
) {
  console.log('sending msg', type, data);
  let releaseFn = (cancel?: boolean) => { };
  const promise = new Promise((res, rej) => {
    const id = ID_GETTER();
    let timer: NodeJS.Timeout;
    // @ts-ignore
    window.msgListeners = window.msgListeners || {};

    // @ts-ignore
    const listener = function (message: MessageEvent<WebviewResponeMsg>) {
      const data = message.data as WebviewResponeMsg;
      // try {
      //   let { id: _idDebug } = data.req;
      // } catch (error) {
      //   console.log("error", error, message);
      // }

      if (data.req) {
        const { id: _id } = data.req;
        if (id === _id) {
          if (timer) clearTimeout(timer);
          releaseFn(false);
          // @ts-ignore
          if (data.code === -1) {
            rej(data);
          } else {
            res(data);
          }
        }
      }
    };

    releaseFn = (cancel?: boolean) => {
      if (cancel === true) {
        // do cancel
      }
      // @ts-ignore
      window.removeEventListener('message', listener);
      // @ts-ignore
      delete window.msgListeners[id];
    };

    const req: WebviewReqMsg = {
      id,
      type,
      data,
    };

    // @ts-ignore
    listener.req = req;

    // @ts-ignore
    window.addEventListener('message', listener);

    // @ts-ignore
    window.msgListeners[id] = listener;

    webviewApi.postMessage(req);

    if (timeout !== 0) {
      timer = setTimeout(() => {
        const error = new PostMessageTimeoutError({ req });
        console.error(error);
        rej(error);
        releaseFn(false);
      }, timeout);

      // @ts-ignore
      window.addEventListener('unload', () => {
        // @ts-ignore
        window.removeEventListener('message', listener);
      });
    }
  }) as PromisedWebviewResponeMsg;

  // @ts-ignore
  promise.release = releaseFn;

  return promise;
};

export function postResponseMessage(
  webview: WebviewVsc,
  req: WebviewReqMsg,
  resp: any,
) {
  const respMsg: WebviewResponeMsg = {
    req, data: resp, code: 0, msg: 'success',
  };
  webview.postMessage(respMsg);
}

export function postErrorResponseMessage(
  webview: WebviewVsc,
  req: WebviewReqMsg,
  resp: any,
) {
  const respMsg: WebviewResponeMsg = {
    req,
    data: resp,
    code: -1,
    msg: (resp && resp.message) || 'error',
  };
  webview.postMessage(respMsg);
}

export function stringifyReplacer(name: string, val: any) {
  // convert RegExp to string
  if (val && val.constructor === RegExp) {
    return val.toString();
  } if (name === 'str') {
    //
    return undefined; // remove from result
  }
  return val; // return as is
}

export function transformYamlObjToJson(obj: any) {
  const { Path, PathItem } = obj;
  const json: Record<string, any> = {};
  if (Path) {
    json[Path] = {};
    const pathItem: any = json[Path];
    Object.keys(PathItem).forEach((method) => {
      pathItem[method] = PathItem[method];
    });
  }
  return json;
}

export function isWebExt() {
  return EXT_TYPE === 'web';
}

export const getRevisionFullname = (revision: APIServiceSpec) => `${revision.version} r${revision.revision}`;
