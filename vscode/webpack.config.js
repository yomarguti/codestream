"use strict";
const path = require("path");
const nodeExternals = require("webpack-node-externals");
const CleanWebpackPlugin = require("clean-webpack-plugin");

module.exports = function(env, argv) {
	env = env || {};

	const production = !!env.production;
	console.log("Production:", production);

	const plugins = [new CleanWebpackPlugin(["dist"])];

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
