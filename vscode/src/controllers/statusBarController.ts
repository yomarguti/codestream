"use strict";
import { Disposable, StatusBarAlignment, StatusBarItem, window } from "vscode";
import {
	CodeStreamEnvironment,
	SessionStatus,
	SessionStatusChangedEvent,
	UnreadsChangedEvent
} from "../api/session";
import { Container } from "../container";

export class StatusBarController implements Disposable {
	private _disposable: Disposable;
	private _statusBarItem: StatusBarItem | undefined;

	constructor() {
		this._disposable = Disposable.from(
			Container.session.onDidChangeSessionStatus(this.onSessionStatusChanged, this),
			Container.session.onDidChangeUnreads(this.onUnreadsChanged, this)
		);

		this.updateStatusBar(Container.session.status);
	}

	dispose() {
		this.clear();

		this._statusBarItem && this._statusBarItem.dispose();

		this._disposable && this._disposable.dispose();
	}

	private onUnreadsChanged(e: UnreadsChangedEvent) {
		this.updateStatusBar(Container.session.status, e.getMentionCount(), e.getUnreadCount());
	}

	private onSessionStatusChanged(e: SessionStatusChangedEvent) {
		this.updateStatusBar(e.getStatus());
	}

	async clear() {
		if (this._statusBarItem !== undefined) {
			this._statusBarItem.hide();
		}
	}

	private async updateStatusBar(
		status: SessionStatus,
		mentionCount: number = 0,
		unreadCount: number = 0
	) {
		if (this._statusBarItem === undefined) {
			this._statusBarItem =
				this._statusBarItem || window.createStatusBarItem(StatusBarAlignment.Right, -99);
		}

		let env = "";
		switch (Container.session.environment) {
			case CodeStreamEnvironment.PD:
				env = "PD: ";
				break;
			case CodeStreamEnvironment.QA:
				env = "QA: ";
				break;
		}

		switch (status) {
			case SessionStatus.SignedOut:
				this._statusBarItem.text = ` $(comment-discussion) ${env}Sign in... `;
				this._statusBarItem.command = "codestream.signIn";
				this._statusBarItem.tooltip = "Sign in to CodeStream...";
				this._statusBarItem.color = undefined;
				break;

			case SessionStatus.SigningIn:
				this._statusBarItem.text = ` $(comment-discussion) ${env}Signing in... `;
				this._statusBarItem.command = undefined;
				this._statusBarItem.tooltip = "Signing in to CodeStream, please wait";
				this._statusBarItem.color = undefined;
				break;

			case SessionStatus.SignedIn:
				let label = Container.session.user.name;
				let tooltip = "Toggle CodeStream";
				if (!(await Container.session.hasSingleTeam())) {
					label += ` - ${Container.session.team.name}`;
				}
				if (mentionCount > 0) {
					label += ` (${mentionCount})`;
					tooltip += `\n${mentionCount} unread mention${mentionCount === 1 ? "" : "s"}`;
				} else if (unreadCount > 0) {
					label += ` \u00a0\u2022`;
				}

				const unreadsOnly = unreadCount - mentionCount;
				if (unreadsOnly > 0) {
					tooltip += `\n${unreadsOnly} unread message${unreadsOnly === 1 ? "" : "s"}`;
				}

				this._statusBarItem.text = ` $(comment-discussion) ${env}${label} `;
				this._statusBarItem.command = "codestream.toggle";
				this._statusBarItem.tooltip = tooltip;
				break;
		}

		this._statusBarItem.show();
	}
}
