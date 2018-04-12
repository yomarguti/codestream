'use strict';
import { TreeItem, TreeItemCollapsibleState, Uri } from 'vscode';
import { CodeStreamSession, CodeStreamStream } from '../api/session';
import { ExplorerNode, ResourceType } from './explorerNode';

export class StreamNode extends ExplorerNode {

    constructor(
        public readonly session: CodeStreamSession,
        private readonly stream: CodeStreamStream
    ) {
        super();
    }

    async getChildren(): Promise<ExplorerNode[]> {
        return [];
        // const posts = await this.session.getPosts(this.stream);
        // return posts.map(p => new PostNode(this.session, p));
    }

    getTreeItem(): TreeItem {
        const item = new TreeItem(this.stream.url, TreeItemCollapsibleState.None);
        item.contextValue = ResourceType.Stream;
        // item.command =
        // item.resourceUri = Uri.file('C:\\Users\\Eric\\code\\eamodio.github.io\\index.html'); // this.stream.file);
        return item;
    }
}