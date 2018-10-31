/// <reference types="node"/>
declare module "https-proxy-agent" {
	import { Agent } from "http";
	import { Url } from "url";

	interface HttpsProxyAgentOptions {
		host: string;
		port: number;
		secureProxy?: boolean;
		headers?: {
			[key: string]: string;
		};
		[key: string]: any;
	}

	class HttpProxyAgent extends Agent {
		constructor(options: string | Url | HttpsProxyAgentOptions);

		proxy: Url;
		secureProxy: boolean;
	}

	export default HttpProxyAgent;
}
