import babel from "rollup-plugin-babel";
import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";

const input = "index.js";
const plugins = [
	resolve({
		module: true,
		jsnext: true,
		main: true,
		extensions: [".js", ".json"],
		preferBuiltins: false
	}),
	commonjs({
		include: "node_modules/**",
		extensions: [".js", ".json"],
		namedExports: {
			"node_modules/react/index.js": [
				"Component",
				"Children",
				"createElement",
				"Fragment",
				"isValidElement",
				"PureComponent"
			]
		}
	}),
	babel({
		exclude: "node_modules/**"
	})
];

export default [
	{
		input,
		output: {
			file: "dist/codestream-components.es.js",
			format: "es"
		},
		plugins
	},
	{
		input,
		output: {
			file: "dist/codestream-components.cjs.js",
			format: "cjs"
		},
		plugins
	}
];
