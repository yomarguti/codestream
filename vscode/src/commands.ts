import { commands, Disposable, MessageItem, window } from 'vscode';
import { TraceLevel } from './config';
import { Container } from './container';
import { Logger } from './logger';

interface CommandOptions {
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

        registry.push({
            name: `codestream.${command}`,
            key: key,
            method: descriptor.value,
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

    @command('post')
    async post() {
        const message = await window.showInputBox({ prompt: 'Enter message', placeHolder: 'Message' });
        if (message === undefined) return;

        return Container.session.post(message);
    }

    @command('postCode')
    async postCode() {
        const editor = window.activeTextEditor;
        if (editor === undefined) return undefined;

        const selection = editor.selection;
        if (selection.start.isEqual(selection.end)) return undefined;

        const uri = editor.document.uri;

        // TODO: Blame to get authors

        const message = await window.showInputBox({ prompt: 'Enter Comment', placeHolder: 'Comment' });
        if (message === undefined) return;

        const code = editor.document.getText(selection);
        const commitHash = await Container.git.getCurrentSha(uri);

        return Container.session.postCode(message, uri, code, selection, commitHash);
    }

    @command('signIn')
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
