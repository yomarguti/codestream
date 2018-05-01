'use strict';

export enum Notifications {
    All = 'all',
    Mentions = 'mentions',
    None = 'none'
}

export enum TraceLevel {
    Silent = 'silent',
    Errors = 'errors',
    Verbose = 'verbose',
    Debug = 'debug'
}

export interface IConfig {
    debug: boolean;

    explorer: {
        enabled: boolean;
    };

    notifications: Notifications;
    password: string;
    serverUrl: string;
    teamId: string;
    traceLevel: TraceLevel;
    username: string;
}