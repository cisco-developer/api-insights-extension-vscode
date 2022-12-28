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
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  CloudDownloadOutlined,
  DownOutlined,
  EditOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
// import 'react-circular-progressbar/dist/styles.css';
import './index.scss';
import {
  Button,
  Card,
  Collapse,
  Dropdown,
  Empty,
  List,
  Menu,
  Tabs,
  Tooltip,
} from 'antd';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import { useNavigate } from 'react-router-dom';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import {
  downloadFile,
  fetchSpecs,
  fetchSpecsAnalyses,
  getScoreLevel,
  openInEditorWithAnalyses,
  openFile,
  specDiff,
  specDiffWithLocal,
} from '../../../Service';
import { DRIFT } from '../../../../const';
import { ServiceDashboardProps, ServiceDashboardTabTypes } from './types';
import { APIServiceSpec } from '../../../../types';
import ScoreTrend from '../revision-detail/components/SpecAnalyses/ScoreTrend';
import ScoreLineChart from '../revision-detail/components/SpecAnalyses/ScoreLineChart';
import ServiceHeader, {
  renderRevisionTags,
} from '../../components/ServiceHeader';
import OpenInEditor from '../../components/OpenInEditor';

export type { ServiceDashboardProps, ServiceDashboardTabTypes };

const { TabPane } = Tabs;

function OpenInEditorChildrenWrapper(props: { history?: any[] }) {
  let { history } = props;
  if (!history) {
    history = [];
  }
  return (
    <Tooltip
      key="open"
      title="Open in Editor"
      {...(history.length
        ? { placement: 'bottom' }
        : {})}
    >
      <Button
        className="revision-actions_open-in-editor"
        icon={<EditOutlined />}
      >
        {history.length ? (
          <i className="codicon codicon-chevron-down" />
        ) : null}
      </Button>
    </Tooltip>
  );
}
export default function ServiceDashboard(props: ServiceDashboardProps) {
  const { apiService } = props;

  const [activeTab, setActiveTab] = useState<ServiceDashboardTabTypes>(
    props.activeTab || 'overall',
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAnalyses, setIsLoadingAnalyses] = useState(false);
  const [specs, setSpecs] = useState<null | APIServiceSpec[]>(null);
  const [expandedVersions, setExpandedVersions] = useState<string[]>([]);
  const [analyses, setAnalyses] = useState<any[] | null>([]);

  const fetchSpecFn = useCallback(() => {
    if (!apiService) return Promise.resolve(null);
    return fetchSpecs(webviewVsc, apiService.id).then((r) => {
      console.log('specs', r);
      setSpecs(r.data as APIServiceSpec[]);
      setIsLoading(false);
    });
  }, [apiService]);

  const fetchSpecsAnalysesFn = useCallback(() => {
    if (!apiService) return Promise.resolve(null);
    setIsLoadingAnalyses(true);
    return fetchSpecsAnalyses(webviewVsc, apiService.id).then((data) => {
      console.log('fetchSpecsAnalysesFn done');
      setAnalyses(data.data);
      setIsLoadingAnalyses(false);
    });
  }, [apiService]);

  useEffect(() => {
    setIsLoading(true);
    setExpandedVersions([]);
    Promise.all([fetchSpecFn(), fetchSpecsAnalysesFn()])
      .then((r) => { })
      .catch((e) => {
        setIsLoading(false);
        setIsLoadingAnalyses(false);
        setSpecs([]);
        // Modal.error({
        //   title: 'Request error',
        //   content: (e.name + ':') + e.message
        // })
      });
  }, [fetchSpecFn, fetchSpecsAnalysesFn]);

  const onTabChange = useCallback((key: string) => {
    setActiveTab(key as ServiceDashboardTabTypes);
  }, []);

  const openInEditor = useCallback(
    (spec: APIServiceSpec | string) => {
      if (spec) {
        if (typeof spec === 'string') {
          openFile(spec);
        } else {
          const { id, score } = spec;
          const _analyses = (analyses || []).filter(
            (item) => item.spec_id === id && item.analyzer !== DRIFT,
          );
          openInEditorWithAnalyses(
            { ...spec, service_name: apiService.name_id },
            { line: 0, character: 0 },
            _analyses,
            score,
          );
        }
      }
    },
    [analyses, apiService],
  );

  const service = apiService;

  const [specGroupByVersion, versions, latestRevision]: [
    Record<string, APIServiceSpec[]>,
    string[],
    APIServiceSpec
  ] = useMemo(() => {
    const specGroupByVersion: Record<string, APIServiceSpec[]> = {};
    let versions = [];
    let latestRevision = (service.summary || {}) as APIServiceSpec;
    if (specs) {
      specs.sort((a, b) => (new Date(a.updated_at) > new Date(b.updated_at) ? -1 : 1));
      specs.reduce((map, spec) => {
        map[spec.version] = map[spec.version] || [];
        map[spec.version].push(spec);
        return map;
      }, specGroupByVersion);

      [latestRevision] = specs;

      Object.assign(service.summary || {}, latestRevision);
    }

    versions = Object.keys(specGroupByVersion);

    return [specGroupByVersion, versions, latestRevision];
  }, [service.summary, specs]);
  console.log('latestRevision 🌹--', latestRevision);
  // if (!latestRevision) {
  //   latestRevision = (service.summary || {}) as APIServiceSpec;
  // }

  const headerOpenInEditor = useCallback(
    (path?: string) => {
      openInEditor(path || latestRevision);
    },
    [openInEditor, apiService],
  );

  const renderRevision = (
    revision: APIServiceSpec,
    isLatest?: boolean,
    showTags = false,
    titlePrefix = '',
  ) => {
    const score = revision.score || 0;
    return (
      <div className={`flex items-center ${getScoreLevel(score)}`}>
        <CircularProgressbar
          strokeWidth={8}
          value={score}
          text={revision.score === null ? '-' : `${score}`}
          styles={buildStyles({
            textSize: '32px',
          })}
        />
        <div>
          <div
            className={
              `flex items-center version-title title-prefix-${!!titlePrefix}`
            }
          >
            {titlePrefix && (
              <span className="revision-title-prefix">{titlePrefix}</span>
            )}
            <span className="revision-name">
              &nbsp;r
              {revision.revision}
            </span>
            {showTags
              ? renderRevisionTags(isLatest, revision.state === 'live')
              : null}
          </div>
          <div>
            <span className="__updated-at">
              Updated at
              {' '}
              {new Date(revision.updated_at).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderVersionHeader = (
    latestRevisionInVersion: APIServiceSpec,
    expanded: boolean,
  ) => {
    let header;
    const revisionTitlePrefix = `${service.title} ${latestRevisionInVersion.version}`;
    if (expanded) {
      header = <div>{revisionTitlePrefix}</div>;
    } else {
      header = renderRevision(
        latestRevisionInVersion,
        latestRevision && latestRevisionInVersion.id === latestRevision.id,
        !expanded,
        revisionTitlePrefix,
      );
    }
    return header;
  };

  const navigate = useNavigate();

  const getCompareSubMenuItems = (revisions, revision) => {
    const revisionList = revisions
      .filter((r) => r !== revision)
      .map((r) => {
        const fullname = `${r.version} / r${r.revision}`;
        return {
          label: fullname,
          key: r.id,
          onClick: () => specDiff(
            { ...r, service_name: service.name_id },
            { ...revision, service_name: service.name_id },
            analyses,
          ),
        };
      });
    const compareSubMenuItems: ItemType[] = revisionList.length
      ? [{ type: 'divider' }]
      : [];
    compareSubMenuItems.push({
      label: 'Choose a local spec',
      key: 'local',
      onClick: () => specDiffWithLocal({ ...revision, service_name: service.name_id }),
    });

    return [...revisionList, ...compareSubMenuItems];
  };

  return (
    <div className="service-dashboard_container flex flex-col">
      <ServiceHeader
        openInEditor={headerOpenInEditor}
        service={apiService}
        isRevisionMode={false}
        revisions={latestRevision ? specGroupByVersion[latestRevision.version] : []}
      />
      <Tabs activeKey={activeTab} onChange={onTabChange}>
        <TabPane tab="Overall" key="overall">
          <Card title="Description" bordered={false} className="overall-desc">
            {apiService.description}
          </Card>

          <Card
            title={`Version History ${specs === null || specs.length < 1 ? '' : `(${versions.length})`}`}
            bordered={false}
            className="specs"
          // extra={
          //   <div className="switch-achived-hidden flex items-center">
          //     <Switch
          //       size="small"
          //       onChange={(e) => console.log("archived changed", e)}
          //     />
          //     <span>Hide Archived Revisions</span>
          //   </div>
          // }
          >
            {isLoading ? (
              <LoadingOutlined />
            ) : (specs.length < 1 && (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No Version History"
              />
            )) || (
              <Collapse
                activeKey={expandedVersions}
                onChange={(e) => setExpandedVersions(e as any)}
                className="version-groups"
                expandIconPosition="end"
              >
                {versions.map((version) => {
                  const expanded = expandedVersions.indexOf(`v-key-${version}`) > -1;
                  const revisions = specGroupByVersion[version];
                  const header = renderVersionHeader(revisions[0], expanded);
                  let extra = null;
                  if (!expanded) {
                    extra = (
                      <Tooltip
                        title="Trends over the last 10 revisions"
                        placement="top"
                        align={{ offset: [0, 8] }}
                      >
                        <div>
                          <ScoreLineChart revisions={revisions} />
                        </div>
                      </Tooltip>
                    );
                  }
                  return (
                    <Collapse.Panel
                      header={header}
                      key={`v-key-${version}`}
                      extra={extra}
                    >
                      {analyses && analyses.length && !isLoadingAnalyses ? (
                        <ScoreTrend
                          key="score-trend"
                          revisions={revisions}
                          analyses={analyses}
                        />
                      ) : (analyses === null && (
                        <Empty
                          className="score-trends-no-data"
                          image={<div className="score-trends-no-data-image" />}
                        />
                      )) || (
                        <LoadingOutlined />
                      )}
                      <List
                        dataSource={revisions}
                        renderItem={(revision) => (
                          <List.Item
                            className="revision-actions"
                            actions={[
                              <Tooltip key="view" title="View Full Report">
                                <Button
                                  onClick={() => navigate('/service/compliance', {
                                    state: { apiService, revision, revisions },
                                  })}
                                  icon={(
                                    <i
                                      style={{ display: 'flex' }}
                                      className="justify-center codicon codicon-eye"
                                    />
                                  )}
                                />
                              </Tooltip>,
                              <Tooltip key="download" title="Download">
                                <Button
                                  onClick={() => {
                                    downloadFile({
                                      ...revision,
                                      service_name: service.name_id,
                                    });
                                  }}
                                  icon={<CloudDownloadOutlined />}
                                />
                              </Tooltip>,
                              <OpenInEditor
                                spec={revision}
                                onClick={(type, path) => {
                                  openInEditor(path || revision);
                                }}
                              >
                                <OpenInEditorChildrenWrapper />
                              </OpenInEditor>,
                              <Tooltip
                                key="compare"
                                title="Compare"
                                placement="bottom"
                              >
                                <Dropdown
                                  placement="top"
                                  overlay={(
                                    <Menu
                                      items={getCompareSubMenuItems(
                                        revisions,
                                        revision,
                                      )}
                                    >
                                      {' '}
                                    </Menu>
                                  )}
                                >
                                  <Button
                                    className="compare-btn-icon-only flex items-center justify-center"
                                    icon={
                                      <span className="codicon codicon-diff" />
                                    }
                                  >
                                    <i className="codicon codicon-chevron-down" />
                                  </Button>
                                </Dropdown>
                              </Tooltip>,
                            ]}
                          >
                            {expanded ? renderRevision(
                              revision,
                              true,
                              latestRevision && revision.id === latestRevision.id,
                            ) : null}
                          </List.Item>
                        )}
                      />
                    </Collapse.Panel>
                  );
                })}
              </Collapse>
            )}
          </Card>
        </TabPane>
        {/* <TabPane tab="Reconstucted" key="reconstucted">
          TBD...
        </TabPane> */}
        {/* <TabPane tab="Specs" key="spec">
          <ServiceSpec apiService={apiService}></ServiceSpec>
        </TabPane> */}
      </Tabs>
    </div>
  );
}
