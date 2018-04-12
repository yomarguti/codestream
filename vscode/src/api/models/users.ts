'use strict';
import { CodeStreamCollection, CodeStreamItem  } from './collection';
import { CodeStreamSession } from '../session';
import { CodeStreamStreams } from './streams';
import { User } from '../types';

export class CodeStreamUser extends CodeStreamItem<User> {

    constructor(
        session: CodeStreamSession,
        user: User
    ) {
        super(session, user);
    }

    get email() {
        return this.entity.email;
    }

    get name() {
        return this.entity.username;
    }
}

export class CodeStreamUsers extends CodeStreamCollection<CodeStreamUser, User> {

    constructor(session: CodeStreamSession) {
        super(session);
    }

    protected getEntities() {
        return this.session.getUsers();
    }

    protected mapper(e: User) {
        return new CodeStreamUser(this.session, e);
    }
}
