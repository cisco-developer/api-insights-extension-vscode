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

import {
  Uri,
  workspace,
  window,
  StatusBarAlignment,
  ConfigurationChangeEvent,
  TextDocument,
} from 'vscode';
import * as YAML from 'yaml';
import { getStoreServiceById, getStoreSpecById } from '../store';
import { FILE_SCHEME, APIServiceSpec, FileQuery, SpecProps } from '../../types';
import { BASE_NAME, AuthTypes } from '../../const';
import { CONFIGURE_EXPLORER_COMMAND } from '../../commands';
import { getSpecFileName } from '../../util';
import {
  getConfiguration,
  checkConfiguration as checkConfigurationService,
} from './extUtils';

export const specFileName = getSpecFileName;

export function getUriBySpec(spec: APIServiceSpec, scheme?: FILE_SCHEME) {
  if (!scheme) {
    scheme = FILE_SCHEME.read;
  }

  const {
    service_id, version, revision, id, service_name, score, updated_at,
  } = spec;
  let serviceName = service_name;
  if (!serviceName) {
    const service = getStoreServiceById(service_id);
    if (service) {
      serviceName = service.name_id;
    }
  }
  if (!serviceName) return null;
  const path = ['', BASE_NAME, getSpecFileName(serviceName, version, revision)].join('/');
  const uri = Uri.from({
    scheme,
    path,
    query: `specId=${id}&serviceId=${service_id}&serviceName=${serviceName}&score=${score}&updatedAt=${updated_at}&version=${version}&revision=${revision}`,
  });

  return uri;
}

export function getUriBySpecId(
  specId: string,
  serviceId: string,
  scheme?: FILE_SCHEME,
) {
  const spec = getStoreSpecById(specId, serviceId);
  if (!spec) return null;
  return getUriBySpec(spec, scheme);
}

export function getQueryFromSpecUri(uri: Uri) {
  const { query } = uri;
  const queryObj = query.split('&').reduce((o, q) => {
    const d = q.split('=');
    return { ...o, [d[0]]: d[0] === 'score' ? Number(d[1]) : d[1] };
  }, {}) as FileQuery;
  return queryObj;
}

export function stringToUint8Array(str: string) {
  const arr = [];
  // eslint-disable-next-line no-plusplus
  for (let i = 0, j = str.length; i < j; ++i) {
    arr.push(str.charCodeAt(i));
  }
  const tmpUint8Array = new Uint8Array(arr);
  return tmpUint8Array;
}

export function debounce(fn: Function, delay: number, context?: any) {
  let time = 0;
  let timer: NodeJS.Timeout | null = null;
  return function proxyFn(...args: any[]) {
    const now = Date.now();
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (now - time >= delay) {
      fn.call(context, ...args);
      time = now;
    } else {
      timer = setTimeout(() => {
        fn.call(context, ...args);
        timer = null;
        time = Date.now();
      }, delay);
    }
  };
}

export async function checkConfiguration() {
  const cfg = getConfiguration();

  const {
    endpoint, authType, tokenValue, tokenURL, clientID, clientSecret,
  } = cfg;

  let errorMsg; let
    isOAuthError: boolean;
  if (!endpoint) {
    // pass, as we need to apply local mode
    // errorMsg = "Please set endpoint URL";
  } else {
    if (authType === AuthTypes.Token) {
      if (!tokenValue) {
        errorMsg = "Token value is required as your auth type setting is 'Token'";
      }
    } else if (authType === AuthTypes.OAuth) {
      const requiredFields = [];
      if (!tokenURL) {
        requiredFields.push('Token URL');
      }
      if (!clientID) {
        requiredFields.push('Client ID');
      }
      if (!clientSecret) {
        requiredFields.push('Client Secret');
      }
      if (requiredFields.length) {
        isOAuthError = true;
        errorMsg = `${requiredFields.join(',')} ${requiredFields.length > 1 ? 'are' : 'is'} required as your auth type setting is 'OAuth'`;
      }
    }

    if (!errorMsg) {
      const [ok, error] = await checkConfigurationService();
      const message = error ? error.message : '';
      if (!ok) {
        isOAuthError = message.indexOf('oauth') > -1;
        errorMsg = isOAuthError
          ? message
          : `Could not connect to endpoint URL${message ? `: \r\n${message.toLowerCase()}` : ''
          }, please check your settings`;
      }
    }
  }
  return errorMsg;
}

type CheckConfigurationService = () => Promise<string | undefined>;
type CheckConfigurationListenerMessage = {
  error?: any;
  event?: ConfigurationChangeEvent;
  hasEndpoint?: boolean;
  isLocal?: boolean;
};
type CheckConfigurationListener = (
  message: CheckConfigurationListenerMessage
) => void;

class ConfigurationCheckEmitter {
  updates: Map<string | symbol, Function> = new Map();

  isLocal = true;

  constructor(private checkConfigurationService: CheckConfigurationService) {
    const { endpoint } = getConfiguration();
    this.isLocal = !endpoint;
  }

  static run(checkConfigurationService: CheckConfigurationService) {
    const emitter = new ConfigurationCheckEmitter(checkConfigurationService);
    return emitter;
  }

  add(key: string | symbol, fn: CheckConfigurationListener) {
    this.updates.set(key, fn);
  }

  trigger(message: CheckConfigurationListenerMessage) {
    this.updates.forEach((item) => {
      item(message);
    });
  }

  off(key: string | symbol) {
    this.updates.delete(key);
  }

  async checkNow(fn: CheckConfigurationListener) {
    const error = (await this.checkConfiguration()) as CheckConfigurationListenerMessage;
    fn(error);
  }

  public async checkConfiguration(
    event?: ConfigurationChangeEvent,
  ): Promise<CheckConfigurationListenerMessage> {
    const { endpoint } = getConfiguration();
    if (!endpoint) {
      this.isLocal = true;
      return {
        error: undefined, hasEndpoint: false, event, isLocal: true,
      };
    }
    this.isLocal = false;
    try {
      const error = await this.checkConfigurationService();
      return {
        error, hasEndpoint: true, event, isLocal: false,
      };
    } catch (error) {
      return {
        error, hasEndpoint: true, event, isLocal: false,
      };
    }
  }
}

export const configurationCheckEmitter = ConfigurationCheckEmitter.run(checkConfiguration);

export function checkIsLocal() {
  const { endpoint } = getConfiguration();
  const isLocal = !endpoint;
  return isLocal;
}

workspace.onDidChangeConfiguration(async (e) => {
  const message = await configurationCheckEmitter.checkConfiguration(e);
  configurationCheckEmitter.trigger(message);
});

const onlineHostBarStatusItem = window.createStatusBarItem(
  StatusBarAlignment.Left,
  1000,
);

const offlineHostBarStatusItem = window.createStatusBarItem(
  StatusBarAlignment.Left,
  1000,
);

export function handleHostBarStatusChange(
  message: CheckConfigurationListenerMessage,
) {
  const { isLocal } = message;
  if (isLocal) {
    onlineHostBarStatusItem.hide();
    offlineHostBarStatusItem.show();
    offlineHostBarStatusItem.text = `$(vm-outline) ${BASE_NAME}`;
    offlineHostBarStatusItem.tooltip = 'Click to configure API Insights service endpoint';
    offlineHostBarStatusItem.command = CONFIGURE_EXPLORER_COMMAND;
  } else {
    onlineHostBarStatusItem.show();
    offlineHostBarStatusItem.hide();
    const { endpoint } = getConfiguration();
    const hostMatch = endpoint.match(/^https:\/\/([^/]+)/);
    const host = hostMatch ? hostMatch[1] : endpoint;
    onlineHostBarStatusItem.text = `$(vm-active) ${BASE_NAME}:${host}`;
    onlineHostBarStatusItem.tooltip = `Connected to ${endpoint}`;
  }
}

export async function exists(uri:Uri) {
  try {
    await workspace.fs.stat(uri);
    return true;
  } catch (err:any) {
    if (typeof err === 'object' && err !== null) {
      if (err.code === 'FileNotFound') {
        return false;
      }
    }
    return Promise.reject(err);
  }
}

export function isLocalFile(document: TextDocument) {
  const { uri } = document;
  return uri.scheme === 'file';
}

function isRemoteSpecFile(document: TextDocument) {
  const { uri } = document;
  return (
    (uri.scheme === FILE_SCHEME.edit || uri.scheme === FILE_SCHEME.read)
    && uri.path.endsWith('.spec.json')
  );
}

function isJsonOrYaml(document: TextDocument) {
  const { languageId } = document;
  return languageId === 'json' || languageId === 'yaml';
}

function isVersion2(text: SpecProps) {
  if (text.swagger) {
    return true;
  }
  return false;
}

function isVersion3(text: SpecProps) {
  if (text.openapi) {
    return true;
  }
  return false;
}

function isSpecFile(document: TextDocument) {
  const text = document.getText();
  try {
    const parseText = YAML.parse(text);

    if (isVersion2(parseText) || isVersion3(parseText)) {
      return true;
    }
    return false;
  } catch (err) {
    console.log('invalid spec file: ', err);
    return false;
  }
}

export function checkDocument(document: TextDocument) {
  if (isRemoteSpecFile(document)) {
    return true;
  }
  if (document && isJsonOrYaml(document) && isSpecFile(document)) {
    return true;
  }
  return false;
}
