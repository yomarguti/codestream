import { commands, ConfigurationTarget, Disposable, MessageItem, Range, TextDocument, Uri, ViewColumn, window } from 'vscode';
import { ChannelStreamCreationOptions, CodeStreamSession, Post, Stream, StreamThread, StreamType } from './api/session';
import { openEditor } from './common';
import { configuration, TraceLevel } from './configuration';
import { Container } from './container';
import { encryptionKey } from './extension';
import { Logger } from './logger';
import { PostNode } from './views/postNode';
import { Command, createCommandDecorator, Crypto, Dates, Iterables } from './system';
import * as path from 'path';

const commandRegistry: Command[] = [];
const command = createCommandDecorator(commandRegistry);

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
    ReloadWindow = 'workbench.action.reloadWindow',
    SetContext = 'setContext',
    ShowCodeStream = 'workbench.view.extension.codestream',
    ShowReferences = 'editor.action.showReferences'
}

type StreamLocator =
    { type: StreamType.Channel, name: string, create?: ChannelStreamCreationOptions } |
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

export interface OpenStreamCommandArgs extends IRequiresStream {
    session?: CodeStreamSession;
}

export interface PostCommandArgs extends IRequiresStream {
    text?: string;
    send?: boolean;
    silent?: boolean;
    session?: CodeStreamSession;
}

export interface PostCodeCommandArgs extends IRequiresStream {
    document?: TextDocument;
    range?: Range;
    text?: string;
    send?: boolean;
    session?: CodeStreamSession;
}

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
        const name = await window.showInputBox({
            prompt: 'Enter channel name',
            placeHolder: 'e.g. awesome-feature',
            validateInput: v => {
                if (v.includes(' ')) return 'Channel names cannot contain spaces';
                if (v.length > 64) return 'Channel names cannot be longer than 64 characters';
                return undefined;
            }
        });
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
            { preview: true, viewColumn: ViewColumn.One, selection: block.range });
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
        return openEditor(block.uri, { preview: true, viewColumn: ViewColumn.One, selection: block.range });
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

        return openEditor(Uri.file(file), { preview: true, viewColumn: ViewColumn.One, selection: block.range });
    }

    @command('openStream', { showErrorMessage: 'Unable to open stream' })
    async openStream(args: OpenStreamCommandArgs): Promise<StreamThread | undefined> {
        const streamThread = await this.findStreamThread(args.session || Container.session, args, { includeActive: true, includeDefault: true });
        if (streamThread === undefined) return undefined;

        return Container.streamView.show(streamThread);
    }

    @command('post', { showErrorMessage: 'Unable to post message' })
    async post(args: PostCommandArgs): Promise<Post | StreamThread> {
        const streamThread = await this.findStreamThread(args.session || Container.session, args, { includeActive: true, includeDefault: true /*!args.send*/ });
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

        const streamThread = await this.findStreamThread(args.session || Container.session, args, { includeActive: true, includeDefault: true });
        if (streamThread === undefined) throw new Error(`No stream could be found`);

        const uri = document.uri;

        const repo = await (args.session || Container.session).repos.getByFileUri(uri);
        if (repo === undefined) throw new Error(`No repository could be found for Uri(${uri.toString()}`);

        const authors = await Container.git.getFileAuthors(uri, {
            startLine: selection.start.line,
            endLine: selection.end.line,
            contents: document.isDirty ? document.getText() : undefined
        });

        const authorEmails = authors.map(a => a.email);
        Logger.log(`Commands.postCode: authors found: ${authorEmails.join(', ')}`);

        const users = await (args.session || Container.session).users.getByEmails(authorEmails);
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

        const regex = /(\d+)([d|h|m])/;
        const value = await window.showInputBox({
            prompt: 'Enter the number of days, hours, or minutes to reset back to',
            placeHolder: 'e.g. 5d or 6h or 10m',
            validateInput: v => regex.test(v) ? undefined : 'Invalid input'
        });
        if (value === undefined) return;

        const match = regex.exec(value);
        if (match == null) return;

        const [, num, unit] = match;

        let milliseconds;
        switch (unit) {
            case 'd':
                milliseconds = parseInt(num, 10) * 24 * 60 * 60000;
                break;
            case 'h':
                milliseconds = parseInt(num, 10) * 60 * 60000;
                break;
            case 'm':
                milliseconds = parseInt(num, 10) * 60000;
                break;
            default:
                return;
        }

        Logger.log(`Reset data back to ${Dates.toFormatter(new Date(new Date().getTime() - milliseconds)).format('MMMM Do, YYYY h:mma')}`);
        Container.session.api.resetTeam(new Date().getTime() - milliseconds);
        commands.executeCommand(BuiltInCommands.ReloadWindow);
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
        return commands.executeCommand(BuiltInCommands.ShowCodeStream);
    }

    @command('signIn', { customErrorHandling: true })
    signIn() {
        return this.signInCore(Container.config.email, Container.config.password, Container.config.teamId);
    }

    @command('signOut')
    signOut() {
        return Container.session.logout();
    }

    @command('toggle')
    toggle() {
        return Container.streamView.toggle();
    }

    private async findStreamThread(session: CodeStreamSession, threadOrLocator: IRequiresStream, options: { includeActive?: boolean, includeDefault?: boolean } = {}): Promise<StreamThread | undefined> {
        if (threadOrLocator !== undefined && threadOrLocator.streamThread !== undefined) {
            if (isStreamThread(threadOrLocator.streamThread)) return threadOrLocator.streamThread;

            if (isStreamThreadId(threadOrLocator.streamThread)) {
                const stream = await session.getStream(threadOrLocator.streamThread.streamId);
                return stream !== undefined
                    ? { id: threadOrLocator.streamThread.id, stream: stream }
                    : undefined;
            }

            const locator = threadOrLocator.streamThread;

            let stream;
            switch (locator.type) {
                case StreamType.Channel:
                    if (locator.create) {
                        return { id: undefined, stream: await session.channels.getOrCreateByName(locator.name, locator.create) };
                    }

                    stream = await session.channels.getByName(locator.name);
                    break;

                case StreamType.Direct:
                    if (locator.create) {
                        return { id: undefined, stream: await session.directMessages.getOrCreateByMembers(locator.members) };
                    }

                    stream = await session.directMessages.getByMembers(locator.members);
                    break;

                case StreamType.File:
                    const repo = await session.repos.getByFileUri(locator.uri);
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
            streamThread = { id: undefined, stream: await session.getDefaultTeamChannel() };
        }

        return streamThread;
    }

    private async signInCore(email: string | undefined, password: string | undefined, teamId?: string) {
        if (password) {
            try {
                password = Crypto.decrypt(password, 'aes-256-ctr', encryptionKey);
            } catch {
                password = undefined;
            }
        }

        if (!email || !password) {
            if (!email) {
                password = undefined;

                email = await window.showInputBox({
                    prompt: 'Enter your CodeStream email address',
                    placeHolder: 'e.g. @company.com'
                });
                if (email === undefined) return;

                await configuration.update(configuration.name('email').value, email, ConfigurationTarget.Global);
            }

            if (!password) {
                password = await window.showInputBox({
                    prompt: 'Enter your CodeStream password',
                    placeHolder: 'password',
                    password: true
                });
                if (password === undefined) return;

                await configuration.update(configuration.name('password').value, Crypto.encrypt(password, 'aes-256-ctr', encryptionKey), ConfigurationTarget.Global);
            }
        }

        try {
            return await Container.session.login(email, password, teamId);
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
                setImmediate(() => this.signInCore(email, password));
            }
            else if (result === actions[1]) {
                Logger.showOutputChannel();
            }
        }
    }
}
