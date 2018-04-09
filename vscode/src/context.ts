'use strict';
import { commands } from 'vscode';

export enum Context {
    Enabled = 'codestream:enabled',
    Explorer = 'codestream:explorer'
}

export function setContext(key: Context | string, value: any) {
    return commands.executeCommand('setContext', key, value);
}