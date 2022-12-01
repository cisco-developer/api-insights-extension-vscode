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

import { BASE_NAME } from './const';

export const DIFF_COMMAND = `${BASE_NAME}.specDiff`;
export const LOCAL_DIFF_COMMAND = `${BASE_NAME}.specDiffWithLocal`;
export const GO_TO_DEFINITION_COMMAND = `${BASE_NAME}.goToDefinitionWhenSpecDiff`;
export const EDIT_FILE_COMMAND = `${BASE_NAME}.editFileWhenSpecDiff`;
export const VIEW_CHANGELOG_COMMAND = `${BASE_NAME}.viewChangelog`;
export const SELECT_SPEC_COMPARE_ITEM_COMMAND = `${BASE_NAME}.selectSpecCompareItem`;
export const READ_COMMAND = `${BASE_NAME}.readFile`;
export const EDIT_COMMAND = `${BASE_NAME}.editFile`;
export const ADD_FILE_DIAGNOSTIC_COMMAND = `${BASE_NAME}.addFileDiagnostic`;
export const OPEN_FILE_DIAGNOSTIC_COMMAND = `${BASE_NAME}.openFileDiagnostic`;
export const CLEAN_DIAGNOSTICS_COMMAND = `${BASE_NAME}.cleanDiagnostics`;
export const UPDATE_BAR_STATUS_COMMAND = `${BASE_NAME}.updateBarStatus`;
export const UPDATE_FILE_DIAGNOSTIC_COLLECTION_COMMAND = `${BASE_NAME}.updateFileDiagnosticCollection`;
export const SAVE_ON_LOCAL_COMMAND = `${BASE_NAME}.saveOnLocal`;
export const UPLOAD_COMMAND = `${BASE_NAME}.uploadToCloud`;
export const WELCOME_COMMAND = `${BASE_NAME}.welcome`;
export const CONFIGURE_EXPLORER_COMMAND = `${BASE_NAME}.configureExplorer`;
