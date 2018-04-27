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

interface IStreamLocator {
    stream?: Stream | StreamNode;
    searchBy?: Uri | string | string[];
    parentPostId?: string;
    autoCreate?: boolean;
}

export interface OpenStreamCommandArgs extends IStreamLocator {
}

export interface PostCommandArgs extends IStreamLocator {
    text?: string;
    send?: boolean;
}

export interface PostCodeCommandArgs extends IStreamLocator {
    document?: TextDocument;
    range?: Range;
    text?: string;
    send?: boolean;
}

const commandRegistry: Command[] = [];

export class Commands extends Disposable {

    private readonly _disposable: Disposable;

    constructor() {
        super(() => this.dispose);

        this._disposable = Disposable.from(
            ...commandRegistry.map(({ name, key, method }) => commands.registerCommand(name, (...args: any[]) => method.apply(this, args)))
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
        const stream = await this.findStream(args, { includeActive: true, includeDefault: true });
        if (stream === undefined) return;

        return Container.streamView.openStream(stream);
    }

    @command('post', { showErrorMessage: 'Unable to post message' })
    async post(args: PostCommandArgs) {
        const stream = await this.findStream(args, { includeActive: true, includeDefault: !args.send });
        if (stream === undefined) throw new Error(`No stream could be found`);

        if (args.send && args.text) {
            await Container.streamView.openStream(stream);
            return stream.post(args.text, args.parentPostId);
        }

        if (args.text) {
            return Container.streamView.post(stream, args.text);
        }

        return await Container.streamView.openStream(stream);
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

        const stream = await this.findStream(args, { includeActive: true, includeDefault: !args.send });
        if (stream === undefined) throw new Error(`No stream could be found`);

        const uri = document.uri;

        const repo = await Container.session.repos.getByFileUri(uri);
        if (repo === undefined) throw new Error(`No repository could be found for Uri(${uri.toString()}`);

        const authors = await Container.git.getFileAuthors(uri, {
            startLine: selection.start.line,
            endLine: selection.end.line,
            contents: document.isDirty ? document.getText() : undefined
        });

        const users = await Container.session.users.getByEmails(authors.map(a => a.email));
        const mentions = Iterables.join(Iterables.map(users, u => `@${u.name}`), ', ');

        const code = document.getText(selection);
        const commitHash = await Container.git.getFileCurrentSha(document.uri);

        if (args.send && args.text) {
            // Get the file/marker stream to post to
            const markerStream = await repo.streams.toIdOrArgs(uri);
            return stream.postCode(args.text, code, selection, commitHash!, markerStream, args.parentPostId);
        }

        return Container.streamView.postCode(stream, repo, repo.relativizeUri(uri), code, selection, commitHash!, args.text, mentions);
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

    private async findStream(locator: IStreamLocator, options: { includeActive?: boolean, includeDefault?: boolean } = {}) {
        let stream;
        if (locator !== undefined) {
            if (locator.stream !== undefined) {
                stream = locator.stream instanceof StreamNode ? locator.stream.stream : locator.stream;
            }
            else if (locator.searchBy !== undefined) {
                if (typeof locator.searchBy === 'string') {
                    if (locator.autoCreate) throw new Error(`Auto-create isn't supported on Channels`);

                    stream = await Container.session.channels.getByName(locator.searchBy);
                }
                else if (locator.searchBy instanceof Uri) {
                    const repo = await Container.session.repos.getByFileUri(locator.searchBy);
                    if (repo !== undefined) {
                        if (locator.autoCreate) {
                            stream = await repo.streams.getOrCreateByUri(locator.searchBy);
                        }
                        else {
                            stream = await repo.streams.getByUri(locator.searchBy);
                        }
                    }
                    else {
                        stream = undefined;
                    }
                }
                else {
                    if (locator.autoCreate) {
                        stream = await Container.session.directMessages.getOrCreateByMembers(locator.searchBy);
                    }
                    else {
                        stream = await Container.session.directMessages.getByMembers(locator.searchBy);
                    }
                }
            }
        }

        if (stream === undefined && options.includeActive) {
            stream = Container.streamView.activeStream;
        }

        if (stream === undefined && options.includeDefault) {
            stream = await Container.session.getDefaultTeamChannel();
        }

        return stream;
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

export interface CommandOptions {
    customErrorHandling?: boolean;
    showErrorMessage?: string;
}

export interface Command {
    name: string;
    key: string;
    method: Function;
    options: CommandOptions;
}

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

        commandRegistry.push({
            name: `${ExtensionId}.${command}`,
            key: key,
            method: method,
            options: options
        });
    };
}
