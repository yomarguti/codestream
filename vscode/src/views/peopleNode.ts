'use strict';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { CodeStreamSession, Team } from '../api/session';
import { ExplorerNode, ResourceType } from './explorerNode';
import { UserNode } from './userNode';

export class PeopleNode extends ExplorerNode {

    constructor(
        public readonly session: CodeStreamSession,
        private readonly team: Team
    ) {
        super();
    }

    get id() {
        return `people:${this.team.id}`;
    }

    async getChildren(): Promise<ExplorerNode[]> {
        const users = await this.session.getUsers(this.team.id);
        return users.map(u => new UserNode(this.session, this.team, u));
    }

    getTreeItem(): TreeItem {
        const item = new TreeItem('People', TreeItemCollapsibleState.Expanded);
        item.contextValue = ResourceType.People;
        return item;
    }
}