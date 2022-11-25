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

const webpack = require("webpack");
const path = require("path");

const root = path.resolve(__dirname, "..");

module.exports = function (env, argv) {
  let {
    mode,
    devtool,
  } = argv;
  const isProd = mode === "production";
  mode = mode || "none";
  devtool = "nosources-source-map";

  /** @type {import('webpack').Configuration} */
  const config = {
    target: "webworker", // extensions run in a webworker context
    mode, // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
    entry: {
      extension: path.resolve(root, "src", "extension", "./index.ts"), // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
    },
    output: {
      // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
      path: path.resolve(root, "dist", "web"),
      filename: "[name].js",
      libraryTarget: "commonjs",
    },
    devtool,
    performance: {
      hints: false,
    },
    externals: {
      vscode: "commonjs vscode", // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
      // fs: "commonjs fs",
      // path: "commonjs path",
    },
    resolve: {
      // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
      extensions: [".ts", ".js"],
      // mainFields: ['exports', 'browser', 'module', 'main'], // look for `browser` entry point in imported node modules
      mainFields: ["browser", "module", "main"], // look for `browser` entry point in imported node modules
      alias: {
        // provides alternate implementation for node module and source files
        fs: path.resolve(__dirname,'fs-web.mock'),
        os:"os-browserify"
      },
      fallback: {
        // Webpack 5 no longer polyfills Node.js core modules automatically.
        // see https://webpack.js.org/configuration/resolve/#resolvefallback
        // for the list of Node.js core module polyfills.
        assert: require.resolve("assert"),
        path: require.resolve("path-browserify"),
        os: require.resolve("os-browserify"),
        buffer: require.resolve("buffer/"),
        'process/browser': require.resolve('process/browser')
      },
    },
    plugins: [
      new webpack.ProvidePlugin({
        process: "process/browser", // provide a shim for the global `process` variable
      }),
      new webpack.DefinePlugin({
        EXT_TYPE:"'web'"
      })
    ],
    module: {
      rules: [{
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [{
          loader: "ts-loader",
        }]
      }],
    },
  };

  return config;
};