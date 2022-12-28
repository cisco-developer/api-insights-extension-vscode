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
  useCallback, useState, useEffect, useMemo,
} from 'react';
import { Table, TableProps } from 'antd';
import useGenColumns from './hooks/useGenColumns';
import useChangeFilterNum from '../../hooks/useChangeFilterNum';
import Summary from '../../../../../components/Summary';
import { ListParams, ListProps, Analyses } from './types';
import './index.scss';

import { openInEditorWithProblems } from '../../../../../Service';

import Loader from '../../../../components/Loader';

export type { ListParams, ListProps };

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 15;

export default function List(props: ListProps) {
  const { hostId, data, loading } = props;
  const [params, setParams] = useState<ListParams>({});
  const { spec, list, service } = data || {};
  const onAffectedItemsClick = useCallback(
    (analyses: Analyses) => {
      const { data } = analyses;
      const { range } = data[0];
      openInEditorWithProblems(
        { ...spec, service_name: service.name_id },
        {
          line: Math.max((range?.start?.line || 0) - 1, 0),
          character: Math.max((range?.start?.column || 0) - 1, 0),
        },
        list,
        spec?.score,
      );
    },
    [spec, service, list],
  );

  const analyzerFilters = useMemo(() => {
    if (!list) return [];
    const filtersMap = {};
    list.forEach((item) => {
      filtersMap[item.analyzer] = true;
    });
    return Object.keys(filtersMap).map((key) => ({ text: key, value: key }));
  }, [list]);

  const columns = useGenColumns({
    analyzer: {
      filteredValue: params.analyzer?.split(','),
    },
    action: { onAffectedItemsClick },
    analyzerFilters,
  });

  useChangeFilterNum(
    params.analyzer,
    '.analyzer-type_column .ant-table-filter-column',
  );

  useEffect(() => {
    setParams((params) => ({ ...params, hostId, page: DEFAULT_PAGE }));
  }, [hostId]);

  const handleListChange: TableProps<any>['onChange'] = useCallback(
    (pagination, filters) => {
      const analyzer = filters.analyzer
        ? filters.analyzer.join(',')
        : undefined;
      setParams((params) => ({
        ...params,
        page: pagination.current,
        pageSize: pagination.pageSize,
        analyzer,
      }));
    },
    [],
  );

  if (!data && loading) return <Loader />;
  return (
    <div className="compliance_container">
      {data && <Summary data={data.summary} />}
      <Table
        loading={loading}
        pagination={{
          showSizeChanger: false,
          current: params.page,
          pageSize: DEFAULT_PAGE_SIZE,
        }}
        onChange={handleListChange}
        size="middle"
        bordered
        columns={columns}
        dataSource={list}
      />
    </div>
  );
}
