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
  DownOutlined,
  EditOutlined,
  MoreOutlined,
} from '@ant-design/icons';
// import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import {
  Breadcrumb, Button, Dropdown, Menu, Tooltip,
} from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { useCallback } from 'react';
import { buildStyles, CircularProgressbar } from 'react-circular-progressbar';
import { useNavigate } from 'react-router-dom';
import OpenInEditor, { OpenType } from '../OpenInEditor';
import { APIService, APIServiceSpec } from '../../../../types';
import {
  getScoreLevel,
  downloadFile,
  specDiff,
  specDiffWithLocal,
} from '../../../Service';
import './index.scss';

export type ServiceHeaderProps = {
  service: APIService;
  revision?: APIServiceSpec;
  revisions?: APIServiceSpec[];
  openInEditor: (path?: string) => void;
  isRevisionMode?: boolean;
};
export const renderRevisionTags = function (
  isLatest: boolean,
  isLive: boolean,
) {
  return (
    <>
      {isLatest ? (
        <span className="service-tag tag-latest flex items-center">Latest</span>
      ) : null}
      {isLive ? (
        <span className="service-tag tag-live flex items-center">
          <i className="codicon codicon-pulse" />
          Live
        </span>
      ) : null}
    </>
  );
};

type RevistionActionsProps = {
  service: APIService;
  revision: APIServiceSpec;
  revisions: APIServiceSpec[];
  analyses?: any[];
  allAnalyses?: any[];
};
export function RevisionActions(props: RevistionActionsProps) {
  const {
    revision, revisions, service, analyses, allAnalyses,
  } = props;
  const download = useCallback(() => {
    downloadFile({ ...revision, service_name: service.name_id });
  }, [revision, service]);

  const compare = useCallback(
    (compareWith: APIServiceSpec) => {
      const serviceName = service.name_id;
      specDiff(
        { ...compareWith, service_name: serviceName },
        { ...revision, service_name: serviceName },
        analyses,
      );
    },
    [revision, service, analyses],
  );

  const compareWithLocal = useCallback(() => {
    specDiffWithLocal({ ...revision, service_name: service.name_id });
  }, [revision, service]);

  if (!revisions || !revisions) return null;

  const revisionList = revisions
    .filter((r) => r !== revision)
    .map((r) => {
      const fullname = `${r.version} / r${r.revision}`;
      return { label: fullname, key: r.id, onClick: () => compare(r) };
    });
  const compareSubMenuItems: ItemType[] = revisionList.length
    ? [{ type: 'divider' }]
    : [];
  compareSubMenuItems.push({
    label: 'Choose a local spec',
    key: 'local',
    onClick: compareWithLocal,
  });
  return (
    <Dropdown
      overlay={(
        <Menu
          onClick={(v) => {
            // console.log("selected compare item", v);
          }}
          items={[
            // {
            //   label: "Live",
            //   icon: <i className="codicon codicon-pulse"></i>,
            //   key: "live",
            // },
            {
              label: 'Download',
              icon: <i className="codicon codicon-cloud-download" />,
              key: 'download',
              onClick: download,
            },
            {
              key: 'submenu',
              label: 'Compare',
              icon: <i className="codicon codicon-diff" />,
              children: [...revisionList, ...compareSubMenuItems],
            },
            // {
            //   label: "Archive",
            //   icon: <i className="codicon codicon-package"></i>,
            //   key: "archive",
            // },
          ]}
        />
      )}
    >
      <Button
        className="revision-actions-more"
        icon={<MoreOutlined className="rotate-90" />}
      />
    </Dropdown>
  );
}

function OpenInEditorChildrenWrapper(props: { history?: any[] }) {
  let { history } = props;
  if (!history) {
    history = [];
  }
  return (
    // <VSCodeButton appearance></VSCodeButton>
    <Button>
      <EditOutlined style={{ marginRight: 8 }} />
      Open in Editor
      {history.length ? <span className="open-in-editor_icon_down codicon codicon-chevron-down" /> : null}
    </Button>
  );
}
function ServiceHeader(props: ServiceHeaderProps) {
  const {
    service, revision, revisions, openInEditor, isRevisionMode,
  } = props;
  let title; let
    score;
  const navigate = useNavigate();

  const handleOpenInEditor = useCallback(
    (type: OpenType, path?: string) => {
      openInEditor(path);
    },
    [openInEditor],
  );

  if (isRevisionMode) {
    score = revision.score;
    const getVersionLabel = (revision: APIServiceSpec) => `${revision.version} / r${revision.revision}`;
    const menus = revisions.map((revision) => {
      const label = getVersionLabel(revision);
      return {
        label,
        key: revision.id,
        id: revision.id,
      };
    });

    title = (
      <>
        <span className="__version">
          {revision.version}
          {' '}
          /
          {' '}
        </span>
        <span className="__revision ml-4">
          r
          {revision.revision}
        </span>
        {renderRevisionTags(
          revision.id === revisions[0].id,
          revision.state === 'live',
        )}
        <Dropdown
          overlay={(
            <Menu
              onClick={(item) => {
                navigate('/service/compliance', {
                  state: {
                    revision: revisions.find(
                      (revision) => revision.id === item.key,
                    ),
                    revisions,
                  },
                });
              }}
              items={menus}
              defaultSelectedKeys={[revision.id]}
              selectedKeys={[revision.id]}
              className="revision-selector-menu"
            />
          )}
          trigger={['click']}
          placement="bottomRight"
        >
          <DownOutlined />
        </Dropdown>
      </>
    );
  } else {
    const {
      score: _score,
      version,
      revision,
    } = service.summary || props.revision || { score: null };
    score = _score;

    title = (
      <>
        {service.title}
        {revision ? (
          <>
            <span className="__version">{version}</span>
            <span className="__revision ml-4">
              r
              {revision}
            </span>
            {renderRevisionTags(
              true,
              false,
            )}
          </>
        ) : null}
      </>
    );
  }

  const colorType = getScoreLevel(score);

  return (
    <header className="service-header">
      <div className="flex flex-row">
        <Tooltip
          title="API Score"
          placement="bottom"
          align={{ offset: [0, -15] }}
        >
          <div className={`__score ${colorType}`}>
            <CircularProgressbar
              strokeWidth={8}
              value={score || 0}
              text={score === null ? '-' : `${score}`}
              styles={buildStyles({
                textSize: '32px',
              })}
            />
          </div>
        </Tooltip>
        <div className="__detail">
          {
            // @ts-ignore
            <Breadcrumb>
              {
                // @ts-ignore
                <Breadcrumb.Item>{service?.product_tag}</Breadcrumb.Item>
              }
              {isRevisionMode ? (
                <Breadcrumb.Item
                  className="cursor-pointer"
                  onClick={() => (isRevisionMode ? navigate('/dashboard/overall') : null)}
                >
                  {service.title}
                </Breadcrumb.Item>
              ) : null}
            </Breadcrumb>
          }
          <div className="service-name flex items-center">{title}</div>
          <span className="__updated-at">
            Updated:&nbsp;
            {' '}
            {new Date(
              isRevisionMode ? revision.updated_at : service.updated_at,
            ).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="service-header__actions flex">
        <OpenInEditor
          onClick={handleOpenInEditor}
          spec={{ ...service.summary, service_id: service.id }}
        >
          <OpenInEditorChildrenWrapper />
        </OpenInEditor>
        {isRevisionMode ? (
          <RevisionActions
            service={service}
            revisions={revisions}
            revision={revision}
          />
        ) : null}
      </div>
    </header>
  );
}

export default ServiceHeader;
