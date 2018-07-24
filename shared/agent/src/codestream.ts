"use strict";
import {
	CancellationToken,
	Connection,
	Range,
	TextDocumentIdentifier,
	TextDocumentPositionParams
} from "vscode-languageserver";
import { CodeStreamAgent, CodeStreamAgentOptions } from "./agent";
import { CodeStreamApi, CSPost, CSStream } from "./api/api";
import { Container } from "./container";
import { ApiRequest, PostCodeRequest } from "./ipc/agent";
import { MarkerHandler } from "./marker/markerHandler";
import { PubnubReceiver } from "./pubnub/pubnubReceiver";

export class CodeStream {
	private readonly _api: CodeStreamApi;
	private _apiToken: string | undefined;
	private _pubnub: PubnubReceiver | undefined;
	private _teamId: string | undefined;
	private _userId: string | undefined;

	constructor(
		private readonly _agent: CodeStreamAgent,
		private readonly _connection: Connection,
		private readonly _options: CodeStreamAgentOptions
	) {
		this._api = new CodeStreamApi(
			_options.serverUrl,
			_options.ideVersion,
			_options.extensionVersion
		);

		this._connection.onHover(this.onHover.bind(this));

		// TODO: This should go away in favor of specific registrations
		this._connection.onRequest(this.onRequest.bind(this));

		this._agent.registerHandler(ApiRequest.type, this.onApiRequest.bind(this));
		this._agent.registerHandler(PostCodeRequest.type, this.onPostCodeRequest.bind(this));
		// this._agent.registerHandler(
		// 	"codeStream/api",
		// 	(
		// 		{ url, token, init }: { url: string; token: string; init: RequestInit },
		// 		cancellationToken: CancellationToken
		// 	) => this.onApiRequest(url, token, init, cancellationToken)
		// );

		// this._agent.registerHandler(
		// 	"codeStream/textDocument/post",
		// 	(
		// 		{ document, range }: { document: TextDocumentIdentifier; range: Range },
		// 		cancellationToken: CancellationToken
		// 	) => this.onPostCodeRequest(document, range, cancellationToken)
		// );
	}

	private onApiRequest(
		{ url, token, init }: ApiRequest.Params,
		cancellationToken: CancellationToken
	) {
		const result = this._api.fetch(url, init, token);
		return result;
	}

	// TODO: Move out of here
	private onHover(e: TextDocumentPositionParams) {
		this._connection.console.log("Hover request received");
		return undefined;
	}

	private onPostCodeRequest(
		{ document, range }: PostCodeRequest.Params,
		cancellationToken: CancellationToken
	) {
		const result = this.postCode(document, range);
		return result;
	}

	// TODO: Remove this and use specific route registration
	private onRequest(method: string, ...params: any[]) {
		if (!method.startsWith("codeStream")) return undefined;

		this._connection.console.log(`Request ${method} received`);

		switch (method) {
			case "codeStream/textDocument/markers":
				return MarkerHandler.handle(params);
		}

		return undefined;
	}

	async login() {
		const loginResponse = await this._api.login(this._options.email, this._options.token);

		this._apiToken = loginResponse.accessToken;
		// TODO: Since the token is current a password, replace it with an access token
		this._options.token = loginResponse.accessToken;

		// If there is only 1 team, use it regardless of config
		if (loginResponse.teams.length === 1) {
			this._options.teamId = loginResponse.teams[0].id;
		} else {
			// Sort the teams from oldest to newest
			loginResponse.teams.sort((a, b) => a.createdAt - b.createdAt);
		}

		if (this._options.teamId == null) {
			if (this._options.team) {
				const normalizedTeamName = this._options.team.toLocaleUpperCase();
				const team = loginResponse.teams.find(
					t => t.name.toLocaleUpperCase() === normalizedTeamName
				);
				if (team != null) {
					this._options.teamId = team.id;
				}
			}

			// if (opts.teamId == null && data.repos.length > 0) {
			// 	for (const repo of await Container.git.getRepositories()) {
			// 		const url = await repo.getNormalizedUrl();

			// 		const found = data.repos.find(r => r.normalizedUrl === url);
			// 		if (found === undefined) continue;

			// 		teamId = found.teamId;
			// 		break;
			// 	}
			// }

			// If we still can't find a team, then just pick the first one
			if (this._options.teamId == null) {
				this._options.teamId = loginResponse.teams[0].id;
			}
		}

		if (loginResponse.teams.find(t => t.id === this._options.teamId) === undefined) {
			this._options.teamId = loginResponse.teams[0].id;
		}
		this._teamId = this._options.teamId;
		this._userId = loginResponse.user.id;

		void (await Container.initialize(
			this._agent,
			this._connection,
			this._api,
			this._options,
			loginResponse
		));

		this._pubnub = new PubnubReceiver(
			this._agent,
			this._api,
			loginResponse.pubnubKey,
			loginResponse.pubnubToken,
			loginResponse.accessToken,
			this._userId,
			this._teamId
		);

		const streams = await this.getSubscribeableStreams(this._userId, this._teamId);
		this._pubnub.listen(streams.map(s => s.id));

		return {
			loginResponse: { ...loginResponse },
			state: { ...Container.instance().state }
		};
	}

	async postCode(document: TextDocumentIdentifier, range: Range): Promise<CSPost | undefined> {
		// const streamThread = await this.findStreamThread(args.session || Container.session, args, {
		// 	includeActive: true,
		// 	includeDefault: true
		// });
		// if (streamThread === undefined) throw new Error(`No stream could be found`);

		// const uri = document.uri;

		// const repo = await (args.session || Container.session).repos.getByFileUri(uri);
		// if (repo === undefined) {
		// 	throw new Error(`No repository could be found for Uri(${uri.toString()}`);
		// }

		// const authors = await Container.git.getFileAuthors(uri, {
		// 	ref: args.ref,
		// 	startLine: selection.start.line,
		// 	endLine: selection.end.line,
		// 	contents: document.isDirty ? document.getText() : undefined
		// });

		// const authorEmails = authors.map(a => a.email);
		// Logger.log(`Commands.postCode: authors found: ${authorEmails.join(", ")}`);

		// const users = await (args.session || Container.session).users.getByEmails(authorEmails);
		// const mentions = Iterables.join(Iterables.map(users, u => `@${u.name}`), ", ");

		// let code;
		// let commitHash;
		// if (args.ref == null) {
		// 	code = document.getText(selection);
		// 	commitHash = await Container.git.getFileCurrentSha(document.uri);
		// } else {
		// 	const content = await Container.git.getFileRevisionContent(document.uri, args.ref);
		// 	if (content == null) {
		// 		throw new Error(`Unable to load file revision contents for Uri(${uri.toString()}`);
		// 	}

		// 	const revision = await workspace.openTextDocument({ content: content });
		// 	code = revision.getText(selection);
		// 	commitHash = await Container.git.resolveRef(document.uri, args.ref);
		// }

		// if (args.send && args.text) {
		// 	// Get the file/marker stream to post to
		// 	const markerStream = await repo.streams.toIdOrArgs(uri);
		// 	return streamThread.stream.postCode(
		// 		args.text,
		// 		code,
		// 		[
		// 			selection.start.line,
		// 			selection.start.character,
		// 			selection.end.line,
		// 			selection.end.character
		// 		],
		// 		commitHash!,
		// 		markerStream,
		// 		streamThread.id
		// 	);
		// }

		// await Container.streamView.postCode(
		// 	streamThread,
		// 	repo,
		// 	repo.relativizeUri(uri),
		// 	code,
		// 	selection,
		// 	commitHash!,
		// 	args.text,
		// 	mentions
		// );
		// return streamThread.stream;

		return undefined;
	}

	private async getSubscribeableStreams(userId: string, teamId?: string): Promise<CSStream[]> {
		return (await this._api.getStreams<CSStream>(
			this._apiToken!,
			teamId || this._teamId!
		)).streams.filter(s => CodeStreamApi.isStreamSubscriptionRequired(s, userId));
	}
}
