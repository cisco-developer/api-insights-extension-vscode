import {
  ExtensionContext,
} from 'vscode';
import { statSync, existsSync } from 'fs';
import EventEmitter = require('events');
import { UPLOAD_MEM_CACHE } from '../../const';
import {
  FileQuery,
  UploadCache,
} from '../../types';

import { Configuration, isWebExt } from '../../common';
import { getConfiguration } from '../util/extUtils';

export default class UploadMemCache extends EventEmitter {
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
    const cache = new UploadMemCache(
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

  all() {
    if (isWebExt()) {
      return this.cache;
    }
    return Object.keys(this.cache).reduce((cache, _) => {
      if (existsSync(_)) {
        cache[_] = { ...this.cache[_], mtime: statSync(_).ctime };
      } else {
        this.delete(_, false);
      }
      return cache;
    }, {} as typeof this.cache);
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
