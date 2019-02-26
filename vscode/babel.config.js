module.exports = function(api) {
	api.cache(true);

	return {
		plugins: [
			[
				"@babel/plugin-transform-runtime",
				{
					useESModules: true
				}
			],
			"@babel/proposal-class-properties",
			"@babel/proposal-object-rest-spread"
		],
		presets: [
			[
				"@babel/preset-env",
				{
					targets: {
						chrome: "66",
						esmodules: true
					},
					modules: false,
					useBuiltIns: "usage"
				}
			],
			"@babel/preset-typescript",
			"@babel/preset-react"
		]
	};
};
