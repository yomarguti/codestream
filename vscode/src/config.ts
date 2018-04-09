'use strict';

export interface IConfig {
    explorer: {
        enabled: boolean;
    };

    password: string;
    username: string;
    serverUrl: string;
}