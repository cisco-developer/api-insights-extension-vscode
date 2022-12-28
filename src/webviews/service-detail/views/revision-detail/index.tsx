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
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { Tabs } from 'antd';
import { useLocation } from 'react-router-dom';
import Compliance from './components/Compliance';
import Drift from './components/Drift';
import './index.scss';
import { ServiceDetailProps, TabTypes, APIServiceSpec } from './types';
import {
  getSpecsAnalyses,
  openInEditorWithProblems,
  openFile,
} from '../../../Service';
// import 'react-circular-progressbar/dist/styles.css';
import ServiceHeader, {
  ServiceHeaderProps,
} from '../../components/ServiceHeader';
import { DEFAULT_POSITION } from '../../../../const';

export type { ServiceDetailProps, TabTypes };

const { TabPane } = Tabs;

export default function ServiceDetail(props: ServiceDetailProps) {
  const { apiService } = props;
  const { id } = apiService;

  const [activeTab, setActiveTab] = useState<TabTypes>(
    props.activeTab || 'compliance',
  );
  const [specsAnalyses, setSpecsAnalyses] = useState(null);
  const [specsAnalysesLoading, setSpecsAnalysesLoading] = useState(true);
  const location = useLocation();
  const { revisions, revision } = location.state as ServiceHeaderProps;

  const driftData = useMemo(() => {
    if (!specsAnalyses) return null;
    return {
      ...specsAnalyses.drift,
      service: apiService,
      spec: revision,
      compliance: specsAnalyses.list,
    };
  }, [specsAnalyses, apiService, revision]);

  const complianceData = useMemo(() => {
    if (!specsAnalyses) return null;
    return {
      ...specsAnalyses,
      service: apiService,
      spec: revision,
    };
  }, [specsAnalyses, apiService, revision]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [revision.id]);

  useEffect(() => {
    if (!id) return;
    setSpecsAnalysesLoading(true);
    getSpecsAnalyses(revision.id, `${id}`)
      .then((data) => {
        setSpecsAnalyses(data.data);
      })
      .finally(() => {
        setSpecsAnalysesLoading(false);
      });
  }, [id, revision.id]);

  const onTabChange = useCallback((key: string) => {
    setActiveTab(key as 'overall' | 'spec' | 'compliance');
  }, []);

  const onOpenInEditor = useCallback(
    async (spec: APIServiceSpec | string) => {
      if (typeof spec === 'string') {
        openFile(spec);
      } else if (specsAnalyses) {
        const { list } = specsAnalyses;
        openInEditorWithProblems(
          { ...revision, service_name: apiService.name_id },
          DEFAULT_POSITION,
          list,
          revision.score,
        );
      } else {
        openFile(
          { ...revision, service_name: apiService.name_id },
          DEFAULT_POSITION,
        );
      }
    },
    [apiService, revision, specsAnalyses],
  );

  return (
    <div className="service-detail_container flex flex-col">
      <ServiceHeader
        service={apiService}
        revision={revision}
        revisions={revisions}
        openInEditor={onOpenInEditor}
        isRevisionMode
      />
      <Tabs activeKey={activeTab} onChange={onTabChange}>
        <TabPane tab="Compliance" key="compliance">
          <Compliance
            loading={specsAnalysesLoading}
            data={complianceData}
            hostId={Number(id)}
          />
        </TabPane>
        <TabPane tab="Drift" key="overall">
          <Drift
            loading={specsAnalysesLoading}
            data={driftData}
            hostId={Number(id)}
          />
        </TabPane>
      </Tabs>
    </div>
  );
}
