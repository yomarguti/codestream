'use strict';
import { CodeStreamCollection, CodeStreamItem  } from './collection';
import { CodeStreamSession } from '../session';
import { CodeStreamStreams } from './streams';
import { Team } from '../types';

export class CodeStreamTeam extends CodeStreamItem<Team> {

    constructor(
        session: CodeStreamSession,
        team: Team
    ) {
        super(session, team);
    }

    // get repos() {
    //     return this.session.repo;
    // }
}

export class CodeStreamTeams extends CodeStreamCollection<CodeStreamTeam, Team> {

    constructor(session: CodeStreamSession) {
        super(session);
    }

    protected getEntities(): Promise<Team[]> {
        throw new Error('Not implemented');
        // return this.session.getTeams();
    }

    protected mapper(e: Team) {
        return new CodeStreamTeam(this.session, e);
    }
}
