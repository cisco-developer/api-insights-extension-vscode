import { useEffect } from 'react';
import useVscodeTheme from './useVscodeTheme';

export default function useAntdThemeCss() {
  const { isLightTheme } = useVscodeTheme();
  useEffect(() => {
    function insertStyle(url:string) {
      const existEle = document.getElementById(url);
      if (existEle && existEle.nodeName === 'LINK') return;
      const link = document.createElement('link');
      link.id = url;
      link.href = url;
      link.rel = 'stylesheet';
      document.head.insertBefore(link, document.head.firstElementChild);
    }

    if (isLightTheme) {
      // @ts-ignore
      if (styleAntdLightUri) {
        // @ts-ignore
        insertStyle(styleAntdLightUri);
      }
    } else {
      // @ts-ignore
      // eslint-disable-next-line no-lonely-if
      if (styleAntdDarkUri) {
        // @ts-ignore
        insertStyle(styleAntdDarkUri);
      }
    }
  }, [isLightTheme]);
}
