"use strict";
import * as path from "path";
import {
	CancellationToken,
	Connection,
	Range,
	TextDocumentIdentifier,
	TextDocumentPositionParams
} from "vscode-languageserver";
import URI from "vscode-uri";
import {
	AgentOptions,
	ApiRequest,
	ApiRequestParams,
	CodeStreamAgent,
	DocumentMarkersRequest,
	DocumentMarkersRequestParams,
	DocumentPostRequest,
	DocumentPostRequestParams,
	DocumentPreparePostRequest,
	DocumentPreparePostRequestParams,
	DocumentPreparePostResponse
} from "./agent";
import { AgentError, ServerError } from "./agentError";
import { CodeStreamApi, CreatePostRequestCodeBlock, CSStream } from "./api/api";
import { UserCollection } from "./api/models/users";
import { Container } from "./container";
import { setGitPath } from "./git/git";
import { Logger } from "./logger";
import { MarkerHandler } from "./marker/markerHandler";
import { PubnubReceiver } from "./pubnub/pubnubReceiver";
import { Iterables, Strings } from "./system";

const loginApiErrorMappings: { [k: string]: string } = {
	"USRC-1001": "INVALID_CREDENTIALS",
	"USRC-1010": "NOT_CONFIRMED",
	"AUTH-1002": "TOKEN_INVALID",
	"AUTH-1003": "TOKEN_INVALID",
	"AUTH-1005": "TOKEN_INVALID",
	// "RAPI-1001": "missing parameter" // shouldn't ever happen
	"RAPI-1003": "NOT_FOUND",
	"USRC-1012": "USER_NOT_ON_TEAM"
};

export class CodeStreamSession {
	private readonly _api: CodeStreamApi;
	private _pubnub: PubnubReceiver | undefined;

	constructor(
		private readonly _agent: CodeStreamAgent,
		private readonly _connection: Connection,
		private readonly _options: AgentOptions
	) {
		this._api = new CodeStreamApi(
			_options.serverUrl,
			_options.ideVersion,
			_options.extensionVersion
		);

		this._connection.onHover(this.onHover.bind(this));

		this._agent.registerHandler(ApiRequest, this.onApiRequest.bind(this));
		this._agent.registerHandler(DocumentMarkersRequest, this.onMarkersRequest.bind(this));
		this._agent.registerHandler(DocumentPreparePostRequest, this.onPreparePostRequest.bind(this));
		this._agent.registerHandler(DocumentPostRequest, this.onPostRequest.bind(this));
	}

	private onApiRequest(
		{ url, token, init }: ApiRequestParams,
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

	private onMarkersRequest(
		{ textDocument }: DocumentMarkersRequestParams,
		cancellationToken: CancellationToken
	) {
		this._connection.console.log(`DocumentMarkersRequest received`);

		const result = MarkerHandler.handle(textDocument);
		return result;
	}

	private onPreparePostRequest(
		e: DocumentPreparePostRequestParams,
		cancellationToken: CancellationToken
	) {
		this._connection.console.log(`DocumentPreparePostRequest received`);

		return this.preparePostCode(e.textDocument, e.range, e.dirty);
	}

	private onPostRequest(e: DocumentPostRequestParams) {
		this._connection.console.log(`DocumentPostRequest received`);

		return this.postCode(
			e.textDocument,
			// e.range,
			// e.dirty,
			e.text,
			e.code,
			e.location,
			e.source,
			e.parentPostId,
			e.streamId,
			e.teamId
		);
	}

	private _apiToken: string | undefined;
	get apiToken() {
		return this._apiToken!;
	}

	private _teamId: string | undefined;
	get teamId() {
		return this._teamId!;
	}

	private _userId: string | undefined;
	get userId() {
		return this._userId!;
	}

	private _users: UserCollection | undefined;
	get users() {
		if (this._users === undefined) {
			this._users = new UserCollection(this);
		}
		return this._users;
	}

	async login() {
		let loginResponse;
		try {
			if (this._options.signupToken) {
				loginResponse = await this._api.checkSignup(this._options.signupToken);
			} else {
				loginResponse = await this._api.login(this._options.email, this._options.passwordOrToken);
			}
		} catch (ex) {
			if (ex instanceof ServerError) {
				return {
					error: loginApiErrorMappings[ex.info.code] || ""
				};
			}

			throw AgentError.wrap(ex, `Login failed:\n${ex.message}`);
		}

		this._apiToken = loginResponse.accessToken;
		this._options.passwordOrToken = { value: loginResponse.accessToken };

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

		setGitPath(this._options.gitPath);
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
			// TODO: Change this once production is upgraded to use the pubnub token
			this._apiToken, // loginResponse.pubnubToken,
			this._apiToken,
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

	async preparePostCode(
		documentId: TextDocumentIdentifier,
		range: Range,
		dirty: boolean = false
	): Promise<DocumentPreparePostResponse> {
		const { documents, git } = Container.instance();
		const document = documents.get(documentId.uri);
		if (document === undefined) {
			throw new Error(`No document could be found for Uri(${documentId.uri})`);
		}

		const uri = URI.parse(document.uri);
		const repoPath = await git.getRepoRoot(uri.fsPath);

		let authors: { id: string; username: string }[] | undefined;
		let file: string | undefined;
		let remotes: { name: string; url: string }[] | undefined;
		let rev: string | undefined;
		if (repoPath !== undefined) {
			try {
				file = Strings.normalizePath(path.relative(repoPath, uri.fsPath));
				if (file[0] === "/") {
					file = file.substr(1);
				}

				rev = await git.getFileCurrentRevision(uri.fsPath);
				const gitRemotes = await git.getRepoRemotes(repoPath);
				remotes = [...Iterables.map(gitRemotes, r => ({ name: r.name, url: r.normalizedUrl }))];

				const gitAuthors = await git.getFileAuthors(uri.fsPath, {
					startLine: range.start.line,
					endLine: range.end.line - 1,
					contents: dirty ? document.getText() : undefined
				});
				const authorEmails = gitAuthors.map(a => a.email);

				const users = await this.users.getByEmails(authorEmails);
				authors = [...Iterables.map(users, u => ({ id: u.id, username: u.name }))];
			} catch (ex) {
				Logger.error(ex);
				debugger;
			}
		}

		return {
			code: document.getText(range),
			source:
				repoPath !== undefined
					? {
							file: file!,
							repoPath: repoPath,
							revision: rev!,
							authors: authors || [],
							remotes: remotes || []
					  }
					: undefined
		};
	}

	async postCode(
		documentId: TextDocumentIdentifier,
		// range: Range,
		// dirty: boolean = false,
		text: string,
		code: string,
		location: [number, number, number, number] | undefined,
		source:
			| {
					file: string;
					repoPath: string;
					revision: string;
					authors: { id: string; username: string }[];
					remotes: { name: string; url: string }[];
			  }
			| undefined,
		parentPostId: string | undefined,
		streamId: string,
		teamId?: string
	) {
		const codeBlock: CreatePostRequestCodeBlock = {
			code: code,
			location: location
		};

		if (source !== undefined) {
			codeBlock.file = source.file;
			if (source.remotes.length > 0) {
				codeBlock.remotes = source.remotes.map(r => r.url);
			}
		}

		try {
			return (await this._api.createPost(this._apiToken!, {
				teamId: teamId || this.teamId,
				streamId: streamId,
				text: text,
				parentPostId: parentPostId,
				codeBlocks: [codeBlock],
				commitHashWhenPosted: source && source.revision
			})).post;
		} catch (ex) {
			debugger;
			return;
		}
	}

	private async getSubscribeableStreams(userId: string, teamId?: string): Promise<CSStream[]> {
		return (await this._api.getStreams<CSStream>(
			this._apiToken!,
			teamId || this._teamId!
		)).streams.filter(s => CodeStreamApi.isStreamSubscriptionRequired(s, userId));
	}
}
