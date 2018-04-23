'use strict';
import { CodeStreamCollection, CodeStreamItem  } from './collection';
import { CodeStreamSession } from '../session';
import { Iterables } from '../../system';
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

    constructor(
        session: CodeStreamSession,
        public readonly teamId: string
    ) {
        super(session);
    }

    async getByEmail(email: string): Promise<User | undefined> {
        return Iterables.find(await this.items(), u => u.email === email);
    }

    async getByEmails(emails: string[]): Promise<Iterable<User>> {
        return Iterables.filter(await this.items(), u => emails.includes(u.email));
    }

    protected fetch() {
        return this.session.api.getUsers();
    }

    protected fetchMapper(e: CSUser) {
        return new User(this.session, e);
    }
}
