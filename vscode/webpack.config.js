"use strict";
const path = require("path");
const nodeExternals = require("webpack-node-externals");
const CleanWebpackPlugin = require("clean-webpack-plugin");
const FileManagerWebpackPlugin = require("filemanager-webpack-plugin");

module.exports = function(env, argv) {
	env = env || {};
	const production = !!env.production;

	let onStartCopy = [];
	const watch = !!(argv.watch || argv.w);
	if (!watch) {
		onStartCopy.push(
			// Copy in the type declarations from the agent, because referencing them directly is a nightmare
			{
				// TODO: Use environment variable if exists
				source: path.resolve(__dirname, "../codestream-lsp-agent/types/*.d.ts"),
				destination: "types/"
			}
		);
	}

	const plugins = [
		new CleanWebpackPlugin(["dist"]),
		new FileManagerWebpackPlugin({
			onStart: [{ copy: onStartCopy }],
			onEnd: [
				{
					copy: [
						{
							// TODO: Use environment variable if exists
							source: path.resolve(__dirname, "../codestream-lsp-agent/dist/*"),
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
			extensions: [".tsx", ".ts", ".js"],
			alias: {
				codestream$: path.resolve(__dirname, "types/api.d.ts"),
				"codestream-agent$": path.resolve(__dirname, "types/agent.d.ts")
			}
		},
		externals: [nodeExternals()],
		module: {
			rules: [
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
		plugins: plugins
	};
};
