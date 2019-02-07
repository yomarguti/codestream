"use strict";
const path = require("path");
const nodeExternals = require("webpack-node-externals");
// const BabelExternalHelpersPlugin = require("webpack-babel-external-helpers-2");
const CleanPlugin = require("clean-webpack-plugin");
const FileManagerPlugin = require("filemanager-webpack-plugin");
// const HtmlPlugin = require("html-webpack-plugin");
// const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = function(env, argv) {
	env = env || {};
	env.production = !!env.production;
	env.watch = !!(argv.watch || argv.w);

	return [getExtensionConfig(env)];
};

function getExtensionConfig(env) {
	let clean = ["dist"];

	const plugins = [
		new CleanPlugin(clean, { verbose: false }),
		new FileManagerPlugin({
			onEnd: [
				{
					copy: [
						{
							source: path.resolve(__dirname, "codestream-*.info"), // TODO?
							destination: "dist/",
						},
						{
							// TODO: Use environment variable if exists
							source: path.resolve(__dirname, "../codestream-lsp-agent/dist/agent.*"),
							destination: "dist/",
						},
						{
							source: path.resolve(
								__dirname,
								"../codestream-components/styles/{login,stream}.less"
							),
							destination: "dist/styles",
						},
					],
				},
			],
		}),
	];

	return {
		name: "codestream",
		entry: "./lib/codestream.ts",
		mode: env.production ? "production" : "development",
		target: "node",
		devtool: !env.production ? "eval-source-map" : undefined,
		output: {
			libraryTarget: "commonjs2",
			libraryExport: "default",
			filename: "codestream.js",
			devtoolModuleFilenameTemplate: "file:///[absolute-resource-path]",
		},
		resolve: {
			extensions: [".tsx", ".ts", ".js"],
			// modules: [path.resolve(__dirname, "../codestream-components/node_modules"), "node_modules"],
			alias: {
				// TODO: Use environment variable if exists
				"codestream-components$": path.resolve(__dirname, "../codestream-components/index.ts"),
				"codestream-components": path.resolve(__dirname, "../codestream-components/"),
			},
		},
		externals: [nodeExternals(), { atom: "atom", electron: "electron" }],
		module: {
			rules: [
				{
					test: /\.js$/,
					exclude: /node_modules/,
					use: {
						loader: "babel-loader",
						options: {
							presets: [
								["@babel/preset-env", { modules: false }],
								"@babel/preset-react",
								"@babel/preset-flow",
							],
							plugins: [
								"@babel/plugin-proposal-object-rest-spread",
								"@babel/plugin-proposal-class-properties",
							],
						},
					},
				},
				{
					test: /\.ts$/,
					enforce: "pre",
					use: "tslint-loader",
					exclude: /node_modules/,
				},
				{
					test: /\.tsx?$/,
					use: "ts-loader",
					exclude: /node_modules|\.d\.ts$/,
				},
				{
					test: /\.d\.ts$/,
					loader: "ignore-loader",
				},
			],
		},
		plugins: plugins,
		stats: {
			all: false,
			assets: true,
			builtAt: true,
			env: true,
			errors: true,
			timings: true,
			warnings: true,
		},
	};
}
