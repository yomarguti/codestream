'use strict';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { CodeStreamSession, Post } from '../api/session';
import { ExplorerNode, ResourceType } from './explorerNode';

export class PostNode extends ExplorerNode {

    constructor(
        public readonly session: CodeStreamSession,
        public readonly post: Post
    ) {
        super();
    }

    async getChildren(): Promise<ExplorerNode[]> {
        return [];
    }

    async getTreeItem(): Promise<TreeItem> {
        let label = '';
        const user = await this.session.api.getUser(this.post.senderId, this.post.teamId);
        if (user !== undefined) {
            label = `${user.username} - ${this.post.text}`;
        }
        else {
            label = this.post.text;
        }

        const item = new TreeItem(label, TreeItemCollapsibleState.None);
        item.contextValue = this.post.hasCode ? ResourceType.PostWithCode : ResourceType.Post;
        // item.command = {
        //     title: 'Open Comment',
        //     command: 'codestream.openPostWorkingFile',
        //     arguments: [this.post]
        // } as Command;
        return item;
    }
}