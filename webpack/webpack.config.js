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

const path = require('path');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const { ESBuildMinifyPlugin } = require('esbuild-loader')

const srcRoot = path.resolve(__dirname, '..', 'src', 'webviews');
module.exports = (env, argv) => {
  let { mode, devtool } = argv;
  const isProd = mode === 'production';
  devtool = isProd ? 'nosources-source-map' : 'inline-source-map';
  return {
    entry: {
      'service-detail': path.resolve(srcRoot, 'service-detail', 'index.tsx'),
      'service-list': path.resolve(srcRoot, 'service-list', 'index.tsx'),
      'diff-summary': path.resolve(srcRoot, 'diff-summary', 'index.tsx'),
      welcome: path.resolve(srcRoot, 'welcome', 'index.tsx'),
      'antd-css':path.resolve(srcRoot, 'antd-css.ts')
    },
    // entry: {
    //   shared: ['react', 'react-dom'],
    //   'service-detail': {
    //     import:path.resolve(srcRoot, 'service-detail', 'index.tsx'),
    //     dependOn: 'shared'
    //   },
    //   'service-list': {
    //     import:path.resolve(srcRoot, 'service-list', 'index.tsx'),
    //     dependOn: 'shared'
    //   },
    //   'diff-summary': {
    //     import:path.resolve(srcRoot, 'diff-summary', 'index.tsx'),
    //     dependOn: 'shared'
    //   },
    //   'welcome': {
    //     import:path.resolve(srcRoot, 'welcome', 'index.tsx'),
    //     dependOn: 'shared'
    //   }
    // },
    mode,
    devtool,
    output: {
      path: path.resolve(__dirname, '..', 'dist'),
      filename: '[name].bundle.js',
      chunkFilename: '[name].bundle.js',
    },
    resolve: {
      modules: [path.resolve(srcRoot, 'node_modules')],
      extensions: ['.ts', '.tsx', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.(jsx|js)$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'babel-loader',
              options: {
                presets: [
                  [
                    '@babel/preset-env',
                    {
                      // "targets": "defaults"
                      targets: { node: 'current' },
                      modules:false
                    },
                  ],
                  [
                    '@babel/preset-react',
                    {
                      runtime: 'automatic',
                    },
                  ],
                ],
                // plugins: [
                //   ["import", { "libraryName": "antd", "libraryDirectory": "es",style:"css"}],
                //   ["import", {
                //     "libraryName": "@ant-design/plots",
                //     "libraryDirectory": "es"
                //   }],
                // ]
              },
            },
          ],
        },
        {
          test: /\.(scss|css)$/,
          use: [
            MiniCssExtractPlugin.loader,
            { loader: "css-loader"},
            { loader: "sass-loader"},
          ],
          sideEffects:true
        },
        {
          test: /\.(eot|ttf|woff|woff2)$/i,
          // More information here https://webpack.js.org/guides/asset-modules/
          type: 'asset/resource',
        },
        {
          test: /\.(png|jpg|gif|svg)$/i,
          use: [
            {
              loader: 'url-loader',
              options: {
                limit: 8192,
              },
            },
          ],
        },
        // {
        //   test: /\.tsx?$/,
        //   include: path.resolve(__dirname, '..'),
        //   use: ['ts-loader'],
        // },
        {
          test: /\.tsx?$/,
          loader: 'esbuild-loader',
          options: {
            loader: 'tsx',  // Or 'ts' if you don't need tsx
            target: 'es2015'
          }
        },
      ],
    },
    plugins:[
      new MiniCssExtractPlugin({
        // runtime: false,
      }),
      new BundleAnalyzerPlugin()
    ],
    optimization: {
      //chunkIds:"named",
      // splitChunks: {
      //   cacheGroups: {
      //     'react-dom': {
      //       test: /[\\/]node_modules[\\/]react-dom[\\/]/,
      //       name: 'react-dom',
      //       chunks: 'all',
      //     },
      //     react: {
      //       test: /[\\/]node_modules[\\/]react[\\/]/,
      //       name: 'react',
      //       chunks: 'all',
      //     }
      //   },
      // },
    },
    optimization: {
      chunkIds:"named",
      // minimize: true,
      minimizer:[
        new ESBuildMinifyPlugin({
            css: true,
            target: 'es2015'
        }),
        // new CssMinimizerPlugin({
        //   minify: CssMinimizerPlugin.cssoMinify,
        // }),
        // new TerserPlugin({
        //   terserOptions: {
        //     compress: true,
        //   },
        // }),
      ],
      splitChunks: {
        cacheGroups: {
          'antd-light-css': {
            test: /antd.light/,
            name: 'antd.light',
            chunks: 'initial',
          },
          'antd-dark-css': {
            test: /antd.dark/,
            name: 'antd.dark',
            chunks: 'initial',
          }
        },
      },
    },
  };
};
