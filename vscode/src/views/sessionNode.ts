'use strict';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { CodeStreamSession } from '../api/session';
import { ExplorerNode, ResourceType } from './explorerNode';
import { PeopleNode } from './peopleNode';
import { RepositoriesNode } from './repositoriesNode';

export class SessionNode extends ExplorerNode {

    constructor(
        public readonly session: CodeStreamSession
    ) {
        super();
    }

    async getChildren(): Promise<ExplorerNode[]> {
        return [
            new RepositoriesNode(this.session),
            new PeopleNode(this.session)
        ];
    }

    async getTreeItem(): Promise<TreeItem> {
        const item = new TreeItem('Session', TreeItemCollapsibleState.Expanded);
        item.contextValue = ResourceType.Session;
        return item;
    }
}