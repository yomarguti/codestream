import config from "./rollup.config.es.js";

export default Object.apply(config, {
	output: {
		file: "dist/codestream-components.cjs.js",
		format: "cjs"
	}
});
