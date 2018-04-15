'use strict';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { CodeStreamSession } from '../api/session';
import { ExplorerNode, ResourceType } from './explorerNode';
import { UserNode } from './userNode';

export class PeopleNode extends ExplorerNode {

    constructor(
        public readonly session: CodeStreamSession
    ) {
        super();
    }

    get id() {
        return `${this.session.id}:${ResourceType.People}`;
    }

    async getChildren(): Promise<ExplorerNode[]> {
        return [...await this.session.users.items]
            .map(u => new UserNode(this.session, u));
    }

    getTreeItem(): TreeItem {
        const item = new TreeItem('People', TreeItemCollapsibleState.Expanded);
        item.contextValue = ResourceType.People;
        return item;
    }
}