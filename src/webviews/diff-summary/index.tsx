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

import React, {
  useState, useCallback, useMemo, useEffect,
} from 'react';
import ReactDOM from 'react-dom';
import dayjs from 'dayjs';
import { Button, Card, Switch, Skeleton } from 'antd';

// import 'antd/dist/antd.dark.min.css';
import './index.scss';
import { DiffSpecs } from './types';
import { useDiffSummaryUpdateMsg } from '../msgListenerHooks';
import { DiffSummaryChangeType } from '../../const';
import Score from './components/Score';
import Changes from './components/Changes';
import Summary from '../components/Summary';
import { getSpecFileName } from '../../util';
import useGenDiffSummary from './hooks/useGenDiffSummary';
import { DIFF_SUMMARY_MSG_TYPES } from '../../common';
import { viewChangelog } from '../Service';
import ChangesSkeleton from './components/ChangesSkeleton';
import useAntdThemeCss from '../hooks/useAntdThemeCss';

const gridStyle: React.CSSProperties = {
  width: '50%',
  textAlign: 'center',
};

const TIME_FORMATE = 'MM/DD/YYYY, HH:mm:ss';

function BaseComponent() {
  const [oldSpecAnalyseSummary, setOldSpecAnalyseSummary] = useState(null);
  const [newSpecAnalyseSummary, setNewSpecAnalyseSummary] = useState(null);

  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  const [oldSpec, setOldSpec] = useState<DiffSpecs['oldSpec']>(null);
  const [newSpec, setNewSpec] = useState<DiffSpecs['newSpec']>(null);

  const [diffSummary, setDiffSummary] = useState(null);

  const [showUpdateMessage, setShowUpdateMessage] = useState(false);

  const diffSpecs = useMemo(() => ({ oldSpec, newSpec }), [oldSpec, newSpec]);

  useAntdThemeCss();
  useEffect(() => {
    // @ts-ignore
    webviewVsc.postMessage({ type: DIFF_SUMMARY_MSG_TYPES.APP_IS_READY });
    // @ts-ignore
    globalInitialized = true;
  }, []);

  const { data: _diffSummary, totalBreaking } = useGenDiffSummary(
    diffSummary,
    checked,
  );

  useDiffSummaryUpdateMsg({ oldSpec: null, newSpec: null }, (data) => {
    const {
      newSpec,
      oldSpec,
      loading,
      diffSummary,
      oldSpecAnalyseSummary,
      newSpecAnalyseSummary,
      changeType,
    } = data;
    if (loading === true) {
      setLoading(loading);
      setDiffSummary(null);
    } else if (loading === false) {
      setLoading(loading);
    }

    if (oldSpec || oldSpec === null) {
      setOldSpec(oldSpec);
    }

    if (newSpec || newSpec === null) {
      setNewSpec(newSpec);
    }
    if (diffSummary) {
      setDiffSummary(diffSummary);
    }

    if (oldSpecAnalyseSummary || oldSpecAnalyseSummary === null) {
      setOldSpecAnalyseSummary(oldSpecAnalyseSummary);
    }
    if (newSpecAnalyseSummary || newSpecAnalyseSummary === null) {
      setNewSpecAnalyseSummary(newSpecAnalyseSummary);
    }

    if (changeType === DiffSummaryChangeType.save) {
      if (!showUpdateMessage) {
        setShowUpdateMessage(true);
      }
    } else if (changeType === DiffSummaryChangeType.open) {
      if (showUpdateMessage) {
        setShowUpdateMessage(false);
      }
    }
  });

  const hasBreaking = totalBreaking > 0;

  const onShowBreakingOnly = useCallback(() => {
    if (!hasBreaking) return;
    setChecked(!checked);
  }, [checked, hasBreaking]);

  const onViewFullChangelog = useCallback(() => {
    if (!diffSummary) return;
    const message = diffSummary.result?.json?.message;
    if (!message) return;
    viewChangelog(oldSpec, newSpec, diffSummary.result?.json?.message);
  }, [diffSummary, oldSpec, newSpec]);

  // @ts-ignore
  if (!globalInitialized) {
    return <div className="center diff-summary_empty">No Changelog</div>;
  }

  return (
    <div className="diff-summary">
      <div
        className="diff-summary_message"
        style={{ display: showUpdateMessage ? '' : 'none', marginTop: -10 }}
      >
        <div className="diff-summary_message_content">
          The Diff Summary has been updated according to your change.
        </div>
        <div className="diff-summary_message_btn">
          <Button
            type="primary"
            size="small"
            onClick={() => setShowUpdateMessage(false)}
          >
            OK
          </Button>
        </div>
      </div>
      <div className="diff-summary_header">
        <div className="diff-summary_header_title">
          <h4>
            Breaking changes:
            {totalBreaking}
          </h4>
          {totalBreaking > 0 && (
            <div className="breakings">
              (
              {_diffSummary
                .filter((_) => _[1].length > 0 && _[2] > 0)
                .map((item) => (
                  <a href={`#${item[0]}`}>
                    <span>
                      {item[2]}
                      {' '}
                      {item[0]}
                    </span>
                  </a>
                ))}
              )
            </div>
          )}
        </div>
        <ul className="diff-summary_header_actions">
          <li
            onClick={onShowBreakingOnly}
            className={!hasBreaking ? 'disable' : ''}
          >
            <Switch
              checked={checked}
              size="small"
              style={{ width: 28 }}
              disabled={!hasBreaking}
            />
            Show Breaking Only
          </li>

          <li
            onClick={onViewFullChangelog}
            className={diffSummary?.result?.json?.message ? '' : 'disable'}
          >
            <span className="codicon codicon-eye" />
            View Full Changelog
          </li>
        </ul>
      </div>
      <div className="diff-summary_content">
        <Card title="">
          <Card.Grid hoverable={false} style={gridStyle}>
            <Skeleton loading={!oldSpec && loading} active avatar={{ shape: 'circle' }} paragraph={false} />
            {oldSpec && (
              <Score
                score={oldSpec.score}
                title={
                  'title' in oldSpec
                    ? oldSpec.title
                    : getSpecFileName(
                      oldSpec.service_name,
                      oldSpec.version,
                      oldSpec.revision,
                    )
                }
                update={`Updated at ${dayjs(oldSpec.updated_at).format(
                  TIME_FORMATE,
                )}`}
              />
            )}
          </Card.Grid>
          <Card.Grid hoverable={false} style={gridStyle}>
            <Skeleton loading={!newSpec && loading} active avatar={{ shape: 'circle' }} paragraph={false} />
            {newSpec && (
              <Score
                score={newSpec.score}
                title={
                  'title' in newSpec
                    ? newSpec.title
                    : getSpecFileName(
                      newSpec.service_name,
                      newSpec.version,
                      newSpec.revision,
                    )
                }
                update={`Updated at ${dayjs(newSpec.updated_at).format(
                  TIME_FORMATE,
                )}`}
              />
            )}
          </Card.Grid>
          <Card.Grid className="findings" hoverable={false} style={gridStyle}>
            <Skeleton loading={!oldSpecAnalyseSummary && loading} active paragraph={false} />
            {oldSpecAnalyseSummary && (
              <Summary data={oldSpecAnalyseSummary} showTitle={false} />
            )}
          </Card.Grid>
          <Card.Grid className="findings" hoverable={false} style={gridStyle}>
            <Skeleton loading={!newSpecAnalyseSummary && loading} active paragraph={false} />
            {newSpecAnalyseSummary && (
              <Summary data={newSpecAnalyseSummary} showTitle={false} />
            )}
          </Card.Grid>
        </Card>
      </div>
      {diffSummary && _diffSummary.length === 0 && (
        <div className="center diff-summary_empty">No Changelog</div>
      )}
      <ChangesSkeleton loading={!diffSummary && loading}>
        {diffSummary && (
        <ul className="diff-summary_list">
          {_diffSummary.map((item) => (
            <li>
              <Changes
                title={item[0]}
                data={item[1]}
                loading={false}
                diffSpecs={diffSpecs}
              />
            </li>
          ))}
        </ul>
        )}
      </ChangesSkeleton>
    </div>
  );
}

ReactDOM.render(<BaseComponent />, document.getElementById('app'));
