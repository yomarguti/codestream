"use strict";
const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = function(env, argv) {
	if (env === undefined) {
		env = {};
	}

	const production = !!env.production;

	const plugins = [];

	if (!production) {
		plugins.push(
			new CopyWebpackPlugin([
				{ from: "./out/*", to: "../../vscode-codestream/out/", flatten: true }
			])
		);
	}

	return {
		entry: "./src/agent.ts",
		mode: production ? "production" : "development",
		target: "node",
		devtool: !production ? "eval-source-map" : undefined,
		output: {
			libraryTarget: "commonjs2",
			filename: "agent.js",
			path: path.resolve(__dirname, "out")
		},
		resolve: {
			extensions: [".tsx", ".ts", ".js"]
		},
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
