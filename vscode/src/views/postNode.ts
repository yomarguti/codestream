"use strict";
import { TreeItem, TreeItemCollapsibleState } from "vscode";
import { CodeStreamSession, Post } from "../api/session";
import { ContextValue, ExplorerNode } from "./explorerNode";

export class PostNode extends ExplorerNode {
	constructor(public readonly session: CodeStreamSession, public readonly post: Post) {
		super();
	}

	async getChildren(): Promise<ExplorerNode[]> {
		return [];
	}

	async getTreeItem(): Promise<TreeItem> {
		let label = "";

		const user = await this.session.users.get(this.post.senderId);
		if (user !== undefined) {
			label = `${user.name} - ${this.post.text}`;
		} else {
			label = this.post.text;
		}

		const item = new TreeItem(label, TreeItemCollapsibleState.None);
		item.contextValue = this.post.hasCode ? ContextValue.PostWithCode : ContextValue.Post;
		// item.command = {
		//     title: 'Open Comment',
		//     command: 'codestream.openPostWorkingFile',
		//     arguments: [this.post]
		// } as Command;
		return item;
	}
}
