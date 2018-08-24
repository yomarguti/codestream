"use strict";
import { CSTeam } from "../api";
import { CodeStreamSession, TeamsChangedEvent } from "../session";
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

		this.disposables.push(session.onDidChangeTeams(this.onTeamsChanged, this));
	}

	protected onTeamsChanged(e: TeamsChangedEvent) {
		this.invalidate();
	}

	protected entityMapper(e: CSTeam) {
		return new Team(this.session, e);
	}

	protected fetch(): Promise<CSTeam[]> {
		return this.session.api.getTeams(this._ids);
	}
}
