import {
  ExtensionContext,
  Uri,
  workspace,
} from 'vscode';
import EventEmitter = require('events');
import { UPLOAD_MEM_CACHE } from '../../const';
import {
  FileQuery,
  UploadCache,
} from '../../types';

import { Configuration } from '../../common';
import { getConfiguration } from '../util/extUtils';
import { exists } from '../util';

export default class DownloadMemCache extends EventEmitter {
  private changed = false;

  constructor(
    private cache: UploadCache,
    private context: ExtensionContext,
    public updateEventName: string,
  ) {
    super();
  }

  static run(context: ExtensionContext, updateEventName: string) {
    let state = context.globalState.get(UPLOAD_MEM_CACHE);
    if (!state) {
      state = {};
      context.globalState.update(UPLOAD_MEM_CACHE, state);
    }
    const cache = new DownloadMemCache(
      state as UploadCache,
      context,
      updateEventName,
    );
    return cache;
  }

  set(localPath: string, meta: FileQuery) {
    const setting = getConfiguration();
    this.cache[localPath] = { ...meta, setting };
    this.update(true);
  }

  get(localPath: string) {
    const meta = this.cache[localPath];
    if (meta) {
      const { setting } = meta;
      if (!setting) {
        this.delete(localPath, false);
      } else if (!this.isCurrentHost(setting)) {
        return;
      }
    }
    return this.cache[localPath];
  }

  isCurrentHost(setting: Configuration) {
    const _setting = getConfiguration();
    return _setting.endpoint.trim() === setting.endpoint.trim();
  }

  async all() {
    const cache:typeof this.cache = {};
    const keys = Object.keys(this.cache);
    const len = keys.length;
    const res = [];
    const getAvailableCache = async (url:string) => {
      const uri = Uri.file(url);
      if (await exists(uri)) {
        const { mtime } = await workspace.fs.stat(uri);
        cache[url] = { ...this.cache[url], mtime: new Date(mtime) };
      } else {
        this.delete(url, false);
      }
    };
    for (let i = 0; i < len; i += 1) {
      res.push(getAvailableCache(keys[i]));
    }
    await Promise.all(res);
    return cache;
  }

  delete(localPath: string, notify?: boolean) {
    if (notify === undefined) {
      notify = true;
    }
    if (this.cache[localPath]) {
      delete this.cache[localPath];
      this.update(notify);
    }
  }

  update(notify: boolean) {
    if (notify) {
      this.emit(this.updateEventName);
    }
    if (!this.changed) {
      this.changed = true;
      setTimeout(() => {
        this.context.globalState.update(UPLOAD_MEM_CACHE, this.cache);
        this.changed = false;
      }, 0);
    }
  }
}
