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
  ExtensionContext,
  commands,
  Uri,
  window,
  QuickInputButton,
  QuickInputButtons,
  QuickPickItem,
  Disposable,
  QuickInput,
  workspace,
} from 'vscode';

import {
  LOCAL_DIFF_COMMAND,
  DIFF_COMMAND,
  SELECT_SPEC_COMPARE_ITEM_COMMAND,
} from '../../commands';
import { getQueryFromSpecUri } from '../util';
import { FILE_SCHEME, FileQuery } from '../../types';
import { fetchServices, fetchServiceSpecs } from '../services';
import { downloadMemCache } from '../fileViewer';
import { getConfiguration } from '../util/extUtils';

function hasEndpoint() {
  const { endpoint } = getConfiguration();
  if (!endpoint) {
    commands.executeCommand('setContext', 'hasEndpoint', false);
  } else {
    commands.executeCommand('setContext', 'hasEndpoint', true);
  }
}

// eslint-disable-next-line no-use-before-define
type InputStep = (input: MultiStep) => Promise<InputStep | void>;
type QuickPickParams<T extends QuickPickItem> = {
  step: number;
  totalSteps: number;
  placeholder: string;
  title?: string;
  items: T[];
  activeItems?: T[];
  buttons?: QuickInputButton[];
  value?: string;
};

type SpecsMapItem = {
  value: string;
  id: string;
  score: number;
  updated_at: string;
};

type State = {
  originUri: Uri;
  service?: string;
  service_id?: string;
  spec_id?: string;
  version?: string;
  revision?: string;
  score?: number;
  updated_at?: string;
};

const enum Placeholder {
  service = 'Please select a service',
  version = 'Please select a spec version',
  revision = 'Please select a spec revision',
}

const enum CompareTarget{
  local='Choose a local spec'
}

class MultiStep {
  private steps: InputStep[] = [];

  private current?: QuickInput;

  static run(start: InputStep | InputStep[] | void) {
    const multiStep = new MultiStep();
    multiStep.stepThrough(start);
  }

  private async stepThrough(start: InputStep | InputStep[] | void) {
    let step;
    if (Array.isArray(start)) {
      step = start.shift();
      while ((step) && start.length) {
        this.steps.push(step);
        step = start.shift();
      }
    } else {
      step = start;
    }
    while (step) {
      try {
        if (this.current) {
          this.current.enabled = false;
          this.current.busy = true;
        }
        this.steps.push(step);
        // eslint-disable-next-line no-await-in-loop
        step = await step(this);
      } catch (e) {
        switch (e) {
          // FlowAction.back
          case QuickInputButtons.Back:
            this.steps.pop();
            step = this.steps.pop();
            break;
          default: return null;
        }
      }
    }
    if (this.current) {
      this.current.dispose();
    }
    return null;
  }

  async showQuickPick<T extends QuickPickItem>(params: QuickPickParams<T>) {
    const disposables: Disposable[] = [];
    try {
      return await new Promise<T[]>((resolve, reject) => {
        const {
          items,
          step,
          totalSteps,
          placeholder,
          title,
          buttons,
          value,
          activeItems,
        } = params;
        const pick = window.createQuickPick();
        pick.items = items;
        if (totalSteps !== 0) {
          pick.step = step;
          pick.totalSteps = totalSteps;
        }
        pick.placeholder = placeholder;
        pick.title = title;
        if (value) pick.value = value;
        if (activeItems) { pick.activeItems = activeItems; }
        pick.buttons = [
          ...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
          ...(buttons || []),
        ];

        disposables.push(
          pick.onDidChangeSelection((item) => {
            resolve(<any>item);
          }),
          pick.onDidTriggerButton((item) => {
            if (item === QuickInputButtons.Back) {
              // FlowAction.back
              reject(QuickInputButtons.Back);
            }
          }),
        );
        this.current = pick;
        this.current.show();
      });
    } finally {
      disposables.forEach((_) => _.dispose());
    }
  }
}

function selectSpecCompareItemCommand(uri: Uri) {
  async function diff(state: State) {
    const {
      spec_id, service, originUri, revision,
    } = state;
    const spec = {
      ...state,
      id: spec_id,
      service_name: service,
    };
    if (originUri.scheme === FILE_SCHEME.read) {
      const query = getQueryFromSpecUri(originUri);
      const {
        serviceName, specId, updatedAt, serviceId,
      } = query;
      const originSpec = {
        ...query,
        id: specId,
        service_id: serviceId,
        service_name: serviceName,
        updated_at: updatedAt,
      };
      if (revision === CompareTarget.local) {
        await commands.executeCommand(LOCAL_DIFF_COMMAND, originSpec);
      } else {
        await commands.executeCommand(DIFF_COMMAND, spec, originSpec);
      }
    } else {
      await commands.executeCommand(LOCAL_DIFF_COMMAND, spec, originUri);
    }
  }

  async function selectRevision(
    input: MultiStep,
    state: State,
    totalSteps: number,
    revisions: SpecsMapItem[],
    step?: number,
  ) {
    const { service, version } = state;
    const items = revisions.map((_) => ({ label: _.value }));
    const pick = await input.showQuickPick({
      step: step || 3,
      totalSteps,
      placeholder: Placeholder.revision,
      title: `${service} ${version}`,
      items,
    });
    state.revision = pick[0].label;
    const spec = revisions.filter((_) => _.value === state.revision)[0] || {};
    state.spec_id = spec.id;
    state.updated_at = spec.updated_at;
    state.score = spec.score;
    return () => diff(state);
  }
  async function selectVersion(
    input: MultiStep,
    state: State,
    totalSteps: number,
  ) {
    const { service, service_id } = state;
    if (service && service_id) {
      const specs = await fetchServiceSpecs(service_id);
      const specsMap = new Map<string, SpecsMapItem[]>();
      specs.forEach((item) => {
        const {
          version, revision, id, score, updated_at,
        } = item;
        const revisions = specsMap.get(version) || [];
        revisions.push({
          value: revision, id, score, updated_at,
        });
        specsMap.set(version, revisions);
      });
      const items = Array.from(specsMap.keys()).map((_) => ({ label: _ }));
      const pick = await input.showQuickPick({
        step: 2,
        totalSteps,
        placeholder: Placeholder.version,
        title: service,
        items,
        activeItems: (state.version && [{ label: state.version }]) || undefined,
      });
      state.version = pick[0].label;
      const revisions = specsMap.get(state.version);
      if (revisions) {
        return (input: MultiStep) => selectRevision(input, state, totalSteps, revisions);
      }
    }
    // return null;
  }
  async function selectService(
    input: MultiStep,
    state: State,
    totalSteps: number,
  ) {
    const service = await fetchServices();
    const items = service.map((_) => ({ label: _.title }));
    const pick = await input.showQuickPick({
      items,
      step: 1,
      totalSteps,
      placeholder: Placeholder.service,
    });
    state.service = pick[0].label;
    state.service_id = (
      service.filter((_) => _.title === state.service)[0] || {}
    ).id;
    return (input: MultiStep) => selectVersion(input, state, totalSteps);
  }

  async function collectLocalSpecInputs() {
    const totalSteps = 3;
    const state: State = {
      originUri: uri,
    };
    MultiStep.run((input) => selectService(input, state, totalSteps));
  }

  async function collectRemoteSpecInputs() {
    const totalSteps = 0;
    const {
      version, serviceName, serviceId, specId,
    } = getQueryFromSpecUri(uri);
    const state: State = {
      originUri: uri,
      service: serviceName,
      service_id: serviceId,
      version,
    };
    const specs = await fetchServiceSpecs(serviceId);
    const revisions = specs
      .filter((_) => _.version === version && _.id !== specId)
      .map((item) => {
        const {
          revision, id, score, updated_at,
        } = item;
        return {
          value: revision, id, score, updated_at,
        };
      });
    revisions.push({
      value: CompareTarget.local,
      id: '',
      score: 0,
      updated_at: '',
    });
    MultiStep.run((input) => selectRevision(input, state, totalSteps, revisions));
  }

  async function collectDownloadSpecInputs(meta: FileQuery) {
    const totalSteps = 3;
    const { serviceName, serviceId, version } = meta;
    const state: State = {
      originUri: uri,
      service: serviceName,
      service_id: serviceId,
      version,
    };
    MultiStep.run([
      (input) => selectService(input, state, totalSteps),
      (input) => selectVersion(input, state, totalSteps),
    ]);
  }

  if (uri.scheme === FILE_SCHEME.read) {
    collectRemoteSpecInputs();
  } else {
    const { path } = uri;
    const meta = downloadMemCache.get(path);
    if (meta) {
      collectDownloadSpecInputs(meta);
    } else {
      collectLocalSpecInputs();
    }
  }
}

export default function compareStart(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand(
      SELECT_SPEC_COMPARE_ITEM_COMMAND,
      selectSpecCompareItemCommand,
    ),
    workspace.onDidChangeConfiguration((e) => {
      hasEndpoint();
    }),
  );
  hasEndpoint();
}
