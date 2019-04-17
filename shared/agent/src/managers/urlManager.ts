import { Logger } from "../logger";
import { OpenUrlRequest, OpenUrlRequestType } from "../protocol/agent.protocol";
import { lsp, lspHandler } from "../system";
import { openUrl } from "../system/openUrl";

@lsp
export class UrlManager {
	@lspHandler(OpenUrlRequestType)
	async openUrl(request: OpenUrlRequest) {
		const cc = Logger.getCorrelationContext();
		try {
			await openUrl(request.url);
		} catch (ex) {
			Logger.error(ex, cc);
		}
	}
}
