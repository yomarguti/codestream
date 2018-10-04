"use strict";
import { CSRepository } from "../../agent/agentConnection";
import { Container } from "../../container";
import { CodeStreamSession, RepositoriesChangedEvent } from "../session";
import { CodeStreamCollection, CodeStreamItem } from "./collection";
import { FileStreamCollection } from "./streams";

export class Repository extends CodeStreamItem<CSRepository> {
	constructor(session: CodeStreamSession, repo: CSRepository) {
		super(session, repo);
	}

	get name() {
		return this.entity.name;
	}

	get normalizedUrl() {
		return this.entity.remotes[0].normalizedUrl;
	}

	private _streams: FileStreamCollection | undefined;
	get streams() {
		if (this._streams === undefined) {
			this._streams = new FileStreamCollection(this.session, this.entity.teamId, this);
		}
		return this._streams;
	}

	get url() {
		return this.entity.remotes[0].url;
	}
}

export class RepositoryCollection extends CodeStreamCollection<Repository, CSRepository> {
	constructor(session: CodeStreamSession, public readonly teamId: string) {
		super(session);

		this.disposables.push(session.onDidChangeRepositories(this.onRepositoriesChanged, this));
	}

	private onRepositoriesChanged(e: RepositoriesChangedEvent) {
		this.invalidate();
	}

	protected entityMapper(e: CSRepository) {
		return new Repository(this.session, e);
	}

	protected async fetch() {
		const response = await Container.agent.repos.fetch();
		return response.repos.map(repo => this.entityMapper(repo));
	}
}
