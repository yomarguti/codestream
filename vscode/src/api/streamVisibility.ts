'use strict';
import { Container } from '../container';

export class StreamVisibilityManager {

    private readonly _hiddenStreams: Set<string>;

    constructor(public userId: string) {
        this._hiddenStreams = new Set(Container.context.globalState.get<string[]>(`user:${Container.session.userId}:streams:hidden`) || []);
    }

    clear() {
        this._hiddenStreams.clear();
        return this.save();
    }

    hide(streamId: string) {
        if (this._hiddenStreams.has(streamId)) return;

        this._hiddenStreams.add(streamId);
        return this.save();
    }

    isHidden(streamId: string) {
        return this._hiddenStreams.has(streamId);
    }

    show(streamId: string) {
        if (!this._hiddenStreams.has(streamId)) return;

        this._hiddenStreams.delete(streamId);
        return this.save();
    }

    private save() {
        return Container.context.globalState.update(`user:${this.userId}:streams:hidden`, [...this._hiddenStreams.values()]);
    }
}