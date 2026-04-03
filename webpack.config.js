//@ts-check
'use strict';

const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

/** @type {import('webpack').Configuration} */
const extensionConfig = {
  target: 'node',
  mode: 'none',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
  },
  externals: {
    vscode: 'commonjs vscode',
    fsevents: 'commonjs fsevents',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules|src\/ui\/webview/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.json',
            },
          },
        ],
      },
    ],
  },
  devtool: 'nosources-source-map',
};

/** @type {import('webpack').Configuration} */
const webviewConfig = {
  target: 'web',
  mode: 'none',
  entry: './src/ui/webview/main.ts',
  output: {
    path: path.resolve(__dirname, 'dist', 'webview'),
    filename: 'main.js',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: path.resolve(__dirname, 'tsconfig.webview.json'),
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: 'src/ui/webview/styles.css',
          to: path.resolve(__dirname, 'dist', 'webview'),
        },
        {
          from: 'assets/sprites/*_sheet.png',
          to: path.resolve(__dirname, 'dist', 'sprites', '[name][ext]'),
        },
        {
          from: 'assets/sprites/*_actions.png',
          to: path.resolve(__dirname, 'dist', 'sprites', '[name][ext]'),
        },
        {
          from: 'assets/sprites/bg_*.png',
          to: path.resolve(__dirname, 'dist', 'sprites', '[name][ext]'),
        },
      ],
    }),
  ],
  devtool: 'nosources-source-map',
};

module.exports = [extensionConfig, webviewConfig];
