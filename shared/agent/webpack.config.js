"use strict";
const webpack = require("webpack");
const path = require("path");
const CleanWebpackPlugin = require("clean-webpack-plugin");
const FileManagerWebpackPlugin = require("filemanager-webpack-plugin");

module.exports = function(env, argv) {
	env = env || {};
	const production = !!env.production;

	const plugins = [
		new CleanWebpackPlugin(["dist"], { verbose: false }),
		// Added because of https://github.com/felixge/node-formidable/issues/337
		new webpack.DefinePlugin({ "global.GENTLY": false }),
		new FileManagerWebpackPlugin({
			onEnd: [
				{
					copy: [
						{
							source: "src/shared/*",
							// TODO: Use environment variable if exists
							destination: path.resolve(__dirname, "../vscode-codestream/src/shared/")
						},
						{
							source: "dist/*",
							// TODO: Use environment variable if exists
							destination: path.resolve(__dirname, "../vscode-codestream/dist/")
						}
					]
				}
			]
		})
	];

	return {
		entry: {
			agent: "./src/agent.ts"
		},
		mode: production ? "production" : "development",
		target: "node",
		devtool: !production ? "eval-source-map" : undefined,
		output: {
			filename: "[name].js",
			devtoolModuleFilenameTemplate: "file:///[absolute-resource-path]"
		},
		resolve: {
			extensions: [".tsx", ".ts", ".js"],
			alias: {
				// Required because of https://github.com/bitinn/node-fetch/issues/493#issuecomment-414111024
				"node-fetch$": "node-fetch/lib/index.js"
			}
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
				},
				{
					test: /\.d\.ts$/,
					loader: "ignore-loader"
				}
			]
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
