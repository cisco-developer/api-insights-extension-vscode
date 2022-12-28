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

import ReactDOM from 'react-dom';

// import 'antd/dist/antd.dark.min.css';
import 'react-circular-progressbar/dist/styles.css';
import './index.scss';
import { Card } from 'antd';
import { VSCodeButton, VSCodeLink } from '@vscode/webview-ui-toolkit/react';
import { useState } from 'react';
import { CircularProgressbarWithChildren } from 'react-circular-progressbar';
import { postVSCodeCommandExecuteMsgToExtension } from '../toExtensionMessageSender';
import { CONFIGURE_EXPLORER_COMMAND } from '../../commands';
import useAntdThemeCss from '../hooks/useAntdThemeCss';

const unlockedFeatures: { title: string, description: string }[] = [
  {
    title: 'Dark / Light mode friendly ',
    description: 'Evaluate API specifications early and often in your favorite development environment',
  },
  {
    title: 'Validates and scores API specs',
    description: 'API Insights validates and scores API specifications against an organization’s guidelines. This allows you to track and improve API quality consistently and efficiently.',
  },
  {
    title: 'Built for your CI/CD pipeline',
    description: 'Developers can use API Insights through its own interface or as part of their CI/CD pipeline.',
  },
  {
    title: 'API lifecycle management',
    description: 'API Insights provides a trend timeline of API quality, and generates both API changelogs and diff comparisons of API versions to identify breaking changes.',
  },
];
function WelcomePage() {
  const [activeUnlockFeatureIdx, setActiveUnlockFfeatureIdx] = useState(0);
  useAntdThemeCss();
  const onConfigItNowClicked = () => {
    postVSCodeCommandExecuteMsgToExtension(webviewVsc, 'executeCommand', [CONFIGURE_EXPLORER_COMMAND], 'commands');
  };

  return (
    <div className="welcome-page">
      <div className="header">
        <h1>Welcome to API Insights</h1>
        <div className="_desc">
          API Insights improves API quality and security with configurable guidelines,
          letting you shift security left with an open-source project from Cisco.
        </div>
      </div>

      <div className="basic-features">
        <Card bordered={false} title="Basic Features">
          <div className="_tips">
            <div className="__icon">
              <i className="codicon codicon-pass-filled" />
            </div>
            <div className="__main">
              <div className="___title">
                Analyze a local specification file
              </div>
              <div className="___desc">
                Use your developer workflow to edit a local spec file after linting with rules.
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="unlock-more-features">
        <Card
          bordered={false}
          title={(
            <div className="title-container">
              <div className="__title">Unlock More Features</div>
              <div className="__desc">
                If you have an&nbsp;
                <VSCodeLink href="https://developer.cisco.com/site/api-insights/#get-started">
                  API Insights service
                  <i className="codicon codicon-link-external" />
                </VSCodeLink>
                {' '}
                running, you can configure the extension to unlock all the features listed here.
              </div>
            </div>
          )}
          extra={<VSCodeButton onClick={onConfigItNowClicked}>Configure It Now</VSCodeButton>}
        >

          <div className="features-main">
            <div className="features-list">
              {
                unlockedFeatures.map((feature, idx) => (
                  <div key={`feature${feature.title}`} className={`feature-list-item${idx === activeUnlockFeatureIdx ? ' active' : ''}`} onClick={() => setActiveUnlockFfeatureIdx(idx)}>
                    <div className="-icon">
                      <CircularProgressbarWithChildren value={100} strokeWidth={4}>
                        <i className="codicon codicon-check" />
                      </CircularProgressbarWithChildren>
                    </div>
                    <div className="-detail">
                      <div className="-title">
                        {feature.title}
                      </div>
                      <div className="-desc">
                        {feature.description}
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
            <div className={`feature-preview active-${activeUnlockFeatureIdx}`} />
          </div>
        </Card>
      </div>
    </div>
  );
}

ReactDOM.render(<WelcomePage />, document.getElementById('app'));
