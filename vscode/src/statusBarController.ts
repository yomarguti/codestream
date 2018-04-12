'use strict';
import { ConfigurationChangeEvent, Disposable, StatusBarAlignment, StatusBarItem, TextEditor, window } from 'vscode';
import { SessionStatus, SessionStatusChangedEvent } from './api/session';
import { configuration } from './configuration';
import { Container } from './container';

export class StatusBarController extends Disposable {

    private _disposable: Disposable;
    private _statusBarItem: StatusBarItem | undefined;

    constructor() {
        super(() => this.dispose());

        this._disposable = Disposable.from(
            Container.session.onDidChangeStatus(this.onSessionStatusChanged, this)
        );

        this.updateStatusBar(Container.session.status);
    }

    dispose() {
        this.clear();

        this._statusBarItem && this._statusBarItem.dispose();

        this._disposable && this._disposable.dispose();
    }

    private onSessionStatusChanged(e: SessionStatusChangedEvent) {
        this.updateStatusBar(e.getStatus());
    }

    async clear() {
        if (this._statusBarItem !== undefined) {
            this._statusBarItem.hide();
        }
    }

    private updateStatusBar(status: SessionStatus) {
        if (this._statusBarItem === undefined) {
            this._statusBarItem = this._statusBarItem || window.createStatusBarItem(StatusBarAlignment.Right, 1000);
        }

        switch (status) {
            case SessionStatus.SignedOut:
                this._statusBarItem.text = ` $(comment-discussion) Sign in... `;
                this._statusBarItem.command = 'codestream.login';
                this._statusBarItem.tooltip = 'Sign in to CodeStream...';
                break;
            case SessionStatus.SigningIn:
                this._statusBarItem.text = ` $(comment-discussion) Signing in... `;
                this._statusBarItem.command = undefined;
                this._statusBarItem.tooltip = 'Signing in to CodeStream, please wait';
                break;
            case SessionStatus.SignedIn:
                this._statusBarItem.text = ` $(comment-discussion) `;
                this._statusBarItem.command = 'codestream.openStream';
                this._statusBarItem.tooltip = 'Open CodeStream';
                break;
        }

        this._statusBarItem.show();
    }
}