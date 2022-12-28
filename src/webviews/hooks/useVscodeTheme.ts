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

import { useEffect, useState } from 'react';

export enum ThemeTypes {
  'light' = 'vscode-light',
  'dark' = 'vscode-dark'
}

const THEME_ATTR = 'data-vscode-theme-kind';
export default function useVscodeTheme() {
  const [theme, setTheme] = useState('');
  useEffect(() => {
    function getTheme(dom: HTMLElement) {
      return dom.getAttribute(THEME_ATTR);
    }
    const { body } = document;
    const config = { attributes: true };
    setTheme(getTheme(body));
    const cb = (list: MutationRecord[]) => {
      for (let index = 0; index < list.length; index += 1) {
        const item = list[index];
        if (item.type === 'attributes') {
          if (item.attributeName === THEME_ATTR) {
            setTheme(getTheme(item.target as HTMLElement));
            break;
          }
        }
      }
    };
    const observer = new MutationObserver(cb);
    observer.observe(body, config);
    return () => {
      observer.disconnect();
    };
  }, []);

  return {
    isLightTheme: theme === ThemeTypes.light,
    isDarkTheme: theme === ThemeTypes.dark,
  };
}
