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
        return `people:${this.session.id}`;
    }

    async getChildren(): Promise<ExplorerNode[]> {
        return Array.from(await this.session.users.items)
            .map(u => new UserNode(this.session, u));

        // const users = await this.session.getUsers(this.team.id);
        // return users.map(u => new UserNode(this.session, this.team, u));
    }

    getTreeItem(): TreeItem {
        const item = new TreeItem('People', TreeItemCollapsibleState.Expanded);
        item.contextValue = ResourceType.People;
        return item;
    }
}