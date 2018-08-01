"use strict";
const path = require("path");
const nodeExternals = require("webpack-node-externals");
const CleanWebpackPlugin = require("clean-webpack-plugin");
const FileManagerWebpackPlugin = require("filemanager-webpack-plugin");

module.exports = function(env, argv) {
	env = env || {};
	const production = !!env.production;

	const plugins = [
		new CleanWebpackPlugin(["dist"]),
		new FileManagerWebpackPlugin({
			onEnd: [
				{
					copy: [
						{
							source: path.resolve(__dirname, "../codestream-lsp-agent/dist/*"),
							// TODO: Use environment variable if exists
							destination: "dist/"
						}
					]
				}
			]
		})
	];

	return {
		entry: "./src/extension.ts",
		mode: production ? "production" : "development",
		target: "node",
		devtool: !production ? "eval-source-map" : undefined,
		output: {
			libraryTarget: "commonjs2",
			filename: "extension.js"
		},
		resolve: {
			extensions: [".tsx", ".ts", ".js"]
		},
		externals: [nodeExternals()],
		module: {
			rules: [
				{
					test: /\.tsx?$/,
					use: "ts-loader",
					exclude: /node_modules/
				}
			]
		},
		plugins: plugins
	};
};
