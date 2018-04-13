'use strict';

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

    password: string;
    username: string;
    serverUrl: string;
    traceLevel: TraceLevel;
}