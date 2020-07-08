import { Logger } from "../logger";
import { AgentOpenUrlRequest, AgentOpenUrlRequestType } from "../protocol/agent.protocol";
import { lsp, lspHandler } from "../system";
import { openUrl } from "../system/openUrl";

@lsp
export class UrlManager {
	@lspHandler(AgentOpenUrlRequestType)
	async openUrl(request: AgentOpenUrlRequest) {
		const cc = Logger.getCorrelationContext();
		try {
			await openUrl(request.url);
		} catch (ex) {
			Logger.error(ex, cc);
		}
	}
}
