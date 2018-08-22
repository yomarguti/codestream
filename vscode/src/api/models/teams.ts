"use strict";
import { CSTeam } from "../api";
import { CodeStreamSession, SessionChangedEvent, SessionChangedType } from "../session";
import { CodeStreamCollection, CodeStreamItem } from "./collection";

export class Team extends CodeStreamItem<CSTeam> {
	constructor(session: CodeStreamSession, team: CSTeam) {
		super(session, team);
	}

	get name() {
		return this.entity.name;
	}
}

export class TeamCollection extends CodeStreamCollection<Team, CSTeam> {
	constructor(session: CodeStreamSession, private readonly _ids: string[]) {
		super(session);

		this.disposables.push(session.onDidChange(this.onSessionChanged, this));
	}

	protected onSessionChanged(e: SessionChangedEvent) {
		if (e.type !== SessionChangedType.Teams) return;

		this.invalidate();
	}

	protected entityMapper(e: CSTeam) {
		return new Team(this.session, e);
	}

	protected fetch(): Promise<CSTeam[]> {
		return this.session.api.getTeams(this._ids);
	}
}
