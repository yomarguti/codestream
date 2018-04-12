'use strict';
import { Disposable, Event, EventEmitter, extensions, Uri, workspace, WorkspaceFoldersChangeEvent } from 'vscode';
import { GitRemote, GitRepository } from './models/models';
import { CommandOptions, runCommand } from './shell';
import { GitRemoteParser } from './parsers/remoteParser';
import * as path from 'path';

interface GitApi {
    getGitPath(): Promise<string>;
    getRepositories(): Promise<GitRepository[]>;
}

export class Git extends Disposable {

    private readonly _disposable: Disposable;

    private _onDidChangeRepositories = new EventEmitter<void>();
    get onDidChangeRepositories(): Event<void> {
        return this._onDidChangeRepositories.event;
    }

    constructor() {
        super(() => this.dispose());

        this._disposable = workspace.onDidChangeWorkspaceFolders(this.onWorkspaceFoldersChanged, this);
    }

    dispose() {
        this._disposable && this._disposable.dispose();
    }

    private onWorkspaceFoldersChanged(e: WorkspaceFoldersChangeEvent) {
        this._onDidChangeRepositories.fire();
    }

    static async getFirstCommits(repo: GitRepository): Promise<string[]>;
    static async getFirstCommits(repoPath: string): Promise<string[]>;
    static async getFirstCommits(repoOrPath: GitRepository | string): Promise<string[]> {
        const path = (typeof repoOrPath === 'string') ? repoOrPath : repoOrPath.rootUri.fsPath;

        let data;
        try {
            data = await git({ cwd: path }, 'rev-list', '--max-parents=0', '--reverse', 'master');
        }
        catch (ex) {
            try {
                data = await git({ cwd: path }, 'rev-list', '--max-parents=0', '--reverse', 'HEAD');
            }
            catch (ex) {
                return [];
            }
        }

        return data.trim().split('\n');
    }

    static async getCurrentSha(uri: Uri) {
        const dir = path.dirname(uri.fsPath);
        return git({ cwd: dir }, 'log', '-n1', '--format="%h"', '--', path.relative(dir, uri.fsPath));
    }

    static async getNormalizedRemoteUrl(repo: GitRepository): Promise<string | undefined>;
    static async getNormalizedRemoteUrl(repoPath: string): Promise<string | undefined>;
    static async getNormalizedRemoteUrl(repoOrPath: GitRepository | string): Promise<string | undefined> {
        const path = (typeof repoOrPath === 'string') ? repoOrPath : repoOrPath.rootUri.fsPath;

        let data;
        try {
            data = await git({ cwd: path }, 'remote', '-v');
        }
        catch (ex) {
            return undefined;
        }

        const remotes = GitRemoteParser.parse(data, path);
        let fetch;
        let push;
        for (const r of remotes) {
            if (push !== undefined) break;

            if (r.types.find(t => t.type === 'push')) {
                push = r;
            }
            else if (fetch === undefined && r.types.find(t => t.type === 'fetch')) {
                fetch = r;
            }
        }

        const remote = push || fetch;
        if (remote === undefined) return undefined;

        return `${remote.domain}/${remote.path}`;
    }

    static async getRepositories(): Promise<GitRepository[]> {
        return Git.api!.getRepositories();
    }

    private static _api: GitApi | undefined;
    private static get api() {
        if (Git._api === undefined) {
            const git = extensions.getExtension('vscode.git');
            if (git !== undefined) {
                Git._api = git.exports;
            }
        }
        return Git._api;
    }

    private static _path: string | undefined;
    static get path(): Promise<string> | string {
        if (Git._path === undefined) {
            return Git.api!.getGitPath().then(p => Git._path = p);
        }
        return Git._path;
    }
}

// A map of running git commands -- avoids running duplicate overlaping commands
const pendingCommands: Map<string, Promise<string>> = new Map();

async function git(options: CommandOptions & { readonly correlationKey?: string }, ...args: any[]): Promise<string> {
    const start = process.hrtime();

    const { correlationKey, ...opts } = options;

    const encoding = options.encoding || 'utf8';
    const runOpts = {
        ...opts,
        encoding: encoding === 'utf8' ? 'utf8' : 'binary',
        // Adds GCM environment variables to avoid any possible credential issues -- from https://github.com/Microsoft/vscode/issues/26573#issuecomment-338686581
        // Shouldn't *really* be needed but better safe than sorry
        env: { ...(options.env || process.env), GCM_INTERACTIVE: 'NEVER', GCM_PRESERVE_CREDS: 'TRUE', LC_ALL: 'C' }
    } as CommandOptions;

    const gitCommand = `git ${args.join(' ')}`;
    const command = `(${runOpts.cwd}${correlationKey !== undefined ? correlationKey : ''}): ${gitCommand}`;

    let promise = pendingCommands.get(command);
    if (promise === undefined) {
        // Logger.log(`Running${command}`);
        // Fixes https://github.com/eamodio/vscode-gitlens/issues/73 & https://github.com/eamodio/vscode-gitlens/issues/161
        // See https://stackoverflow.com/questions/4144417/how-to-handle-asian-characters-in-file-names-in-git-on-os-x
        args.splice(0, 0, '-c', 'core.quotepath=false', '-c', 'color.ui=false');

        let path;
        if (typeof Git.path !== 'string') {
            path = await Git.path;
        }
        else {
            path = Git.path;
        }
        promise = runCommand(path, args, runOpts);

        pendingCommands.set(command, promise);
    }
    // else {
    //     Logger.log(`Awaiting${command}`);
    // }

    let data: string;
    try {
        data = await promise;
    }
    finally {
        pendingCommands.delete(command);

        // const duration = process.hrtime(start);
        // const completedIn = `in ${(duration[0] * 1000) + Math.floor(duration[1] / 1000000)} ms`;

        // Logger.log(`Completed${command} ${completedIn}`);
        // Logger.logGitCommand(`${gitCommand} ${completedIn}`, runOpts.cwd!);
    }

    if (encoding === 'utf8' || encoding === 'binary') return data;

    // return iconv.decode(Buffer.from(data, 'binary'), encoding);
    return data;
}
