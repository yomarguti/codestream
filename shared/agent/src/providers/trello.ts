import { Logger } from "../logger";
import { CodeStreamSession } from "../session";
import {
	TrelloAuthRequest,
	TrelloAuthRequestType,
	TrelloCreateCardRequest,
	TrelloCreateCardRequestType,
	TrelloFetchBoardsRequest,
	TrelloFetchBoardsRequestType,
	TrelloFetchListsRequest,
	TrelloFetchListsRequestType
} from "../shared/agent.protocol";
import { log, lsp, lspHandler } from "../system";

@lsp
export class TrelloProvider {
	// private readonly _trello: TrelloClient;

	constructor(session: CodeStreamSession) {}

	@log()
	@lspHandler(TrelloAuthRequestType)
	auth(request: TrelloAuthRequest) {
		const cc = Logger.getCorrelationContext();
		try {
			// TODO
		} catch (ex) {
			Logger.error(ex, cc);
		}
	}

	@log()
	@lspHandler(TrelloFetchBoardsRequestType)
	boards(request: TrelloFetchBoardsRequest) {
		const cc = Logger.getCorrelationContext();
		try {
			// TODO
		} catch (ex) {
			Logger.error(ex, cc);
		}
	}

	@log()
	@lspHandler(TrelloCreateCardRequestType)
	createCard(request: TrelloCreateCardRequest) {
		const cc = Logger.getCorrelationContext();
		try {
			// TODO
		} catch (ex) {
			Logger.error(ex, cc);
		}
	}

	@log()
	@lspHandler(TrelloFetchListsRequestType)
	lists(request: TrelloFetchListsRequest) {
		const cc = Logger.getCorrelationContext();
		try {
			// TODO
		} catch (ex) {
			Logger.error(ex, cc);
		}
	}
}
