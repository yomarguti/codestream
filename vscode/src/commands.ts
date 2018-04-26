import { commands, Disposable, MessageItem, Range, TextDocument, Uri, window } from 'vscode';
import { Post, Stream } from './api/session';
import { openEditor } from './common';
import { TraceLevel } from './config';
import { Container } from './container';
import { ExtensionId } from './extension';
import { Logger } from './logger';
import { PostNode } from './views/postNode';
import { StreamNode } from './views/streamNode';
import { Iterables } from './system';
import * as path from 'path';

export enum BuiltInCommands {
    CloseActiveEditor = 'workbench.action.closeActiveEditor',
    CloseAllEditors = 'workbench.action.closeAllEditors',
    CursorMove = 'cursorMove',
    Diff = 'vscode.diff',
    EditorScroll = 'editorScroll',
    ExecuteDocumentSymbolProvider = 'vscode.executeDocumentSymbolProvider',
    ExecuteCodeLensProvider = 'vscode.executeCodeLensProvider',
    Open = 'vscode.open',
    NextEditor = 'workbench.action.nextEditor',
    PreviewHtml = 'vscode.previewHtml',
    RevealLine = 'revealLine',
    SetContext = 'setContext',
    ShowReferences = 'editor.action.showReferences'
}

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
            name: `${ExtensionId}.${command}`,
            key: key,
            method: method,
            options: options
        });
    };
}

export interface OpenStreamCommandArgs {
    stream?: Stream | StreamNode;
    searchBy?: Uri | string | string[];
    autoCreate: boolean;
}

export interface PostCodeCommandArgs {
    document?: TextDocument;
    range?: Range;
    streamName?: string;
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
    async openStream(args: OpenStreamCommandArgs) {
        let stream;
        if (args !== undefined) {
            if (args.stream !== undefined) {
                stream = args.stream instanceof StreamNode ? args.stream.stream : args.stream;
            }
            else if (args.searchBy !== undefined) {
                if (typeof args.searchBy === 'string') {
                    if (args.autoCreate) throw new Error(`Auto-create isn't supported on Channels`);

                    stream = await Container.session.channels.getByName(args.searchBy);
                }
                else if (args.searchBy instanceof Uri) {
                    const repo = await Container.session.repos.getByFileUri(args.searchBy);
                    if (repo !== undefined) {
                        if (args.autoCreate) {
                            stream = await repo.streams.getOrCreateByUri(args.searchBy);
                        }
                        else {
                            stream = await repo.streams.getByUri(args.searchBy);
                        }
                    }
                    else {
                        stream = undefined;
                    }
                }
                else {
                    if (args.autoCreate) {
                        stream = await Container.session.directMessages.getOrCreateByMembers(args.searchBy);
                    }
                    else {
                        stream = await Container.session.directMessages.getByMembers(args.searchBy);
                    }
                }
            }
        }

        if (stream === undefined) return;

        // TODO: Switch to codestream view?
        Container.explorer.show();
        return Container.streamView.openStream(stream);
    }

    @command('post', { showErrorMessage: 'Unable to post message' })
    async post() {
        const message = await window.showInputBox({ prompt: 'Enter message', placeHolder: 'Message' });
        if (message === undefined) return;

        return Container.session.post(message);
    }

    @command('postCode', { showErrorMessage: 'Unable to add comment' })
    async postCode(args: PostCodeCommandArgs) {
        let document;
        let selection;
        if (args.document === undefined || args.range === undefined) {
            const editor = window.activeTextEditor;
            if (editor === undefined) return undefined;

            document = editor.document;
            selection = editor.selection;
            if (selection.start.isEqual(selection.end)) return undefined;
        }
        else {
            ({ document, range: selection } = args);
        }

        if (document === undefined || selection === undefined) return undefined;

        const uri = document.uri;

        const repo = await Container.session.repos.getByFileUri(uri);
        if (repo === undefined) throw new Error(`No repository could be found for Uri(${uri.toString()}`);

        const stream = args.streamName === undefined
            ? await Container.session.getDefaultTeamChannel()
            : await Container.session.channels.getOrCreateByName(args.streamName);

        const authors = await Container.git.getFileAuthors(uri, {
            startLine: selection.start.line,
            endLine: selection.end.line,
            contents: document.isDirty ? document.getText() : undefined
        });

        const users = await Container.session.users.getByEmails(authors.map(a => a.email));
        const mentions = Iterables.join(Iterables.map(users, u => `@${u.name}`), ', ');

        const code = document.getText(selection);
        const commitHash = await Container.git.getFileCurrentSha(document.uri);

        return Container.streamView.postCode(stream, repo, repo.relativizeUri(uri), code, selection, commitHash!, mentions);
    }

    @command('show')
    show() {
        return commands.executeCommand('workbench.view.extension.codestream');
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
