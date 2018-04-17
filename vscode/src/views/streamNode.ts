'use strict';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { Iterables } from '../system';
import { CodeStreamSession, Stream } from '../api/session';
import { Container } from '../container';
import { ExplorerNode, ResourceType, SubscribableExplorerNode } from './explorerNode';
import { PostNode } from './postNode';

export class StreamNode extends SubscribableExplorerNode {

    constructor(
        public readonly session: CodeStreamSession,
        public readonly stream: Stream
    ) {
        super();
    }

    get id() {
        return `${this.session.id}:${ResourceType.Stream}:${this.stream.id}`;
    }

    async getChildren(): Promise<ExplorerNode[]> {
        this.subscribe();

        const posts = await this.stream.posts.items;
        return [...Iterables.map(posts, p => new PostNode(this.session, p))];
    }

    getTreeItem(): TreeItem {
        this.unsubscribe();

        const item = new TreeItem(this.stream.path, TreeItemCollapsibleState.Collapsed);
        item.contextValue = ResourceType.Stream;
        item.command = {
            title: 'Open Stream',
            command: 'codestream.openStream',
            arguments: [
                this.stream
            ]
        };
        return item;
    }

    protected subscribe() {
        this.subscriptions.push(this.stream.posts.onDidChange(this.onChanged, this));
    }

    private onChanged() {
        Container.explorer.refreshNode(this);
    }
}