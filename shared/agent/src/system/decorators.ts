'use strict';
import { Functions } from '../system/function';

function _memoize(fn: Function, key: string): Function {
    const memoizeKey = `$memoize$${key}`;

    return function(this: any, ...args: any[]) {
        if (!this.hasOwnProperty(memoizeKey)) {
            Object.defineProperty(this, memoizeKey, {
                configurable: false,
                enumerable: false,
                writable: false,
                value: fn.apply(this, args)
            });
        }

        return this[memoizeKey];
    };
}

export const memoize = Functions.decorate(_memoize);
