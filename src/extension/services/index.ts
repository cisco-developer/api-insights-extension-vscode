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

import axios, { CancelTokenSource } from 'axios';
import { doAjax } from '../util/extUtils';
import { addStoreServiceSpec } from '../store';
import { AnalyzersMetaType, APIService, APIServiceSpec } from '../../types';
import { getComplianceTableData, getDriftTableData } from '../util/compliance';

export const { CancelToken } = axios;
export const { isCancel } = axios;
export type CancelTokenSourceType = CancelTokenSource;

export async function specUploadToCloud(
  doc: string,
  revision: string,
  service_id: string,
) {
  const res = await doAjax({
    method: 'post',
    data: { doc, revision, service_id },
    url: `/services/${service_id}/specs`,
  });
  return res.data;
}

const specAnalyzeRequests: any = {};

export async function specAnalyze(
  doc: string,
  service_id: string,
  analyzers: string[] | [],
  cancelTokenSource?: CancelTokenSource,
  spec_id?: string,
) {
  const uniqueId = `${service_id}${spec_id || ''}`;
  const reqs = specAnalyzeRequests[uniqueId] || [];
  const reqNums = reqs.length;
  try {
    const promise = new Promise((resolve, reject) => {
      reqs.push([resolve, reject]);
    });
    specAnalyzeRequests[uniqueId] = reqs;
    if (reqNums > 0) {
      return promise;
    }
    const res = await doAjax({
      method: 'post',
      data: {
        analyzers,
        service: {
          name_id: service_id,
        },
        spec: { doc, id: spec_id },
      },
      url: '/specs/analyses/analyze',
      cancelToken: cancelTokenSource?.token,
      showErrorIfAny: false,
    });

    let item;
    while ((item = reqs.shift())) {
      item[0](res.data);
    }
    return res.data;
  } catch (err: any) {
    let item;
    while ((item = reqs.shift())) {
      item[1](err);
    }
    return Promise.reject(err);
  }
}
export async function fetchSingleSpec(
  spec_id: string,
  service_id: string,
  cancelTokenSource?: CancelTokenSource,
) {
  const res = await doAjax({
    method: 'get',
    url: `/services/${service_id}/specs/${spec_id}`,
    params: { withDoc: true },
    cancelToken: cancelTokenSource?.token,
  });
  const { data } = res;
  addStoreServiceSpec(service_id, [data]);
  return data;
}

export async function fetchAnalyzersMeta(): Promise<AnalyzersMetaType[]> {
  const { data } = await doAjax({
    method: 'get',
    url: '/analyzers',
    params: { status: 'active' },
  });

  // hard code for test
  return data.filter((_: AnalyzersMetaType) => _.name_id !== 'security');
}

export async function fetchSpecAnalyses(specId: string, serviceId: string) {
  const res = await doAjax({
    url: `/services/${serviceId}/specs/${specId}/analyses`,
    method: 'get',
    params: { spec_id: specId, result_version: 1, withFindings: true },
  });

  const { data } = res;
  return data;
}

export async function getSpecAnalyses(
  specId: string,
  serviceId: string,
  transform: boolean,
) {
  const meta = await fetchAnalyzersMeta();
  const data = await fetchSpecAnalyses(specId, serviceId);

  if (transform && data) {
    return {
      ...getComplianceTableData(data, meta),
      drift: getDriftTableData(data, meta),
    };
  }
  return data;
}

export async function fetchSpecDiff({
  service_id,
  new_spec_id,
  old_spec_id,
}: {
  service_id: string;
  new_spec_id: string;
  old_spec_id: string;
  formatMarkdown?: boolean;
}): Promise<AnalyzersMetaType[]> {
  const { data } = await doAjax({
    method: 'POST',
    url: `/services/${service_id}/specs/diff`,
    data: { new_spec_id, old_spec_id },
  });

  return data;
}

export async function fetchDocDiff({
  new_spec_doc,
  old_spec_doc,
}: {
  new_spec_doc: string;
  old_spec_doc: string;
  formatMarkdown?: boolean;
}): Promise<AnalyzersMetaType[]> {
  const { data } = await doAjax({
    method: 'POST',
    url: '/specs/diffs/diff',
    data: { new_spec_doc, old_spec_doc },
  });
  console.log('fetchDocDiff data--🌹', data);
  return data;
}

export async function fetchServices(): Promise<APIService[]> {
  const res = await doAjax({ url: '/services' });
  return res.data;
}

export async function fetchServiceSpecs(
  service_id: string,
): Promise<APIServiceSpec[]> {
  const res = await doAjax({ url: `/services/${service_id}/specs` });
  return res.data;
}
