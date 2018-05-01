'use strict';
import { Disposable, StatusBarAlignment, StatusBarItem, window } from 'vscode';
import { SessionStatus, SessionStatusChangedEvent } from '../api/session';
import { Container } from '../container';
import { UnreadCountChangedEvent } from './notificationsController';

export class StatusBarController extends Disposable {

    private _disposable: Disposable;
    private _statusBarItem: StatusBarItem | undefined;

    constructor() {
        super(() => this.dispose());

        this._disposable = Disposable.from(
            Container.session.onDidChangeStatus(this.onSessionStatusChanged, this),
            Container.notifications.onDidChangeUnreadCount(this.onUnreadCountChanged, this)
        );

        this.updateStatusBar(Container.session.status);
    }

    dispose() {
        this.clear();

        this._statusBarItem && this._statusBarItem.dispose();

        this._disposable && this._disposable.dispose();
    }

    private onUnreadCountChanged(e: UnreadCountChangedEvent) {
        this.updateStatusBar(Container.session.status, e.getCount());
    }

    private onSessionStatusChanged(e: SessionStatusChangedEvent) {
        this.updateStatusBar(e.getStatus());
    }

    async clear() {
        if (this._statusBarItem !== undefined) {
            this._statusBarItem.hide();
        }
    }

    private updateStatusBar(status: SessionStatus, count: number = 0) {
        if (this._statusBarItem === undefined) {
            this._statusBarItem = this._statusBarItem || window.createStatusBarItem(StatusBarAlignment.Right, -99);
        }

        switch (status) {
            case SessionStatus.SignedOut:
                this._statusBarItem.text = ` $(comment-discussion) Sign in... `;
                this._statusBarItem.command = 'codestream.signIn';
                this._statusBarItem.tooltip = 'Sign in to CodeStream...';
                this._statusBarItem.color = undefined;
                break;
            case SessionStatus.SigningIn:
                this._statusBarItem.text = ` $(comment-discussion) Signing in... `;
                this._statusBarItem.command = undefined;
                this._statusBarItem.tooltip = 'Signing in to CodeStream, please wait';
                this._statusBarItem.color = undefined;
                break;
            case SessionStatus.SignedIn:
                this._statusBarItem.text = ` $(comment-discussion) ${count === 0 ? Container.session.user.name : count} `;
                this._statusBarItem.command = 'codestream.show';
                this._statusBarItem.tooltip = 'Show CodeStream';
                this._statusBarItem.color = count === 0 ? undefined : '#009aef';
                break;
        }

        this._statusBarItem.show();
    }
}