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
  useState, useEffect, useCallback, useMemo,
} from 'react';
import ReactDOM from 'react-dom';
import {
  VSCodeButton,
  VSCodeDivider,
  VSCodeLink,
  VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import {
  Badge, Collapse, Empty, Tooltip,
} from 'antd';
import { CloseCircleFilled } from '@ant-design/icons';
import { Configuration } from '../../common';
import { APIService, Organization } from '../../types';
import {
  postOpenAPIServicePanelMessageToExtension,
  postOpenNativeSettingMessageToExtension,
  postVSCodeCommandExecuteMsgToExtension,
} from '../toExtensionMessageSender';
import Loader from '../service-detail/components/Loader';
import { useConfiguration, useRecieveReloadMsg } from '../msgListenerHooks';
import { fetchOrganizations, fetchServices, getScoreLevel } from '../Service';

import './index.scss';
// import '../antd.dark.scss';
// import '../antd.light.scss';
import { CONFIGURE_EXPLORER_COMMAND, WELCOME_COMMAND } from '../../commands';
import useAntdThemeCss from '../hooks/useAntdThemeCss';

const { Panel } = Collapse;

const isCfgReadyFn = (cfg?: Configuration) => cfg && cfg.endpoint;
const apiServiceListToMap = (list = []) => list.reduce((map, service) => {
  const org = service.organization_id;
  map[org] = map[org] || [];
  map[org].push(service);
  return map;
}, {});
function BaseComponent() {
  const [isLoading, setIsLoading] = useState(true);
  const [apiServices, setApiServices] = useState<APIService[]>([]);
  const [orgList, setOrgList] = useState<Organization[]>([]);
  const [filterKey, setFilterKey] = useState<string>('');
  const [selectedApiServiceId, setSelectedApiServiceId] = useState<
    undefined | string
  >();
  const [apiError, setApiError] = useState(false);
  const [expandedServiceGroups, setExpandedServiceGroups] = useState<string[]>(
    [],
  );

  const cfg = useConfiguration(webviewVsc);
  useAntdThemeCss();

  const reloadPage = async (force?: boolean) => {
    setIsLoading(true);
    setApiError(false);

    // @ts-ignore
    const { showErrorIfAny } = cfg;
    // @ts-ignore
    if (cfg.showErrorIfAny === false) {
      // @ts-ignore
      delete cfg.showErrorIfAny;
    }
    const promise = Promise.all([
      fetchServices(webviewVsc, {
        showErrorIfAny,
        ...(force
          ? {
            cache: false,
          }
          : {}),
      }),
      fetchOrganizations(webviewVsc, {
        showErrorIfAny,
        ...(force
          ? {
            cache: false,
          }
          : {}),
      }),
    ]);
    promise.then(([serviceListResp, orgListResp]) => {
      console.log('get service data=>', serviceListResp);
      if (serviceListResp) {
        setApiServices(serviceListResp.data);
      }

      if (orgListResp) {
        setOrgList(orgListResp.data);
      }

      setIsLoading(false);
    }).catch((r) => {
      console.error('get service list/org error', r);
      setIsLoading(false);
      setApiError(true);
    });
    return promise;
  };

  useRecieveReloadMsg(null, () => reloadPage(true));

  useEffect(() => {
    let releaseFn = () => { };
    if (cfg === undefined) return;
    if (!isCfgReadyFn(cfg as any)) {
      postOpenNativeSettingMessageToExtension(webviewVsc);
      setIsLoading(false);
    } else {
      const promise = reloadPage();
      // @ts-ignore
      releaseFn = promise.release;
    }

    // eslint-disable-next-line consistent-return
    return releaseFn;
  }, [cfg]);

  const onConfigItNowClicked = () => {
    postVSCodeCommandExecuteMsgToExtension(
      webviewVsc,
      'executeCommand',
      [CONFIGURE_EXPLORER_COMMAND],
      'commands',
    );
  };

  const onLearnMoreClicked = (e) => {
    e.preventDefault();
    postVSCodeCommandExecuteMsgToExtension(
      webviewVsc,
      'executeCommand',
      [WELCOME_COMMAND],
      'commands',
    );
  };

  const cfgNotReadyView = (
    <div className="cfg-not-ready">
      <div className="__title">
        <div className="codicon codicon-report" />
        Hi, Welcome to API
        Insights
      </div>
      <div className="__content">
        You are currently using basic features of API Insights extension.
        If you have an API Insights service instance, configure now to unlock more features.
      </div>
      <div className="__actions">
        <VSCodeButton onClick={onConfigItNowClicked}>
          Configure It Now
        </VSCodeButton>
        <VSCodeLink onClick={onLearnMoreClicked}>Learn More</VSCodeLink>
      </div>
    </div>
  );

  const onFilterKeyChanged = useCallback((evt: any) => {
    setFilterKey(evt.target.value.trim());
  }, []);

  const apiServiceMap = useMemo(() => apiServiceListToMap(
    filterKey
      ? apiServices.filter((apiService) => (
        apiService.title
          .toLocaleLowerCase()
          .indexOf(filterKey.toLowerCase()) > -1
      ))
      : apiServices,
  ) as Record<string, APIService[]>, [apiServices, filterKey]);

  const orgNameMap = useMemo(() => orgList.reduce((map, org) => {
    map[org.name_id] = org.title;
    return map;
  }, {}), [orgList]);

  const onServiceItemClick = (apiService: APIService) => {
    setSelectedApiServiceId(apiService.id);
    postOpenAPIServicePanelMessageToExtension(webviewVsc, apiService);
  };

  const mapKVList = Object.entries(apiServiceMap);

  const servicePanels = (
    // @ts-ignore
    <Collapse
      activeKey={filterKey ? Object.keys(apiServiceMap) : expandedServiceGroups}
      onChange={(e) => setExpandedServiceGroups(e as string[])}
    >
      {mapKVList.map(([orgId, services]) => (
        <Panel header={`${orgNameMap[orgId] || orgId} (${services.length})`} key={orgId}>
          {services.map((apiService) => {
            const score = apiService.summary?.score;
            const isScoreReady = score !== undefined && score !== undefined;
            return (
              <div
                className={
                  `__list-item mt-4 w-full cursor-pointer ${selectedApiServiceId === apiService.id ? ' active' : ''}`
                }
                key={apiService.id}
                onClick={() => onServiceItemClick(apiService)}
              >
                {apiService.title}
                <Tooltip
                  title="API Score"
                  placement="top"
                  align={{ offset: [0, 5] }}
                >
                  <span
                    className={`__list-item-score ${isScoreReady ? getScoreLevel(score) : ''}`}
                  >
                    <Badge
                      title=""
                      className="ant-badge-multiple-words"
                      overflowCount={1000}
                      count={!isScoreReady ? '-' : score}
                    />
                  </span>
                </Tooltip>
              </div>
            );
          })}
        </Panel>
      ))}
    </Collapse>
  );

  // @ts-ignore
  const ApiListView = (
    <div className="api-service-list flex justify-center mt-6 px-6 max-w-md mx-auto flex-col">
      <div className="__filter w-full">
        <VSCodeTextField
          onInput={onFilterKeyChanged}
          value={filterKey}
          inputMode="search"
          className="w-full filter-input relative"
          placeholder="Search Services"
        >
          <span slot="start" className="codicon codicon-search" />
          {filterKey && filterKey.trim() ? (
            <CloseCircleFilled onClick={() => setFilterKey('')} />
          ) : null}
        </VSCodeTextField>
      </div>
      <div className="__list w-full">
        {mapKVList.length > 0 ? (
          servicePanels
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              apiServices.length === 0 ? 'No data' : 'No keyword match'
            }
          />
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="logo-container flex-col">
        <img className="logo-dark" src={darkLogoUri} alt="api-insights-logo" />
        <img
          className="logo-light"
          src={lightLogoUri}
          alt="api-insights-logo"
        />
        <VSCodeDivider />
      </div>
      {isLoading ? (
        <Loader />
      ) : ((!isCfgReadyFn(cfg as any) || apiError) && (
        cfgNotReadyView
      )) || (
        ApiListView
      )}
    </>
  );
}

ReactDOM.render(<BaseComponent />, document.getElementById('app'));
