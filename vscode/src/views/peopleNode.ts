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
        const currentUserId = this.session.userId;
        const users = [...await this.session.users.items()];

        users.sort((a, b) => ((a.id === currentUserId ? -1 : 1) - (b.id === currentUserId ? -1 : 1)) ||
            a.name.localeCompare(b.name));

        return users.map(u => new UserNode(this.session, u));
    }

    getTreeItem(): TreeItem {
        const item = new TreeItem('People', TreeItemCollapsibleState.Expanded);
        item.contextValue = ResourceType.People;
        return item;
    }
}