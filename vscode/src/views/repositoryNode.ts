'use strict';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { Iterables } from '../system';
import { CodeStreamSession, Repository } from '../api/session';
import { Container } from '../container';
import { ExplorerNode, ResourceType, SubscribableExplorerNode } from './explorerNode';
import { StreamNode } from './streamNode';

export class RepositoryNode extends SubscribableExplorerNode {

    constructor(
        public readonly session: CodeStreamSession,
        public readonly repository: Repository
    ) {
        super();
    }

    get id() {
        return `${this.session.id}:${ResourceType.Repository}:${this.repository.id}`;
    }

    async getChildren(): Promise<ExplorerNode[]> {
        this.subscribe();

        const streams = await this.repository.streams.items;
        return [...Iterables.map(streams, s => new StreamNode(this.session, s))];
    }

    async getTreeItem(): Promise<TreeItem> {
        this.unsubscribe();

        const item = new TreeItem(this.repository.url, TreeItemCollapsibleState.Collapsed);
        item.contextValue = ResourceType.Repository;
        // item.command = {
        //     title: 'Open Stream',
        //     command: 'codestream.openStream',
        //     arguments: [
        //         Iterables.first(await this.repository.streams.items)
        //     ]
        // };
        return item;
    }

    protected subscribe() {
        this.subscriptions.push(this.repository.streams.onDidChange(this.onChanged, this));
    }

    private onChanged() {
        Container.explorer.refreshNode(this);
    }
}