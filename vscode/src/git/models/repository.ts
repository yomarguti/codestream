'use strict';
import { Uri } from 'vscode';

export interface GitRepository {
    readonly rootUri: Uri;
    // readonly inputBox: InputBox;
}
