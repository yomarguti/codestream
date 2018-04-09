'use strict';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { CodeStreamSession, Team } from '../api/session';
import { ExplorerNode, ResourceType } from './explorerNode';
import { RepositoryNode } from './repositoryNode';
import { Container } from '../container';
import { Iterables } from '../system';

export class RepositoriesNode extends ExplorerNode {

    constructor(
        public readonly session: CodeStreamSession,
        private readonly team: Team
    ) {
        super();
    }

    get id() {
        return `repositories:${this.team.id}`;
    }

    async getChildren(): Promise<ExplorerNode[]> {
        return Array.from(this.session.getRepositories())
            .map(r => new RepositoryNode(this.session, r));
        // const repos = await this.session.getRepos(this.team.id);
        // const gitRepos = await Container.git.getRepositories();

        // return repos
        //     .filter(r => gitRepos.find(gr => gr.rootUri.toString() === r.normalizedUrl))
        //     .map(r => new RepositoryNode(this.session, r));
    }

    getTreeItem(): TreeItem {
        const item = new TreeItem('Repositories', TreeItemCollapsibleState.Expanded);
        item.contextValue = ResourceType.Repositories;
        return item;
    }
}