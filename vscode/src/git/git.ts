'use strict';
import { Disposable, Event, EventEmitter, extensions, Uri, workspace, WorkspaceFoldersChangeEvent } from 'vscode';
import { Strings } from '../system';
import { Logger } from '../logger';
import { GitAuthor, GitRemote, GitRepository } from './models/models';
import { CommandOptions, runCommand } from './shell';
import { GitAuthorParser } from './parsers/authorParser';
import { GitRemoteParser } from './parsers/remoteParser';

export * from './models/models';

const uncommittedRegex = /^[0]{40}(\^[0-9]*?)??:??$/;

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

    async getFileAuthors(uri: Uri, options?: { contents?: string, startLine?: number, endLine?: number }): Promise<GitAuthor[]>;
    async getFileAuthors(path: string, options?: { contents?: string, startLine?: number, endLine?: number }): Promise<GitAuthor[]>;
    async getFileAuthors(uriOrPath: Uri | string, options: { contents?: string, startLine?: number, endLine?: number } = {}): Promise<GitAuthor[]> {
        const [dir, filename] = Strings.splitPath((typeof uriOrPath === 'string') ? uriOrPath : uriOrPath.fsPath);

        const params = ['blame', '--root', '--incremental', '-w'];

        if (options.startLine != null && options.endLine != null) {
            params.push(`-L ${options.startLine + 1},${options.endLine + 1}`);
        }

        let stdin;
        if (options.contents) {
            params.push('--contents', '-');
            // Pipe the blame contents to stdin
            stdin = options.contents;
        }

        const data = await git({ cwd: dir, stdin: stdin }, ...params, '--', filename);
        return GitAuthorParser.parse(data);
    }

    async getFileCurrentSha(uri: Uri): Promise<string>;
    async getFileCurrentSha(path: string): Promise<string>;
    async getFileCurrentSha(uriOrPath: Uri | string): Promise<string> {
        const [dir, filename] = Strings.splitPath((typeof uriOrPath === 'string') ? uriOrPath : uriOrPath.fsPath);

        const data = await git({ cwd: dir }, 'log', '-n1', '--format=%H', '--', filename);
        return data.trim();
    }

    async getRepoFirstCommits(repoUri: Uri): Promise<string[]>;
    async getRepoFirstCommits(repoPath: string): Promise<string[]>;
    async getRepoFirstCommits(repoUriOrPath: Uri | string): Promise<string[]> {
        const repoPath = (typeof repoUriOrPath === 'string') ? repoUriOrPath : repoUriOrPath.fsPath;

        let data;
        try {
            data = await git({ cwd: repoPath }, 'rev-list', '--max-parents=0', '--reverse', 'master');
        }
        catch (ex) {
            try {
                data = await git({ cwd: repoPath }, 'rev-list', '--max-parents=0', '--reverse', 'HEAD');
            }
            catch (ex) {
                return [];
            }
        }

        return data.trim().split('\n');
    }

    async getRepoRemote(repoUri: Uri): Promise<GitRemote | undefined>;
    async getRepoRemote(repoPath: string): Promise<GitRemote | undefined>;
    async getRepoRemote(repoUriOrPath: Uri | string): Promise<GitRemote | undefined> {
        const repoPath = (typeof repoUriOrPath === 'string') ? repoUriOrPath : repoUriOrPath.fsPath;

        let data;
        try {
            data = await git({ cwd: repoPath }, 'remote', '-v');
        }
        catch (ex) {
            return undefined;
        }

        const remotes = GitRemoteParser.parse(data, repoPath);
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

        return push || fetch;
    }

    async getRepositories(): Promise<GitRepository[]> {
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

    static isUncommitted(sha: string) {
        return uncommittedRegex.test(sha);
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
        Logger.log(`Running${command}`);
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
    else {
        Logger.log(`Awaiting${command}`);
    }

    let data: string;
    try {
        data = await promise;
    }
    finally {
        pendingCommands.delete(command);

        const duration = process.hrtime(start);
        const completedIn = `in ${(duration[0] * 1000) + Math.floor(duration[1] / 1000000)} ms`;

        Logger.log(`Completed${command} ${completedIn}`);
        Logger.logGitCommand(`${gitCommand} ${completedIn}`, runOpts.cwd!);
    }

    if (encoding === 'utf8' || encoding === 'binary') return data;

    // return iconv.decode(Buffer.from(data, 'binary'), encoding);
    return data;
}
