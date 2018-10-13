"use strict";
import { CSRepository } from "../../agent/agentConnection";
import { CodeStreamSession } from "../session";
import { CodeStreamItem } from "./collection";
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
