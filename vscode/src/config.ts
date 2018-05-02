'use strict';

export interface BotResponse {
    message: string;
    location: 'channel' | 'thread';
}

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
    bot: {
        email: string;
        enabled: boolean;
        password: string;
        triggers: { message: string, response: BotResponse }[];
    };

    debug: boolean;
    email: string;

    explorers: {
        enabled: boolean;
    };

    notifications: Notifications;
    password: string;
    serverUrl: string;
    teamId: string;
    traceLevel: TraceLevel;
}