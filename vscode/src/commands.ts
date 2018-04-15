import { commands, Disposable, MessageItem, window } from 'vscode';
import { Post } from './api/session';
import { TraceLevel } from './config';
import { Container } from './container';
import { Logger } from './logger';

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

    @command('openPost', { showErrorMessage: 'Unable to open post' })
    async openPost(post?: Post) {
        if (post === undefined) return;

        // post.repoId
        // return Container.session.post(message);
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

        const mentions = authors.map(a => `@${a.name}`).join(', ');

        const message = await window.showInputBox({
            prompt: 'Enter Comment',
            placeHolder: 'Comment',
            value: `${mentions ? `${mentions}: ` : ''}`
        });
        if (message === undefined) return;

        const code = editor.document.getText(selection);
        const commitHash = await Container.git.getFileCurrentSha(uri);

        return Container.session.postCode(message, uri, code, selection, commitHash);
    }

    @command('signIn', { customErrorHandling: true })
    signIn() {
        return this.signInCore(Container.config.username, Container.config.password);
    }

    @command('signOut')
    signOut() {
        return Container.session.logout();
    }

    private async signInCore(username: string, password: string) {
        try {
            return await Container.session.login(username, password);
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
