'use strict';
import { Disposable, Event, EventEmitter } from 'vscode';
import { Functions, Iterables } from '../../system';
import { CodeStreamSession } from '../session';
import { CSEntity } from '../types';
import { Logger } from '../../logger';

export const CollectionItem = Symbol('codestream-item');

interface ICollectionItem<TEntity extends CSEntity> {
    // Marker as to whether or not the item has been mapped to an item: entity -> item
    [CollectionItem]: boolean;
    readonly id: string;
    readonly entity: TEntity;
}

export abstract class CodeStreamItem<TEntity extends CSEntity> extends Disposable implements ICollectionItem<TEntity> {

    [CollectionItem] = true;

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

    protected abstract entityMapper(e: TEntity): TItem;
    protected abstract fetch(): Promise<(TEntity | TItem)[]>;

    async filter(predicate: (item: TItem) => boolean) {
        return Iterables.filter(await this.items(), predicate);
    }

    async find(predicate: (item: TItem) => boolean) {
        return Iterables.find(await this.items(), predicate);
    }

    async first() {
        return Iterables.first(await this.items());
    }

    async get(key: string) {
        const collection = await this.ensureLoaded();

        const item = collection.get(key) as TItem;
        if (item === undefined) return undefined;

        return this.ensureItem(collection, key, item);
    }

    async entities(): Promise<TEntity[]> {
        return [...await this.map(i => i.entity)];
    }

    async has(key: string) {
        const collection = await this.ensureLoaded();
        return collection.has(key);
    }

    protected _collection: Promise<Map<string, TEntity | TItem>> | undefined;
    async items(): Promise<IterableIterator<TItem>> {
        const items = await this.ensureLoaded();
        return this.ensureItems(items);
    }

    async map<T>(mapper: (item: TItem) => T) {
        return Iterables.map(await this.items(), mapper);
    }

    private *ensureItems(items: Map<string, TEntity | TItem>) {
        for (const [key, value] of items) {
            yield this.ensureItem(items, key, value);
        }
    }

    protected ensureItem(items: Map<string, TEntity | TItem>, key: string, item: TEntity | TItem) {
        if (this.isItem(item)) return item;

        const mapped = this.entityMapper(item as TEntity);
        items.set(key, mapped);
        return mapped;
    }

    protected ensureLoaded() {
        if (this._collection === undefined) {
            this._collection = this.load();
        }
        return this._collection;
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

    protected isItem(item: TEntity | TItem): item is TItem {
        return (item as ICollectionItem<TEntity>)[CollectionItem];
    }

    protected async load() {
        try {
            const entities = await this.fetch();
            return new Map(entities.map<[string, TEntity | TItem]>(e => [e.id, e]));
        }
        catch (ex) {
            Logger.error(ex);
            debugger;
            throw ex;
        }
    }
}
