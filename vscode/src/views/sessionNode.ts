'use strict';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { CodeStreamSession } from '../api/session';
import { ExplorerNode, ResourceType } from './explorerNode';
import { TeamNode } from './teamNode';

export class SessionNode extends ExplorerNode {

    constructor(
        public readonly session: CodeStreamSession
    ) {
        super();
    }

    async getChildren(): Promise<ExplorerNode[]> {
        const teams = await this.session.getTeams();
        if (teams.length === 1) {
            const node = new TeamNode(this.session, teams[0]);
            return await node.getChildren();
        }

        return teams.map(t => new TeamNode(this.session, t));
    }

    async getTreeItem(): Promise<TreeItem> {
        const item = new TreeItem('Session', TreeItemCollapsibleState.Expanded);
        item.contextValue = ResourceType.Session;
        return item;
    }
}