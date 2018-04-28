'use strict';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
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

        return [...await this.repository.streams.map(s => new StreamNode(this.session, s))];
    }

    async getTreeItem(): Promise<TreeItem> {
        this.unsubscribe();

        const item = new TreeItem(this.repository.name, TreeItemCollapsibleState.Collapsed);
        item.contextValue = ResourceType.Repository;

        item.iconPath = {
            dark: Container.context.asAbsolutePath(`assets/images/dark/repository.svg`),
            light: Container.context.asAbsolutePath(`assets/images/light/repository.svg`)
        };

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
        Container.repositoriesExplorer.refreshNode(this);
    }
}