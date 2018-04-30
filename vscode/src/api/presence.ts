'use strict';
import { Disposable, Event, EventEmitter  } from 'vscode';
import { PresenceStatus } from './api';
import { CodeStreamSessionApi } from './sessionApi';

export class PresenceManager extends Disposable {

    private _onDidChange = new EventEmitter<PresenceStatus>();
    get onDidChange(): Event<PresenceStatus> {
        return this._onDidChange.event;
    }

    private _disposable: Disposable | undefined;
    private _status: PresenceStatus = PresenceStatus.Away;
    private _timeout: number | undefined;
    private _timer: NodeJS.Timer | undefined;
    private _timestamp: number | undefined;

    constructor(
        private readonly sessionApi: CodeStreamSessionApi,
        private readonly sessionId: string
    ) {
        super(() => this.dispose());
    }

    dispose() {
        if (this._timer !== undefined) {
            clearTimeout(this._timer);
            this._timer = undefined;
        }

        this._disposable && this._disposable.dispose();
    }

    get status() {
        return this._status;
    }

    async away() {
        await this.update(PresenceStatus.Away);
    }

    async online() {
        await this.update(PresenceStatus.Online);
    }

    private _promise: Promise<number> | undefined;
    private _promiseStatus: PresenceStatus | undefined;

    private async update(status: PresenceStatus) {
        const changed = this._status !== status;
        if (!changed && this._timestamp !== undefined && this._timeout !== undefined) {
            const ms = new Date().getTime() - this._timestamp;
            if (ms < Math.floor(this._timeout * 9 / 10)) return;
        }

        if (this._promise !== undefined && this._promiseStatus === status) return;

        this._promise = this.sessionApi.updatePresence(status, this.sessionId);
        this._promiseStatus = status;

        this._timeout = await this._promise;
        this._promise = undefined;
        this._promiseStatus = undefined;

        this._timestamp = new Date().getTime();
        this._status = status;

        if (this._timer !== undefined) {
            clearTimeout(this._timer);
            this._timer = undefined;
        }

        // if we are online, let the server know before the away timeout can expire
        // (so use 90% of the away timeout) ... if we stop sending these updates, the
        // server will mark our status as "stale" and consider the session no longer online
        if (this.status === PresenceStatus.Online) {
            this._timer = setTimeout(() => this.update(PresenceStatus.Online), Math.floor(this._timeout * 9 / 10));
        }

        if (!changed) return;

        this._onDidChange.fire(status);
    }
}
