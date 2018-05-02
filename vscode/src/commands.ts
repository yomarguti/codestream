import { commands, Disposable, MessageItem, Range, TextDocument, Uri, window } from 'vscode';
import { Post, Stream, StreamThread, StreamType } from './api/session';
import { openEditor } from './common';
import { TraceLevel } from './configuration';
import { Container } from './container';
import { ExtensionId } from './extension';
import { Logger } from './logger';
import { PostNode } from './views/postNode';
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

type StreamLocator =
    { type: StreamType.Channel, name: string, create?: { membership?: 'auto' | string[] } } |
    { type: StreamType.Direct, members: string[], create?: boolean } |
    { type: StreamType.File, uri: Uri, create?: boolean };

interface StreamThreadId {
    id: string | undefined;
    streamId: string;
}

interface IRequiresStream {
    streamThread: StreamThread | StreamThreadId | StreamLocator | undefined;
}

export function isStreamThread(streamOrThreadOrLocator: Stream | StreamThread | StreamThreadId | StreamLocator): streamOrThreadOrLocator is StreamThread {
    return (streamOrThreadOrLocator as any).stream !== undefined;
}

export function isStreamThreadId(streamOrThreadOrLocator: Stream | StreamThread | StreamThreadId | StreamLocator): streamOrThreadOrLocator is StreamThreadId {
    return (streamOrThreadOrLocator as any).streamId !== undefined;
}

export interface OpenStreamCommandArgs extends IRequiresStream { }

export interface PostCommandArgs extends IRequiresStream {
    text?: string;
    send?: boolean;
    silent?: boolean;
}

export interface PostCodeCommandArgs extends IRequiresStream {
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

    @command('addChannel', { showErrorMessage: 'Unable to add channel' })
    async addChannel() {
        const name = await window.showInputBox({ prompt: 'Enter channel name', placeHolder: 'e.g. awesome-feature' });
        if (name === undefined) return;

        const channel = await Container.session.addChannel(name);
        return await this.openStream({ streamThread: { id: undefined, stream: channel } });
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
    async openStream(args: OpenStreamCommandArgs): Promise<StreamThread | undefined> {
        const streamThread = await this.findStreamThread(args, { includeActive: true, includeDefault: true });
        if (streamThread === undefined) return undefined;

        return Container.streamView.show(streamThread);
    }

    @command('post', { showErrorMessage: 'Unable to post message' })
    async post(args: PostCommandArgs): Promise<Post | StreamThread> {
        const streamThread = await this.findStreamThread(args, { includeActive: true, includeDefault: true /*!args.send*/ });
        if (streamThread === undefined) throw new Error(`No stream could be found`);

        if (args.send && args.text) {
            if (!args.silent) {
                await this.openStream({ streamThread: streamThread });
            }
            return streamThread.stream.post(args.text, streamThread.id);
        }

        if (args.text) {
            await Container.streamView.post(streamThread, args.text);
            return streamThread;
        }

        return (await this.openStream({ streamThread: streamThread }))!;
    }

    @command('postCode', { showErrorMessage: 'Unable to add comment' })
    async postCode(args: PostCodeCommandArgs): Promise<Post | Stream | undefined> {
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

        const streamThread = await this.findStreamThread(args, { includeActive: true, includeDefault: true });
        if (streamThread === undefined) throw new Error(`No stream could be found`);

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
            return streamThread.stream.postCode(args.text, code, selection, commitHash!, markerStream, streamThread.id);
        }

        await Container.streamView.postCode(streamThread, repo, repo.relativizeUri(uri), code, selection, commitHash!, args.text, mentions);
        return streamThread.stream;
    }

    @command('reset')
    async reset() {
        await Container.session.streamVisibility.clear();
        Container.channelsExplorer.refresh();
        Container.peopleExplorer.refresh();
        Container.repositoriesExplorer.refresh();
        Container.liveShareExplorer.refresh();
    }

    @command('runServiceAction')
    runServiceAction(args: { commandUri: string }) {
        return Container.linkActions.execute(args.commandUri);
    }

    @command('show')
    show() {
        return Container.streamView.show();
    }

    showActivity() {
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

    @command('toggle')
    toggle() {
        return Container.streamView.toggle();
    }

    private async findStreamThread(threadOrLocator: IRequiresStream, options: { includeActive?: boolean, includeDefault?: boolean } = {}): Promise<StreamThread | undefined> {
        if (threadOrLocator !== undefined && threadOrLocator.streamThread !== undefined) {
            if (isStreamThread(threadOrLocator.streamThread)) return threadOrLocator.streamThread;

            if (isStreamThreadId(threadOrLocator.streamThread)) {
                const stream = await Container.session.getStream(threadOrLocator.streamThread.streamId);
                return stream !== undefined
                    ? { id: threadOrLocator.streamThread.id, stream: stream }
                    : undefined;
            }

            const locator = threadOrLocator.streamThread;

            let stream;
            switch (locator.type) {
                case StreamType.Channel:
                    if (locator.create) {
                        return { id: undefined, stream: await Container.session.channels.getOrCreateByName(locator.name, locator.create) };
                    }

                    stream = await Container.session.channels.getByName(locator.name);
                    break;

                case StreamType.Direct:
                    if (locator.create) {
                        return { id: undefined, stream: await Container.session.directMessages.getOrCreateByMembers(locator.members) };
                    }

                    stream = await Container.session.directMessages.getByMembers(locator.members);
                    break;

                case StreamType.File:
                    const repo = await Container.session.repos.getByFileUri(locator.uri);
                    if (repo !== undefined) {
                        if (locator.create) {
                            return { id: undefined, stream: await repo.streams.getOrCreateByUri(locator.uri) };
                        }

                        stream = await repo.streams.getByUri(locator.uri);
                        break;
                    }
            }

            if (stream !== undefined) return { id: undefined, stream: stream };
        }

        let streamThread;
        if (options.includeActive) {
            streamThread = Container.streamView.activeStreamThread;
        }

        if (streamThread === undefined && options.includeDefault) {
            streamThread = { id: undefined, stream: await Container.session.getDefaultTeamChannel() };
        }

        return streamThread;
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
                        if (Container.config.traceLevel !== TraceLevel.Silent) {
                            const actions: MessageItem[] = [
                                { title: 'Open Output Channel' }
                            ];

                            const result = await window.showErrorMessage(`${options.showErrorMessage} \u00a0\u2014\u00a0 ${ex.toString()}`, ...actions);
                            if (result === actions[0]) {
                                Logger.showOutputChannel();
                            }
                        }
                        else {
                            window.showErrorMessage(`${options.showErrorMessage} \u00a0\u2014\u00a0 ${ex.toString()}`);
                        }
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
