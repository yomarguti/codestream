import babel from "rollup-plugin-babel";
import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import json from "rollup-plugin-json";

export default {
	input: "index.js",
	output: [
		{
			file: "dist/codestream-components.es.js",
			format: "es"
		},
		{
			file: "dist/codestream-components.cjs.js",
			format: "cjs"
		}
	],
	plugins: [
		json({
			include: "node_modules/**",
			preferConst: true
		}),
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
				],
				"node_modules/react-dom/index.js": ["findDOMNode", "createPortal"]
			}
		}),
		babel({
			exclude: "node_modules/**"
		})
	]
};
