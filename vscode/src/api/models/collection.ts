'use strict';
import { Disposable } from 'vscode';
import { Iterables } from '../../system';
import { CodeStreamSession } from '../session';
import { CSEntity } from '../types';

export const mappedSymbol = Symbol('codestream-mapped');

interface ICollectionItem {
    // Marker as to whether or not the item has been mapped: entity -> item
    [mappedSymbol]: boolean;
    readonly id: string;
}

export abstract class CodeStreamItem<TEntity extends CSEntity> extends Disposable implements ICollectionItem {

    [mappedSymbol] = true;

    constructor(
        protected readonly session: CodeStreamSession,
        protected readonly entity: TEntity
    ) {
        super(() => this.dispose());
    }

    dispose() {
    }

    get id() {
        return this.entity.id;
    }
}

export abstract class CodeStreamCollection<TItem extends ICollectionItem, TEntity extends CSEntity> extends Disposable {

    protected _disposable: Disposable | undefined;

    constructor(
        protected readonly session: CodeStreamSession
    ) {
        super(() => this.dispose());
    }

    dispose() {
        this._disposable && this._disposable.dispose();
    }

    protected abstract fetch(): Promise<(TEntity | TItem)[]>;
    protected abstract map(e: TEntity): TItem;

    private _collection: Promise<Map<string, TEntity | TItem>> | undefined;
    get items(): Promise<IterableIterator<TItem>> {
        return this.ensureLoaded().then(items => this.ensureMapped(items));
    }

    async find(predicate: (item: TItem) => boolean) {
        const items = await this.items;
        return Iterables.find(items, predicate);
    }

    async get(key: string) {
        const collection = await this.ensureLoaded();
        return collection.get(key);
    }

    async has(key: string) {
        const collection = await this.ensureLoaded();
        return collection.has(key);
    }

    protected ensureLoaded() {
        if (this._collection === undefined) {
            this._collection = this.load();
        }
        return this._collection;
    }

    private *ensureMapped(items: Map<string, TEntity | TItem>) {
        for (const [key, value] of items) {
            if ((value as ICollectionItem)[mappedSymbol]) {
                yield value as TItem;
                continue;
            }

            const mapped = this.map(value as TEntity);
            items.set(key, mapped);
            yield mapped;
        }
    }

    protected invalidate() {
        this._collection = undefined;
    }

    protected async load() {
        const entities = await this.fetch();
        return new Map(entities.map<[string, TEntity | TItem]>(e => [e.id, e]));
    }
}
