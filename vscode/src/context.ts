'use strict';
import { commands } from 'vscode';

export enum ContextKeys {
    LiveShareInstalled = 'codestream:liveShareInstalled',
    Status = 'codestream:status'
}

export function setContext(key: ContextKeys | string, value: any) {
    return commands.executeCommand('setContext', key, value);
}