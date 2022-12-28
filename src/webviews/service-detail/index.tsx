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

import { useEffect, createContext, lazy, Suspense } from 'react';
import ReactDOM from 'react-dom';
import { RecoilRoot } from 'recoil';
import {
  MemoryRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';
// import RevisionDetail from './views/revision-detail';
// import SpecDiff from './views/spec-diff';
import Loader from './components/Loader';
// import 'antd/dist/antd.dark.min.css';
import 'react-circular-progressbar/dist/styles.css';
import './index.scss';
import {
  useCurrentAPIService,
  useUploadHistoryUpdateMsg,
} from '../msgListenerHooks';
import { API_SERVICE_MST_TYPES } from '../../common';
import { UploadCache } from '../../types';
import useAntdThemeCss from '../hooks/useAntdThemeCss';
// import ServiceDashboard from './views/service-dashboard';

const ServiceDashboard = lazy(() => import(/* webpackChunkName: "serviceDashboard" */'./views/service-dashboard'));
const RevisionDetail = lazy(() => import(/* webpackChunkName: "revisionDetail" */'./views/revision-detail'));
const SpecDiff = lazy(() => import(/* webpackChunkName: "specDiff" */'./views/spec-diff'));

export const uploadHistoryContext = createContext<UploadCache>({});

function App() {
  const [apiService] = useCurrentAPIService<any>();
  const [uploadHistory] = useUploadHistoryUpdateMsg({});

  const navigate = useNavigate();

  const defaultPath = '/dashboard/overall';
  const location = useLocation();
  useAntdThemeCss();
  useEffect(() => {
    if (location.pathname !== defaultPath) { navigate(defaultPath); }
    window.scrollTo(0, 0);
  }, [apiService]);

  useEffect(() => {
    // @ts-ignore
    webviewVsc.postMessage({ type: API_SERVICE_MST_TYPES.APP_IS_READY });
  }, []);

  if (!apiService) {
    return <Loader />;
  }

  return (
    <uploadHistoryContext.Provider value={uploadHistory}>
      <Routes>
        <Route
          path={defaultPath}
          element={(
            <ServiceDashboard
              activeTab="overall"
              apiService={apiService}
            />
          )}
        />
        <Route
          path="/service/compliance"
          element={(
            <RevisionDetail
              apiService={apiService}
              activeTab="compliance"
            />
          )}
        />
        <Route path="/specDiff" element={<SpecDiff />} />
        <Route path="*" element={<Navigate to={defaultPath} replace />} />
      </Routes>
    </uploadHistoryContext.Provider>
  );
}

ReactDOM.render(
  <RecoilRoot>
    <MemoryRouter>
      <Suspense fallback={<Loader />}>
        <App />
      </Suspense>
    </MemoryRouter>
  </RecoilRoot>,
  document.getElementById('app'),
);
