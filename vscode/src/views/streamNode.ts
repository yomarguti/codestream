'use strict';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { Iterables } from '../system';
import { CodeStreamSession, Stream } from '../api/session';
import { ExplorerNode, ResourceType } from './explorerNode';
import { PostNode } from './postNode';

export class StreamNode extends ExplorerNode {

    constructor(
        public readonly session: CodeStreamSession,
        private readonly stream: Stream
    ) {
        super();
    }

    async getChildren(): Promise<ExplorerNode[]> {
        const posts = await this.stream.posts.items;
        return Array.from(Iterables.map(posts, p => new PostNode(this.session, p)));
    }

    getTreeItem(): TreeItem {
        const item = new TreeItem(this.stream.path, TreeItemCollapsibleState.Collapsed);
        item.contextValue = ResourceType.Stream;
        // item.command =
        // item.resourceUri = Uri.file('C:\\Users\\Eric\\code\\eamodio.github.io\\index.html'); // this.stream.file);
        return item;
    }
}