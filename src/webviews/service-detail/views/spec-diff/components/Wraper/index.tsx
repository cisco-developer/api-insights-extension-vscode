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

// import { VSCodeButton, VSCodeDivider } from '@vscode/webview-ui-toolkit/react';
import { LeftOutlined } from '@ant-design/icons';
import { Button, Divider } from 'antd';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './index.scss';
import DiffViewer from '../DiffViewer';
import { openFile } from '../../../../../Service';
import { APIServiceSpec } from '../../../../../../types';
import { DiffFilterTypes } from '../../../revision-detail/components/Drift';

type Props = {
  data: {
    id: number;
    method?: string;
    path?: string;
    type: string;
    specDiffType?: string;
    diff: {
      new: string;
      old: string;
    };
    spec: APIServiceSpec;
  };
  detailNavigationState: any;
};

export default function SpecDiffWraper(props: Props) {
  const { data, detailNavigationState } = props;
  const {
    method, path, type, diff, spec,
  } = data;

  const navigation = useNavigate();
  const onBack = useCallback(() => {
    navigation('/service/compliance', { state: detailNavigationState });
  }, [navigation, detailNavigationState]);

  return (
    <div className="spec-diff">
      <header className="spec-diff_header_wapper">
        <div className="spec-diff_header_left">
          <h1>
            <span onClick={onBack}>
              <LeftOutlined />
            </span>
            {`${type}`}
            {' '}
            Diff Viewer
          </h1>
        </div>
        <div className="spec-diff_header_right">
          {data.specDiffType === DiffFilterTypes.SHADOW_DIFF ? (
            // VSCodeButton
            <Button
              onClick={() => {
                openFile(spec);
              }}
            >
              <span className="codicon codicon-code" />
              {' '}
              Open Spec
            </Button>
          ) : null}

          {data.specDiffType !== DiffFilterTypes.SHADOW_DIFF ? (
            // VSCodeButton
            <Button
              onClick={() => {
                openFile(spec, data.path);
              }}
            >
              <span className="codicon codicon-file-symlink-file" />
              Go to Definition
            </Button>
          ) : null}
        </div>
      </header>
      {/* VSCodeDivider */}
      <Divider />
      <div className="spec-diff_summary_wapper">
        <h2 className="spec-diff_summary_title">Summary</h2>
        <ul className="spec-diff_summary_list">
          <li>
            <h3>Method</h3>
            <p>{method}</p>
          </li>
          <li>
            <h3>Path</h3>
            <p>{path}</p>
          </li>
        </ul>
      </div>
      <div className="spec-diff_content_wapper">
        <h2 className="spec-diff_title">Diff</h2>
        <DiffViewer
          spec={spec}
          oldSpec={diff.old}
          newSpec={diff.new}
        />
      </div>
    </div>
  );
}
