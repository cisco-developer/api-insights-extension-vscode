module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' }, modules: false }],
    '@babel/preset-typescript',
    [
      '@babel/preset-react',
      {
        runtime: 'automatic',
      },
    ],
  ],
  // plugins: [
  //   ['import', { libraryName: 'antd', libraryDirectory: 'es', style: 'css' }],
  //   ['import', {
  //     libraryName: '@ant-design/plots',
  //     libraryDirectory: 'es',
  //   }],
  // ],
};
