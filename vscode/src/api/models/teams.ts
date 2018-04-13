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

    constructor(session: CodeStreamSession) {
        super(session);
    }

    protected fetch(): Promise<CSTeam[]> {
        throw new Error('Not implemented');
        // return this.session.getTeams();
    }

    protected map(e: CSTeam) {
        return new Team(this.session, e);
    }
}
