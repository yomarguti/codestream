"use strict";
const fs = require("fs");
const path = require("path");
const CleanPlugin = require("clean-webpack-plugin");
const FileManagerPlugin = require("filemanager-webpack-plugin");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
const HtmlPlugin = require("html-webpack-plugin");

module.exports = function(env, argv) {
	env = env || {};
	env.production = !!env.production;
	env.watch = !!(argv.watch || argv.w);
	env.reset = true; // Boolean(env.reset);

	let protocolPath = path.resolve(__dirname, "lib/protocols");
	if (!fs.existsSync(protocolPath)) {
		fs.mkdirSync(protocolPath);
	}

	console.log("Ensuring extension symlink to the agent protocol folder...");
	createFolderSymlinkSync(
		path.resolve(__dirname, "../codestream-lsp-agent/src/protocol"),
		path.resolve(protocolPath, "agent"),
		env
	);

	console.log("Ensuring extension symlink to the webview protocol folder...");
	createFolderSymlinkSync(
		path.resolve(__dirname, "../codestream-components/ipc"),
		path.resolve(protocolPath, "webview"),
		env
	);

	console.log("Ensuring webview symlink to the agent protocol folder...");
	const protocolPathForWebview = path.resolve(__dirname, "../codestream-components/protocols");
	if (!fs.existsSync(protocolPathForWebview)) {
		fs.mkdirSync(protocolPathForWebview);
	}
	createFolderSymlinkSync(
		path.resolve(__dirname, "../codestream-lsp-agent/src/protocol"),
		path.resolve(protocolPathForWebview, "agent"),
		env
	);

	return [getExtensionConfig(env), getWebviewConfig(env)];
};

function getExtensionConfig(env) {
	let clean = ["dist/agent*", "dist/codestream*"];

	const plugins = [
		new CleanPlugin(clean, { verbose: false }),
		new FileManagerPlugin({
			onEnd: [
				{
					copy: [
						{
							// TODO: Use environment variable if exists
							source: path.resolve(__dirname, "../codestream-lsp-agent/dist/agent.*"),
							destination: "dist/",
						},
						// {
						// 	source: path.resolve(__dirname, "codestream-*.info"),
						// 	destination: "dist/",
						// },
						{
							source: path.resolve(__dirname, "../codestream-components/styles/*.less"),
							destination: "dist/styles",
						},
					],
				},
			],
		}),
	];

	return {
		name: "extension",
		entry: "./lib/codestream.ts",
		mode: env.production ? "production" : "development",
		target: "node",
		devtool: "source-map",
		output: {
			libraryTarget: "commonjs2",
			libraryExport: "default",
			filename: "codestream.js",
			devtoolModuleFilenameTemplate: "file:///[absolute-resource-path]",
		},
		resolve: {
			extensions: [".ts", ".tsx", ".js", ".jsx"],
			plugins: [new TsconfigPathsPlugin()],
			// Treats symlinks as real files -- using their "current" path
			symlinks: false,
		},
		externals: [{ atom: "atom", electron: "electron" }],
		module: {
			rules: [
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

function getWebviewConfig(env) {
	const plugins = [
		new CleanPlugin(["dist/webview"]),
		// new MiniCssExtractPlugin({
		// 	filename: "webview.css",
		// }),
		new HtmlPlugin({
			template: "index.html",
			filename: path.resolve(__dirname, "dist/webview/index.html"),
			inject: true,
			minify: env.production
				? {
						removeComments: true,
						collapseWhitespace: true,
						removeRedundantAttributes: true,
						useShortDoctype: true,
						removeEmptyAttributes: true,
						removeStyleLinkTypeAttributes: true,
						keepClosingSlash: true,
				  }
				: false,
		}),
	];

	return {
		name: "webview",
		context: path.resolve(__dirname, "webview-lib"),
		entry: {
			webview: "./index.tsx",
		},
		node: false,
		mode: env.production ? "production" : "development",
		devtool: !env.production ? "eval-source-map" : undefined,
		output: {
			filename: "[name].js",
			path: path.resolve(__dirname, "dist/webview"),
			publicPath: path.resolve(__dirname, "dist/webview/"),
		},
		module: {
			rules: [
				{
					test: /\.html$/,
					use: "html-loader",
				},
				{
					test: /\.(js|ts)x?$/,
					use: "babel-loader",
					exclude: /node_modules/,
				},
				// {
				// 	test: /\.less$/,
				// 	use: [
				// 		{
				// 			loader: MiniCssExtractPlugin.loader,
				// 		},
				// 		{
				// 			loader: "css-loader",
				// 			options: {
				// 				sourceMap: !env.production,
				// 				url: false,
				// 			},
				// 		},
				// 		{
				// 			loader: "less-loader",
				// 			options: {
				// 				sourceMap: !env.production,
				// 			},
				// 		},
				// 	],
				// 	exclude: /node_modules/,
				// },
			],
		},
		resolve: {
			extensions: [".ts", ".tsx", ".js", ".jsx"],
			modules: [path.resolve(__dirname, "webview-lib"), "node_modules"],
			plugins: [
				new TsconfigPathsPlugin({
					configFile: path.resolve(__dirname, "webview-lib/tsconfig.json"),
				}),
			],
			// Treats symlinks as real files -- using their "current" path
			symlinks: false,
		},
		node: {
			net: "mock",
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

function createFolderSymlinkSync(source, target, env) {
	if (env.reset) {
		console.log("Unlinking symlink...");
		try {
			fs.unlinkSync(target);
		} catch (ex) {}
	} else if (fs.existsSync(target)) {
		return;
	}

	console.log("Creating symlink...");
	try {
		fs.symlinkSync(source, target, "dir");
	} catch (ex) {
		try {
			fs.unlinkSync(target);
			fs.symlinkSync(source, target, "dir");
		} catch (ex) {
			console.log(`Symlink creation failed; ${ex}`);
		}
	}
}
