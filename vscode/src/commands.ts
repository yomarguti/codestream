import { commands, Disposable, MessageItem, Uri, window } from 'vscode';
import { Post, Stream } from './api/session';
import { BuiltInCommands, openEditor } from './common';
import { TraceLevel } from './config';
import { Container } from './container';
import { Logger } from './logger';
import { PostNode } from './views/postNode';
import { StreamNode } from './views/streamNode';
import { Iterables } from './system';
import * as path from 'path';

interface CommandOptions {
    customErrorHandling?: boolean;
    showErrorMessage?: string;
}

interface Command {
    name: string;
    key: string;
    method: Function;
    options: CommandOptions;
}

const registry: Command[] = [];

function command(command: string, options: CommandOptions = {}): Function {
    return (target: any, key: string, descriptor: any) => {
        if (!(typeof descriptor.value === 'function')) throw new Error('not supported');

        let method;
        if (!options.customErrorHandling) {
            method = async function(this: any, ...args: any[]) {
                try {
                    return await descriptor.value.apply(this, args);
                }
                catch (ex) {
                    Logger.error(ex);

                    if (options.showErrorMessage) {
                        window.showErrorMessage(`${options.showErrorMessage} \u00a0\u2014\u00a0 ${ex.toString()}`);
                    }
                }
            };
        }
        else {
            method = descriptor.value;
        }

        registry.push({
            name: `codestream.${command}`,
            key: key,
            method: method,
            options: options
        });
    };
}

export class Commands extends Disposable {

    private readonly _disposable: Disposable;

    constructor() {
        super(() => this.dispose);

        this._disposable = Disposable.from(
            ...registry.map(({ name, key, method }) => commands.registerCommand(name, (...args: any[]) => method.apply(this, args)))
        );
    }

    dispose() {
        this._disposable && this._disposable.dispose();
    }

    @command('comparePostFileRevisionWithWorking', { showErrorMessage: 'Unable to open post' })
    async comparePostFileRevisionWithWorking(post?: Post | PostNode) {
        if (post instanceof PostNode) {
            post = post.post;
        }
        if (post === undefined) return;

        const block = await post.codeBlock();
        if (block === undefined) return;

        const file = await Container.git.getFileRevision(block.uri, block.hash);
        if (file === undefined) return;

        const filename = path.basename(block.uri.fsPath);

        return commands.executeCommand(BuiltInCommands.Diff,
            Uri.file(file),
            block.uri,
            `${filename} (${block.hash.substr(0, 8)}) \u00a0\u27F7\u00a0 ${filename}`,
            { selection: block.range });
    }

    @command('openPostWorkingFile', { showErrorMessage: 'Unable to open post' })
    async openPostWorkingFile(post?: Post | PostNode) {
        if (post instanceof PostNode) {
            post = post.post;
        }
        if (post === undefined) return;

        const block = await post.codeBlock();
        if (block === undefined) return;

        // TODO: Need to follow marker to current sha
        return openEditor(block.uri, { selection: block.range });
    }

    @command('openPostFileRevision', { showErrorMessage: 'Unable to open post' })
    async openPostFileRevision(post?: Post | PostNode) {
        if (post instanceof PostNode) {
            post = post.post;
        }
        if (post === undefined) return;

        const block = await post.codeBlock();
        if (block === undefined) return;

        const file = await Container.git.getFileRevision(block.uri, block.hash);
        if (file === undefined) return;

        return openEditor(Uri.file(file), { selection: block.range });
    }

    @command('openStream', { showErrorMessage: 'Unable to open stream' })
    async openStream(streamOrUriOrName?: Stream | StreamNode | Uri | string) {
        if (streamOrUriOrName === undefined) {
            streamOrUriOrName = 'general';
        }

        if (typeof streamOrUriOrName === 'string') {
            streamOrUriOrName = await Container.session.channels.getByName(streamOrUriOrName);
        }
        else if (streamOrUriOrName instanceof StreamNode) {
            streamOrUriOrName = streamOrUriOrName.stream;
        }
        else if (streamOrUriOrName instanceof Uri) {
            const repo = await Container.session.repos.getByFileUri(streamOrUriOrName);
            if (repo !== undefined) {
                streamOrUriOrName = await repo.streams.getByUri(streamOrUriOrName);
            }
            else {
                streamOrUriOrName = undefined;
            }
        }

        if (streamOrUriOrName === undefined) return;

        Container.explorer.show();
        return Container.streamWebView.openStream(streamOrUriOrName);
    }

    @command('post', { showErrorMessage: 'Unable to post message' })
    async post() {
        const message = await window.showInputBox({ prompt: 'Enter message', placeHolder: 'Message' });
        if (message === undefined) return;

        return Container.session.post(message);
    }

    @command('postCode', { showErrorMessage: 'Unable to add comment' })
    async postCode() {
        const editor = window.activeTextEditor;
        if (editor === undefined) return undefined;

        const selection = editor.selection;
        if (selection.start.isEqual(selection.end)) return undefined;

        const uri = editor.document.uri;

        const authors = await Container.git.getFileAuthors(uri, {
            startLine: selection.start.line,
            endLine: selection.end.line,
            contents: editor.document.isDirty ? editor.document.getText() : undefined
        });

        const users = await Container.session.users.getByEmails(authors.map(a => a.email));
        const mentions = Iterables.join(Iterables.map(users, u => `@${u.name}`), ', ');

        const message = await window.showInputBox({
            prompt: 'Enter Comment',
            placeHolder: 'Comment',
            value: `${mentions ? `${mentions}: ` : ''}`
        });
        if (message === undefined) return;

        const code = editor.document.getText(selection);
        const commitHash = await Container.git.getFileCurrentSha(uri);

        // Container.streamWebView._panel!._relay!.commentOnCode(uri.path, selection, code, mentions, commitHash);
        return Container.session.postCode(message, uri, code, selection, commitHash);
    }

    @command('signIn', { customErrorHandling: true })
    signIn() {
        return this.signInCore(Container.config.username, Container.config.password, Container.config.teamId);
    }

    @command('signOut')
    signOut() {
        return Container.session.logout();
    }

    private async signInCore(username: string, password: string, teamId?: string) {
        try {
            return await Container.session.login(username, password, teamId);
        }
        catch (ex) {
            const actions: MessageItem[] = [
                { title: 'Retry' }
            ];

            const tracing = Container.config.traceLevel !== TraceLevel.Silent;
            if (tracing) {
                actions.push({ title: 'Open Output Channel' });
            }

            const result = await window.showErrorMessage(`Unable to sign into CodeStream${!tracing ? '' : '\nSee the CodeStream output channel for more details'}`, ...actions);
            if (result === undefined) throw ex;

            if (result === actions[0]) {
                setImmediate(() => this.signInCore(username, password));
            }
            else if (result === actions[1]) {
                Logger.showOutputChannel();
            }
        }
    }
}
