'use strict';
import { Disposable, Event, EventEmitter } from 'vscode';
import { Functions } from '../system';
import { PostsReceivedEvent } from '../api/session';
import { Container } from '../container';

// total 💩 code ahead

export interface UMIEvent {
    getCount(): number;
}

export class UMIController extends Disposable {

    private _onDidChange = new EventEmitter<UMIEvent>();
    get onDidChange(): Event<UMIEvent> {
        return this._onDidChange.event;
    }

    private _disposable: Disposable;
    private _count: number = 0;

    constructor() {
        super(() => this.dispose());

        this._disposable = Disposable.from(
            Container.session.onDidReceivePosts(this.onSessionPostsReceived, this)
        );
    }

    dispose() {
        this._disposable && this._disposable.dispose();
    }

    private _changedDebounced: ((e: UMIEvent) => void) | undefined;
    protected fireChanged(e: UMIEvent) {
        if (this._changedDebounced === undefined) {
            this._changedDebounced = Functions.debounce((e: UMIEvent) => this._onDidChange.fire(e), 250);
        }
        this._changedDebounced(e);
    }

    private onSessionPostsReceived(e: PostsReceivedEvent) {
        // 💩💩💩 need to keep track of a lot more
        this._count += e.count;
        this.fireChanged({
            getCount: () => this._count
        });
    }
}