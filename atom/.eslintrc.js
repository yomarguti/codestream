module.exports = {
	env: {
		browser: true,
		commonjs: true,
		es6: true,
		node: true
	},
	extends: ["eslint:recommended", "plugin:react/recommended"],
	parser: "babel-eslint",
	parserOptions: {
		ecmaFeatures: {
			experimentalObjectRestSpread: true,
			jsx: true
		},
		sourceType: "module"
	},
	globals: { atom: false },
	plugins: ["react"],
	rules: {
		indent: "off",
		"linebreak-style": ["error", "unix"],
		quotes: ["error", "double", { avoidEscape: true }],
		semi: ["error", "always"],
		"no-console": "off",
		"react/prop-types": [2, { skipUndeclared: true }],
		"no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
	}
};
