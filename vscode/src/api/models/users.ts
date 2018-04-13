'use strict';
import { CodeStreamCollection, CodeStreamItem  } from './collection';
import { CodeStreamSession } from '../session';
import { CSUser } from '../types';

export class User extends CodeStreamItem<CSUser> {

    constructor(
        session: CodeStreamSession,
        user: CSUser
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

export class UserCollection extends CodeStreamCollection<User, CSUser> {

    constructor(session: CodeStreamSession) {
        super(session);
    }

    protected fetch() {
        return this.session.api.getUsers();
    }

    protected map(e: CSUser) {
        return new User(this.session, e);
    }
}
