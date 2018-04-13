'use strict';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { Iterables } from '../system';
import { CodeStreamSession, Stream } from '../api/session';
import { ExplorerNode, ResourceType } from './explorerNode';
import { PostNode } from './postNode';
import { Container } from '../container';

export class StreamNode extends ExplorerNode {

    constructor(
        public readonly session: CodeStreamSession,
        private readonly stream: Stream
    ) {
        super();
    }

    async getChildren(): Promise<ExplorerNode[]> {
        this.subscribe();
        const posts = await this.stream.posts.items;
        return Array.from(Iterables.map(posts, p => new PostNode(this.session, p)));
    }

    getTreeItem(): TreeItem {
        this.unsubscribe();

        const item = new TreeItem(this.stream.path, TreeItemCollapsibleState.Collapsed);
        item.contextValue = ResourceType.Stream;
        // item.command =
        // item.resourceUri = Uri.file('C:\\Users\\Eric\\code\\eamodio.github.io\\index.html'); // this.stream.file);
        return item;
    }

    private subscribe() {
        this.subscriptions.push(this.stream.posts.onDidChange(this.onChanged, this));
    }

    private onChanged() {
        Container.explorer.refreshNode(this);
    }
}