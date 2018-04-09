'use strict';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { CodeStreamSession, Team, User } from '../api/session';
import { ExplorerNode, ResourceType } from './explorerNode';

export class UserNode extends ExplorerNode {

    constructor(
        public readonly session: CodeStreamSession,
        private readonly team: Team,
        private readonly user: User
    ) {
        super();
    }

    get id() {
        return `${this.team.id}${this.user.id}`;
    }

    async getChildren(): Promise<ExplorerNode[]> {
        return [];
    }

    getTreeItem(): TreeItem {
        const item = new TreeItem(this.user.username, TreeItemCollapsibleState.None);
        item.id = this.id;
        item.contextValue = ResourceType.User;
        return item;
    }
}