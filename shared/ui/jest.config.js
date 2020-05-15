module.exports = {
	// https://stackoverflow.com/questions/42260218/jest-setup-syntaxerror-unexpected-token-export
	globals: {
		"ts-jest": {
			tsConfig: "./tsconfig.json",	
		},
	},
	"moduleNameMapper": {
		"^lodash-es$": "lodash",
		"@codestream/webview/Stream/Markdowner":"<rootDir>/Stream/Markdowner.ts",
		"@codestream/webview/utils":"<rootDir>/utils.ts",
		"@codestream/protocols/agent": "<rootDir>/protocols/agent/agent.protocol.ts",
		"@codestream/protocols/api": "<rootDir>/protocols/agent/api.protocol.ts"
	},
	preset: "ts-jest",
	testEnvironment: "jest-environment-jsdom-fourteen"
};
