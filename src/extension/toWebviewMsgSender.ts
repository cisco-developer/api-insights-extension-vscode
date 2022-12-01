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

import { Uri, workspace } from 'vscode';

import {
  WebviewVsc,
  DEFAULT_MSG_TYPES,
  Configuration,
  ID_GETTER,
  API_SERVICE_MST_TYPES,
  SIDEBAR_MSG_TYPES,
  DIFF_SUMMARY_MSG_TYPES,
} from '../common';
import { APIService, APIServiceSpec } from '../types';
import {
  fetchSpecDiff,
  fetchDocDiff,
  specAnalyze,
  getSpecAnalyses,
  fetchAnalyzersMeta,
} from './services/index';
import { getTableData } from './util/compliance';
import { getUriBySpec } from './util';
import { DiffSummaryChangeType } from '../const';
import { downloadMemCache } from './fileViewer';

export function postConfigurationChangeMsgToWebview(
  webview: WebviewVsc | undefined,
  cfg: Configuration,
) {
  if (webview) {
    webview.postMessage({
      id: ID_GETTER(),
      data: cfg,
      type: DEFAULT_MSG_TYPES.CONFIGURATION_CHANGED,
    });
  }
}

export function postAPIServiceMsgToWebview(
  webview: WebviewVsc | undefined,
  apiService: APIService,
) {
  if (webview) {
    webview.postMessage({
      id: ID_GETTER(),
      data: apiService,
      type: API_SERVICE_MST_TYPES.API_SERVICE_CHANGED,
    });
  }
}

export async function postUploadHistoryUpdateToWebview(
  webview: WebviewVsc | undefined,
) {
  const uploadHistory = await downloadMemCache.all();
  if (webview) {
    webview.postMessage({
      id: ID_GETTER(),
      data: uploadHistory,
      type: DEFAULT_MSG_TYPES.UPLOAD_HISTORY_UPDATE,
    });
  }
}

export function postReloadSidebarMsgToWebview(webview?: WebviewVsc) {
  if (webview) {
    webview.postMessage({
      id: ID_GETTER(),
      data: null,
      type: SIDEBAR_MSG_TYPES.RELOAD,
    });
  }
}

async function getLocalSpecAnalyse(uri: Uri) {
  const { query } = uri;
  let service_id = uri.path;
  let spec_id;
  if (query) {
    query.split('&').forEach((_) => {
      const data = _.split('=');
      if (data[0] === 'specId') {
        spec_id = data[1];
      }
      if (data[0] === 'serviceName') {
        service_id = data[1];
      }
    });
  }

  const doc = await workspace.openTextDocument(uri);
  const meta = await fetchAnalyzersMeta();
  const analyzers = meta.map((_) => _.name_id);
  const res = await specAnalyze(
    doc.getText(),
    service_id,
    analyzers,
    undefined,
    spec_id,
  );
  const { results, spec_score } = res;
  const r = results ? Object.values(results) : [];
  const data = getTableData(r, meta);
  return { spec_score, summary: data.summary };
}

async function getOurSpecAnalyseSummary(spec: APIServiceSpec) {
  const res = await getSpecAnalyses(spec.id, spec.service_id, true);
  return res.summary;
}

function updateDiffSummary(webview: WebviewVsc, data: any) {
  webview.postMessage({
    id: ID_GETTER(),
    data,
    type: DIFF_SUMMARY_MSG_TYPES.UPDATE,
  });
}

const originDiffSummary = {
  newSpec: null,
  oldSpec: null,
  diffSummary: null,
  oldSpecAnalyseSummary: null,
  newSpecAnalyseSummary: null,
  loading: false,
} as any;

export async function postUpdateDiffSummaryMesgToWebview(
  webview: WebviewVsc,
  data: {
    newSpec: APIServiceSpec | Uri;
    oldSpec: APIServiceSpec | Uri;
    changeType: DiffSummaryChangeType;
  },
) {
  const { changeType, newSpec, oldSpec } = data;

  const updateAll = changeType === DiffSummaryChangeType.save;
  let _originDiffSummary = { ...originDiffSummary, changeType };
  if (changeType === DiffSummaryChangeType.save) {
    _originDiffSummary = {
      ..._originDiffSummary,
      oldSpec: false,
      oldSpecAnalyseSummary: false,
    };
  }
  try {
    let diffSummary;
    let res;
    if (!(newSpec instanceof Uri) && !(oldSpec instanceof Uri)) {
      updateDiffSummary(webview, {
        newSpec,
        oldSpec,
        loading: true,
        newSpecAnalyseSummary: null,
        oldSpecAnalyseSummary: null,
        changeType,
      });
      const _fetchSpecDiff = fetchSpecDiff({
        service_id: newSpec.service_id,
        new_spec_id: newSpec.id,
        old_spec_id: oldSpec.id,
      }).then((data) => {
        updateDiffSummary(webview, { diffSummary: data });
      });

      const newSpecSummary = getOurSpecAnalyseSummary(newSpec).then((data) => {
        updateDiffSummary(webview, { newSpecAnalyseSummary: data });
      });

      const oldSpecSummary = getOurSpecAnalyseSummary(oldSpec).then((data) => {
        updateDiffSummary(webview, { oldSpecAnalyseSummary: data });
      });

      res = await Promise.allSettled([
        _fetchSpecDiff,
        newSpecSummary,
        oldSpecSummary,
      ]);
    } else if (newSpec instanceof Uri) {
      if (!updateAll) {
        if (oldSpec instanceof Uri) {
          updateDiffSummary(webview, {
            newSpec: null,
            newSpecAnalyseSummary: null,
            loading: true,
            changeType,
          });
        } else {
          updateDiffSummary(webview, {
            newSpec: null,
            newSpecAnalyseSummary: null,
            oldSpecAnalyseSummary: null,
            oldSpec,
            loading: true,
            changeType,
          });
        }
      }

      const getNewSpecAnalyse = getLocalSpecAnalyse(newSpec).then(
        async (newSpecAnalyse) => {
          const { summary, spec_score } = newSpecAnalyse;
          const newSpecNameMatch = newSpec.path.match(/\/([^/]*?)$/);
          let mtime = new Date();
          if (newSpec.scheme === 'file') {
            const stat = await workspace.fs.stat(newSpec);
            mtime = new Date(stat.mtime);
          }
          const newSpecName = newSpecNameMatch
            ? newSpecNameMatch[1]
            : newSpec.path;
          const data = {
            newSpec: {
              score: spec_score,
              title: newSpecName,
              updated_at: mtime,
              path: newSpec.path,
            },
            newSpecAnalyseSummary: summary,
          };
          if (!updateAll) {
            updateDiffSummary(webview, data);
          }
          return data;
        },
      );

      const getOldSpecAnalyse = !(oldSpec instanceof Uri)
        ? getOurSpecAnalyseSummary(oldSpec).then((summary) => {
          updateDiffSummary(webview, {
            oldSpecAnalyseSummary: summary,
            oldSpec,
          });
        })
        : Promise.resolve();

      const _getDiffSummary = async function () {
        if (newSpec instanceof Uri) {
          const oldUri = oldSpec instanceof Uri ? oldSpec : getUriBySpec(oldSpec);
          const [newDoc, oldDoc] = await Promise.all([
            workspace.openTextDocument(newSpec),
            workspace.openTextDocument(oldUri!),
          ]);

          diffSummary = await fetchDocDiff({
            new_spec_doc: newDoc.getText(),
            old_spec_doc: oldDoc.getText(),
          });
          const data = { diffSummary };
          if (!updateAll) {
            updateDiffSummary(webview, data);
          }
          return data;
        }
      };

      res = await Promise.allSettled([
        getNewSpecAnalyse,
        getOldSpecAnalyse,
        _getDiffSummary(),
      ]);
    }
    res?.forEach((item) => {
      if (item.status === 'fulfilled') {
        if (item.value) {
          _originDiffSummary = { ..._originDiffSummary, ...item.value };
        }
      }
      if (item.status === 'rejected') {
        const { reason } = item;
      }
    });
    _originDiffSummary = { ..._originDiffSummary, loading: false };
    updateDiffSummary(
      webview,
      updateAll ? _originDiffSummary : { loading: false },
    );
  } catch (err: any) {
    updateDiffSummary(webview, { loading: false, error: err });
  }
}
