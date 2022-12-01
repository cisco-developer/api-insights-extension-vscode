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

// eslint-disable-next-line import/extensions
import { Uri, DiagnosticCollection, TextDocument } from 'vscode';
import { DiffSummaryChangeType } from './const';
import { Configuration } from './common';

export enum API_SERVICE_TYPES {
  INTERNAL = 'INTERNAL',
  EXTERNAL = 'EXTERNAL',
}

export type APIService = {
  id: string;
  name?: string;
  title: string;
  port: number;
  product_tag?: string;
  name_id: string;
  updated_at?: string;
  description?: string;
  summary?: {
    score: number;
    revision: string;
    version: string;
    updated_at?: string;
  };
};
export type Organization = {
  name_id: string,
  title: string
}
export type APIServiceSpec = {
  id: string;
  revision: string;
  service_id: string;
  state: string;
  updated_at: string;
  version: string;
  score: number;
  doc_type: string;
  doc: string;
  valid: string;
  created_at: string;
  service_name?: string;
};

export type LocalSpec = {
  title: string;
  score: number;
  updated_at: string;
  path: string;
};

export type SpecType = APIServiceSpec | LocalSpec;

export enum SPEC_TYPES {
  PROVIDED = 'PROVIDED',
  RECONSTRUCTED = 'RECONSTRUCTED',
  RECONSTRUCTED_SUGGESTED_REVIEW = 'RECONSTRUCTED_SUGGESTED_REVIEW',
}

export type TaggedSpec = {
  type?: SPEC_TYPES;
  name: string;
  methodAndPathList: {
    method: string;
    path: string;
    pathId?: string;
  }[];
};
export type RemoteSpec = {
  tags: TaggedSpec[];
};
export type RemoteSpecs = {
  reconstructedSpec?: RemoteSpec;
  providedSpec?: RemoteSpec;
};

type Range = {
  line: number;
  column: number;
};

export type AffectedItem = {
  type: 'range';
  path: string[];
  range: {
    start: Range;
    end: Range;
  };
};

export type Analyses = {
  analyzer: string;
  message: string;
  mitigation: string;
  ruleKey: string;
  severity: 'error' | 'hint' | 'info' | 'warning';
  data: AffectedItem[];
};

export type Analyse = Pick<Analyses, Exclude<keyof Analyses, 'data'>>;

export type Summary = {
  error: number;
  hint: number;
  info: number;
  warning: number;
};

export type Position = { line: number; character: number };

export type AnalyzersMetaType = {
  created_at: string;
  updated_at: string;
  id: string;
  name_id: string;
  title: string;
  status: 'inactive' | 'active';
};

export const enum FILE_SCHEME {
  edit = 'API-Insights',
  read = 'API-Insights-readonly',
}

export type FileQuery = {
  specId: string;
  serviceId: string;
  serviceName: string;
  score: string;
  updatedAt: string;
  version: string;
  revision: string;
};

export type UploadCache = {
  [key: string]: FileQuery & {
    mtime?: Date;
    setting?: Configuration;
  };
};

export type DiffSummaryUpdateData = {
  newSpec: APIServiceSpec | Uri;
  oldSpec: APIServiceSpec | Uri;
  changeType: DiffSummaryChangeType;
};

declare global {
  const EXT_TYPE: 'web' | 'ide';
}

export type SpecProps = {
  swagger?: string;
  openapi?: string;
};

export interface Linter {
  collection: DiagnosticCollection
  analysesMap: { [key: string]: Analyses[] }
  lint(document: TextDocument):void | Thenable<void>;
  deleteDiagnostic(uri: Uri):void
}
