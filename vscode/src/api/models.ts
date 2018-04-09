'use strict';
import { Disposable } from 'vscode';
import { Entity, Repository, Stream, Team } from './types';
import { CodeStreamSession } from './session';

interface ICollectionEntity<TKey> {
    readonly key: TKey;
}

export abstract class CodeStreamEntity<TEntity extends Entity> extends Disposable implements ICollectionEntity<string> {

    constructor(
        protected readonly session: CodeStreamSession,
        protected readonly entity: TEntity
    ) {
        super(() => this.dispose());
    }

    dispose() {
    }

    get key() {
        return this.id;
    }

    get id() {
        return this.entity.id;
    }
}

export class CodeStreamStream extends CodeStreamEntity<Stream> {

    constructor(
        session: CodeStreamSession,
        stream: Stream
    ) {
        super(session, stream);
    }

    get repoId() {
        return this.entity.repoId;
    }

    get teamId() {
        return this.entity.teamId;
    }
}

export class CodeStreamRepository extends CodeStreamEntity<Repository> {

    constructor(
        session: CodeStreamSession,
        repo: Repository
    ) {
        super(session, repo);
    }

    get teamId() {
        return this.entity.teamId;
    }

    get streams() {
        return this.session.streams(this);
    }
}

export class CodeStreamTeam extends CodeStreamEntity<Team> {

    constructor(
        session: CodeStreamSession,
        team: Team
    ) {
        super(session, team);
    }

    get repos() {
        return this.session.repos(this);
    }
}

export abstract class CodeStreamCollection<TKey, TValue extends ICollectionEntity<TKey>, TEntity extends Entity> extends Disposable {

    constructor(
        protected readonly session: CodeStreamSession
    ) {
        super(() => this.dispose());
    }

    dispose() {
    }

    private _col: Map<TKey, TValue> | undefined;

    private _collection: Promise<Map<TKey, TValue>> | undefined;
    get items(): Promise<IterableIterator<TValue>> {
        return this.getValues();
    }

    async get(key: TKey) {
        const collection = await this.ensureLoaded();
        return collection.get(key);
    }

    async has(key: TKey) {
        const collection = await this.ensureLoaded();
        return collection.has(key);
    }

    private async getValues() {
        const collection = await this.ensureLoaded();
        return collection.values();
    }
    protected async ensureLoaded() {
        if (this._collection === undefined) {
            this._collection = this.load();
        }
        this._col = await this._collection;
        return this._collection;
    }

    protected async load() {
        const entities = await this.getEntities();

        const map = new Map();
        let item;
        for (const e of entities) {
            item = this.mapEntity(e);
            map.set(item.key, item);
        }
        return map;
    }

    protected abstract getEntities(): Promise<TEntity[]>;
    protected abstract mapEntity(e: TEntity): TValue;
}

export class CodeStreamRepositories extends CodeStreamCollection<string, CodeStreamRepository, Repository> {

    constructor(
        session: CodeStreamSession,
        public readonly team: CodeStreamTeam
    ) {
        super(session);
    }

    getEntities() {
        return this.session.getRepos(this.team.id);
    }

    mapEntity(e: Repository) {
        return new CodeStreamRepository(this.session, e);
    }
}

export class CodeStreamStreams extends CodeStreamCollection<string, CodeStreamStream, Stream> {

    constructor(
        session: CodeStreamSession,
        // public readonly team: CodeStreamTeam,
        public readonly repo: CodeStreamRepository
    ) {
        super(session);
    }

    getEntities() {
        return this.session.getStreams(this.repo.teamId, this.repo.id);
    }

    mapEntity(e: Stream) {
        return new CodeStreamStream(this.session, e);
    }
}

export class CodeStreamTeams extends CodeStreamCollection<string, CodeStreamTeam, Team> {

    constructor(session: CodeStreamSession) {
        super(session);
    }

    getEntities() {
        return this.session.getTeams();
    }

    mapEntity(e: Team) {
        return new CodeStreamTeam(this.session, e);
    }
}
