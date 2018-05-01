'use strict';
import { CodeStreamCollection, CodeStreamItem  } from './collection';
import { CodeStreamSession } from '../session';
import { CSTeam } from '../types';

export class Team extends CodeStreamItem<CSTeam> {

    constructor(
        session: CodeStreamSession,
        team: CSTeam
    ) {
        super(session, team);
    }

    // get repos() {
    //     return this.session.repo;
    // }
}

export class TeamCollection extends CodeStreamCollection<Team, CSTeam> {

    constructor(
        session: CodeStreamSession,
        private readonly _ids: string[]
    ) {
        super(session);
    }

    protected entityMapper(e: CSTeam) {
        return new Team(this.session, e);
    }

    protected fetch(): Promise<CSTeam[]> {
        return this.session.api.getTeams(this._ids);
    }
}
