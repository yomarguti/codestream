// "use strict";
// import { Uri, workspace, WorkspaceFolder } from "vscode";
// import { CodeStreamCollection, CodeStreamItem } from "./collection";
// import { MarkerCollection } from "./markers";
// import { CodeStreamSession, SessionChangedEvent, SessionChangedType } from "../session";
// import { FileStreamCollection } from "./streams";
// import { Strings } from "../../system";
// import { CSRepository } from "../types";
// import * as path from "path";

// export class Repository extends CodeStreamItem<CSRepository> {
// 	constructor(
// 		session: CodeStreamSession,
// 		repo: CSRepository,
// 		private readonly _folder?: WorkspaceFolder
// 	) {
// 		super(session, repo);
// 	}

// 	async getMarkers(uri: Uri): Promise<MarkerCollection | undefined> {
// 		if (workspace.getWorkspaceFolder(uri) !== this._folder) return undefined;

// 		const stream = await this.streams.getByUri(uri);
// 		if (stream === undefined) return undefined;

// 		return new MarkerCollection(this.session, this, stream, uri, this.entity.teamId);
// 	}

// 	get hash() {
// 		return this.entity.firstCommitHash;
// 	}

// 	get name() {
// 		return this.entity.normalizedUrl;
// 	}

// 	get normalizedUrl() {
// 		return this.entity.normalizedUrl;
// 	}

// 	private _streams: FileStreamCollection | undefined;
// 	get streams() {
// 		if (this._streams === undefined) {
// 			this._streams = new FileStreamCollection(this.session, this.entity.teamId, this);
// 		}
// 		return this._streams;
// 	}

// 	get url() {
// 		return this.entity.url;
// 	}

// 	normalizeUri(relativeUri: Uri): Uri;
// 	normalizeUri(relativePath: string): Uri;
// 	normalizeUri(relativeUriOrPath: Uri | string) {
// 		const relativePath =
// 			typeof relativeUriOrPath === "string" ? relativeUriOrPath : relativeUriOrPath.fsPath;
// 		return Uri.file(Strings.normalizePath(path.join(this._folder!.uri.fsPath, relativePath)));
// 	}

// 	relativizeUri(absoluteUri: Uri): string;
// 	relativizeUri(absolutePath: string): string;
// 	relativizeUri(absoluteUriOrPath: Uri | string) {
// 		const absolutePath =
// 			typeof absoluteUriOrPath === "string" ? absoluteUriOrPath : absoluteUriOrPath.fsPath;

// 		const root = this._folder!.uri.fsPath;
// 		let relativePath = Strings.normalizePath(
// 			root ? path.relative(root, absolutePath) : absolutePath
// 		);
// 		if (relativePath[0] === "/") {
// 			relativePath = relativePath.substr(1);
// 		}
// 		return relativePath;
// 	}
// }

// export class RepositoryCollection extends CodeStreamCollection<Repository, CSRepository> {
// 	constructor(session: CodeStreamSession, public readonly teamId: string) {
// 		super(session);

// 		this.disposables.push(session.onDidChange(this.onSessionChanged, this));
// 	}

// 	private onSessionChanged(e: SessionChangedEvent) {
// 		if (e.type !== SessionChangedType.Git && e.type !== SessionChangedType.Repositories) return;

// 		this.invalidate();
// 	}

// 	async getByFileUri(uri: Uri): Promise<Repository | undefined> {
// 		const folder = workspace.getWorkspaceFolder(uri);
// 		if (folder === undefined) return undefined;

// 		await this.ensureLoaded();
// 		return this._reposByWorkspaceFolder.get(folder);
// 	}

// 	private _reposByUri: Map<Uri, Repository> = new Map();
// 	private _reposByWorkspaceFolder: Map<WorkspaceFolder, Repository> = new Map();

// 	protected entityMapper(e: CSRepository, folder?: WorkspaceFolder) {
// 		return new Repository(this.session, e, folder);
// 	}

// 	protected async fetch() {
// 		const repos = await this.session.api.findOrRegisterRepos();

// 		this._reposByUri.clear();
// 		this._reposByWorkspaceFolder.clear();

// 		const items: Repository[] = [];

// 		let item;
// 		for (const [uri, repo] of repos) {
// 			const folder = workspace.getWorkspaceFolder(uri);

// 			item = this.entityMapper(repo, folder);
// 			items.push(item);

// 			this._reposByUri.set(uri, item);
// 			if (folder !== undefined) {
// 				this._reposByWorkspaceFolder.set(folder, item);
// 			}
// 		}

// 		return items;
// 	}
// }
