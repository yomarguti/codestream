'use strict';
import { Disposable, Event, EventEmitter } from 'vscode';
import { Functions, Iterables } from '../../system';
import { CodeStreamSession } from '../session';
import { CSEntity } from '../types';

export const mappedSymbol = Symbol('codestream-mapped');

interface ICollectionItem<TEntity extends CSEntity> {
    // Marker as to whether or not the item has been mapped: entity -> item
    [mappedSymbol]: boolean;
    readonly id: string;
    readonly entity: TEntity;
}

export abstract class CodeStreamItem<TEntity extends CSEntity> extends Disposable implements ICollectionItem<TEntity> {

    [mappedSymbol] = true;

    constructor(
        protected readonly session: CodeStreamSession,
        public readonly entity: TEntity
    ) {
        super(() => this.dispose());
    }

    dispose() {
    }

    get id() {
        return this.entity.id;
    }
}

export abstract class CodeStreamCollection<TItem extends ICollectionItem<TEntity>, TEntity extends CSEntity> extends Disposable {

    private _onDidChange = new EventEmitter<void>();
    get onDidChange(): Event<void> {
        return this._onDidChange.event;
    }

    constructor(
        protected readonly session: CodeStreamSession
    ) {
        super(() => this.dispose());
    }

    dispose() {
        if (this._disposables !== undefined) {
            this._disposables.forEach(d => d.dispose());
            this._disposables = undefined;
        }
    }

    private _disposables: Disposable[] | undefined;
    protected get disposables() {
        if (this._disposables === undefined) {
            this._disposables = [];
        }
        return this._disposables;
    }

    protected abstract fetch(): Promise<(TEntity | TItem)[]>;
    protected abstract fetchMapper(e: TEntity): TItem;

    private _collection: Promise<Map<string, TEntity | TItem>> | undefined;
    get items(): Promise<IterableIterator<TItem>> {
        return this.ensureLoaded().then(items => this.ensureMapped(items));
    }

    get entities(): Promise<TEntity[]> {
        return this.map(i => i.entity).then(mapped => [...mapped]);
    }

    async filter(predicate: (item: TItem) => boolean) {
        return Iterables.filter(await this.items, predicate);
    }

    async find(predicate: (item: TItem) => boolean) {
        return Iterables.find(await this.items, predicate);
    }

    async first() {
        return Iterables.first(await this.items);
    }

    async get(key: string) {
        const collection = await this.ensureLoaded();
        return collection.get(key) as TItem;
    }

    async has(key: string) {
        const collection = await this.ensureLoaded();
        return collection.has(key);
    }

    async map<T>(mapper: (item: TItem) => T) {
        return Iterables.map(await this.items, mapper);
    }

    protected ensureLoaded() {
        if (this._collection === undefined) {
            this._collection = this.load();
        }
        return this._collection;
    }

    private *ensureMapped(items: Map<string, TEntity | TItem>) {
        for (const [key, value] of items) {
            if ((value as ICollectionItem<TEntity>)[mappedSymbol]) {
                yield value as TItem;
                continue;
            }

            const mapped = this.fetchMapper(value as TEntity);
            items.set(key, mapped);
            yield mapped;
        }
    }

    private _changedDebounced: (() => void) | undefined;
    protected fireChanged() {
        if (this._changedDebounced === undefined) {
            this._changedDebounced = Functions.debounce(() => this._onDidChange.fire(), 250);
        }
        this._changedDebounced();
    }

    protected invalidate() {
        this._collection = undefined;
        this.fireChanged();
    }

    protected async load() {
        const entities = await this.fetch();
        return new Map(entities.map<[string, TEntity | TItem]>(e => [e.id, e]));
    }
}
