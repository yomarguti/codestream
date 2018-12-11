"use strict";
import { DocumentManager } from "./documentManager";
import { ErrorReporter } from "./errorReporter";
import { GitService } from "./git/gitService";
import { Logger } from "./logger";
import { CodemarksManager } from "./managers/codemarksManager";
import { FilesManager } from "./managers/filesManager";
import { MarkerLocationManager } from "./managers/markerLocationManager";
import { MarkersManager } from "./managers/markersManager";
import { PostsManager } from "./managers/postsManager";
import { ReposManager } from "./managers/reposManager";
import { StreamsManager } from "./managers/streamsManager";
import { TeamsManager } from "./managers/teamsManager";
import { TelemetryManager } from "./managers/telemetryManager";
import { UsersManager } from "./managers/usersManager";
import { TrelloProvider } from "./providers/trello";
import { CodeStreamSession } from "./session";

class ServiceContainer {
	constructor(public readonly session: CodeStreamSession) {
		this._files = new FilesManager(session);
		this._markerLocations = new MarkerLocationManager(session);
		this._codemarks = new CodemarksManager(session);
		this._markers = new MarkersManager(session);
		this._posts = new PostsManager(session);
		this._repos = new ReposManager(session);
		this._streams = new StreamsManager(session);
		this._teams = new TeamsManager(session);
		this._users = new UsersManager(session);

		this._git = new GitService(session);
		this._errorReporter = new ErrorReporter(session);
		this._telemetry = new TelemetryManager(session);

		this._trello = new TrelloProvider(session);

		this._documents = new DocumentManager();
		this._documents.listen(session.connection);
	}

	private readonly _errorReporter: ErrorReporter;
	get errorReporter() {
		return this._errorReporter;
	}

	private readonly _documents: DocumentManager;
	get documents() {
		return this._documents;
	}

	private readonly _files: FilesManager;
	get files(): FilesManager {
		return this._files;
	}

	private readonly _git: GitService;
	get git() {
		return this._git;
	}

	private readonly _codemarks: CodemarksManager;
	get codemarks(): CodemarksManager {
		return this._codemarks;
	}

	private readonly _markerLocations: MarkerLocationManager;
	get markerLocations(): MarkerLocationManager {
		return this._markerLocations;
	}

	private readonly _markers: MarkersManager;
	get markers(): MarkersManager {
		return this._markers;
	}

	private readonly _posts: PostsManager;
	get posts(): PostsManager {
		return this._posts;
	}

	private readonly _repos: ReposManager;
	get repos(): ReposManager {
		return this._repos;
	}

	private readonly _streams: StreamsManager;
	get streams(): StreamsManager {
		return this._streams;
	}

	private readonly _teams: TeamsManager;
	get teams(): TeamsManager {
		return this._teams;
	}

	private readonly _telemetry: TelemetryManager;
	get telemetry() {
		return this._telemetry;
	}

	private readonly _trello: TrelloProvider;
	get trello() {
		return this._trello;
	}

	private readonly _users: UsersManager;
	get users(): UsersManager {
		return this._users;
	}
}

let container: ServiceContainer | undefined;

export namespace Container {
	export function initialize(session: CodeStreamSession) {
		container = new ServiceContainer(session);
	}

	export function instance(): ServiceContainer {
		if (container === undefined) {
			debugger;
			const ex = new Error("Container not yet initialized.");
			Logger.error(ex);
			throw ex;
		}

		return container;
	}
}
