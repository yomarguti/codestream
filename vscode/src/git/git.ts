'use strict';
import { Disposable, Event, EventEmitter, extensions, Uri, workspace, WorkspaceFoldersChangeEvent } from 'vscode';
import { Strings } from '../system';
import { Logger } from '../logger';
import { GitAuthor, GitRemote, GitRepository } from './models/models';
import { CommandOptions, runCommand } from './shell';
import { GitAuthorParser } from './parsers/authorParser';
import { GitRemoteParser } from './parsers/remoteParser';
import * as fs from 'fs';
import * as path from 'path';

export * from './models/models';

interface GitApi {
    getGitPath(): Promise<string>;
    getRepositories(): Promise<GitApiRepository[]>;
}

export interface GitApiRepository {
    readonly rootUri: Uri;
    // readonly inputBox: InputBox;
}

const GitWarnings = {
    notARepository: /Not a git repository/,
    outsideRepository: /is outside repository/,
    noPath: /no such path/,
    noCommits: /does not have any commits/,
    notFound: /Path \'.*?\' does not exist in/,
    foundButNotInRevision: /Path \'.*?\' exists on disk, but not in/,
    headNotABranch: /HEAD does not point to a branch/,
    noUpstream: /no upstream configured for branch \'(.*?)\'/,
    unknownRevision: /ambiguous argument \'.*?\': unknown revision or path not in the working tree/
};

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
        this._repositories = undefined;
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

    async getFileRevision(uri: Uri, ref: string): Promise<string | undefined>;
    async getFileRevision(path: string, ref: string): Promise<string | undefined>;
    async getFileRevision(uriOrPath: Uri | string, ref: string): Promise<string | undefined> {
        const [dir, filename] = Strings.splitPath((typeof uriOrPath === 'string') ? uriOrPath : uriOrPath.fsPath);

        let data: string | undefined;
        try {
            data = await git({ cwd: dir, encoding: 'binary' }, 'show', `${ref}:./${filename}`);
        }
        catch (ex) {
            const msg = ex && ex.toString();
            if (!GitWarnings.notFound.test(msg) && GitWarnings.foundButNotInRevision.test(msg)) throw ex;
        }

        if (!data) return undefined;

        const suffix = Strings.sanitizeForFileSystem(ref.substr(0, 8)).substr(0, 50);
        const ext = path.extname(filename);

        const tmp = await import('tmp');
        return new Promise<string>((resolve, reject) => {
            tmp.file({ prefix: `${path.basename(filename, ext)}-${suffix}__`, postfix: ext },
                (err, destination, fd, cleanupCallback) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    Logger.log(`getFileRevision[${destination}]('${dir}', '${filename}', ${ref})`);
                    fs.appendFile(destination, data, { encoding: 'binary' }, err => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        const ReadOnly = 0o100444; // 33060 0b1000000100100100
                        fs.chmod(destination, ReadOnly, err => {
                            resolve(destination);
                        });
                    });
                });
        });
    }

    async getRepoFirstCommits(repoUri: Uri): Promise<string[]>;
    async getRepoFirstCommits(repoPath: string): Promise<string[]>;
    async getRepoFirstCommits(repoUriOrPath: Uri | string): Promise<string[]> {
        const repoPath = (typeof repoUriOrPath === 'string') ? repoUriOrPath : repoUriOrPath.fsPath;

        let data;
        try {
            data = await git({ cwd: repoPath }, 'rev-list', '--max-parents=0', '--reverse', 'master');
        }
        catch { }

        if (!data) {
            try {
                data = await git({ cwd: repoPath }, 'rev-list', '--max-parents=0', '--reverse', 'HEAD');
            }
            catch { }
        }

        if (!data) return [];

        return data.trim().split('\n');
    }

    async getRepoRemote(repoUri: Uri): Promise<GitRemote | undefined>;
    async getRepoRemote(repoPath: string): Promise<GitRemote | undefined>;
    async getRepoRemote(repoUriOrPath: Uri | string): Promise<GitRemote | undefined> {
        const repoPath = (typeof repoUriOrPath === 'string') ? repoUriOrPath : repoUriOrPath.fsPath;

        let data;
        try {
            data = await git({ cwd: repoPath }, 'remote', '-v');
            if (!data) return undefined;
        }
        catch {
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

    private _repositories: GitRepository[] | undefined;
    async getRepositories(): Promise<GitRepository[]> {
        if (this._repositories === undefined) {
            const repos = await Git.api!.getRepositories();
            this._repositories = repos.map(r => new GitRepository(r.rootUri));
        }
        return this._repositories;
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
    catch (ex) {
        const msg = ex && ex.toString();
        if (msg) {
            for (const warning of Object.values(GitWarnings)) {
                if (warning.test(msg)) {
                    Logger.warn('git', ...args, `  cwd='${options.cwd}'\n\n  `, msg.replace(/\r?\n|\r/g, ' '));
                    return '';
                }
            }
        }

        Logger.error(ex, 'git', ...args, `  cwd='${options.cwd}'\n\n  `);
        throw ex;
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
