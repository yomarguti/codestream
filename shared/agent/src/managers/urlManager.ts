import opn from "opn";
import { Logger } from "../logger";
import { OpenUrlRequest, OpenUrlRequestType } from "../protocol/agent.protocol";
import { lsp, lspHandler } from "../system";

@lsp
export class UrlManager {
	@lspHandler(OpenUrlRequestType)
	async openUrl(request: OpenUrlRequest) {
		const cc = Logger.getCorrelationContext();
		try {
			await opn(request.url, { wait: false });
		} catch (ex) {
			Logger.error(ex, cc);
		}
	}
}
