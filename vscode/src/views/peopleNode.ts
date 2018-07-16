"use strict";
import { TreeItem, TreeItemCollapsibleState } from "vscode";
import { CodeStreamSession } from "../api/session";
import { Iterables } from "../system";
import { ContextValue, ExplorerNode } from "./explorerNode";
import { StreamNode } from "./streamNode";
import { UserNode } from "./userNode";

export class PeopleNode extends ExplorerNode {
	constructor(public readonly session: CodeStreamSession) {
		super();
	}

	get id() {
		return `${this.session.id}:${ContextValue.People}`;
	}

	async getChildren(): Promise<ExplorerNode[]> {
		const currentUserId = this.session.userId;
		const users = [...(await this.session.users.items())];

		users.sort(
			(a, b) =>
				(a.id === currentUserId ? -1 : 1) - (b.id === currentUserId ? -1 : 1) ||
				(a.name || "").localeCompare(b.name || "")
		);

		const children: (StreamNode | UserNode)[] = users.map(u => new UserNode(this.session, u));
		// Add any group DMs to the "people" list
		const groups = await this.session.directMessages.filter(
			dm => !dm.hidden && dm.memberIds.length > 2
		);
		children.push(...Iterables.map(groups, dm => new StreamNode(this.session, dm)));

		return children;
	}

	getTreeItem(): TreeItem {
		const item = new TreeItem("People", TreeItemCollapsibleState.Expanded);
		item.contextValue = ContextValue.People;
		return item;
	}
}
