"use strict";
const webpack = require("webpack");
const path = require("path");
const CleanWebpackPlugin = require("clean-webpack-plugin");
const FileManagerWebpackPlugin = require("filemanager-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = function(env, argv) {
	env = env || {};
	env.production = Boolean(env.production);

	const onEnd = [
		{
			copy: [
				{
					source: "dist/agent.*",
					// TODO: Use environment variable if exists
					destination: path.resolve(__dirname, "../vscode-codestream/dist/")
				},
				{
					source: "dist/agent.*",
					// TODO: Use environment variable if exists
					destination: path.resolve(__dirname, "../atom-codestream/dist/")
				},
				{
					source: "dist/agent-vs.js",
					// TODO: Use environment variable if exists
					destination: path.resolve(
						__dirname,
						"../vs-codestream/src/CodeStream.VisualStudio/LSP/agent.js"
					)
				},
				{
					source: "dist/agent-vs.js.map",
					// TODO: Use environment variable if exists
					destination: path.resolve(
						__dirname,
						"../vs-codestream/src/CodeStream.VisualStudio/LSP/agent-vs.js.map"
					)
				}
			]
		}
	];

	const plugins = [
		new CleanWebpackPlugin(["dist"], { verbose: false }),
		new FileManagerWebpackPlugin({ onEnd: onEnd }),
		// Added because of https://github.com/felixge/node-formidable/issues/337
		new webpack.DefinePlugin({ "global.GENTLY": false }),
		// Ignores optional worker_threads require by the write-file-atomic package
		new webpack.IgnorePlugin(/^worker_threads$/)
	];

	return {
		entry: {
			agent: "./src/main.ts",
			"agent-vs": "./src/main-vs.ts"
		},
		mode: env.production ? "production" : "development",
		target: "node",
		node: {
			__dirname: false
		},
		devtool: "source-map",
		output: {
			filename: "[name].js"
		},
		optimization: {
			minimizer: [
				new TerserPlugin({
					cache: true,
					parallel: true,
					sourceMap: true,
					terserOptions: {
						ecma: 8,
						// Keep the class names otherwise @log won't provide a useful name
						keep_classnames: true,
						module: true
					}
				})
			]
		},
		externals: {
			bufferutil: "bufferutil",
			encoding: "encoding",
			"utf-8-validate": "utf-8-validate"
		},
		module: {
			rules: [
				{
					test: /\.ts$/,
					enforce: "pre",
					use: "tslint-loader",
					exclude: /node_modules/
				},
				{
					test: /\.tsx?$/,
					use: "ts-loader",
					exclude: /node_modules|\.d\.ts$/
				}
			],
			// Removes `Critical dependency: the request of a dependency is an expression` from `./node_modules/vscode-languageserver/lib/files.js`
			exprContextRegExp: /^$/,
			exprContextCritical: false
		},
		resolve: {
			extensions: [".ts", ".tsx", ".js", ".jsx"]
		},
		plugins: plugins,
		stats: {
			all: false,
			assets: true,
			builtAt: true,
			env: true,
			errors: true,
			timings: true,
			warnings: true
		}
	};
};
