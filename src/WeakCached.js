"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeakCached = void 0;
const Promised = require("@nexustools/promised");
const r = global.WeakRef;
const supportsWeakRef = !!r;
const ref = supportsWeakRef ? r : class NoWeakRef {
};
const deref = supportsWeakRef ? (val) => val instanceof ref ? val.deref() : val : val => val;
const DefaultGenerator = function () {
    throw new Error("No default generator passed in WeakCached constructor");
};
/**
 * Configurable weakly cached node.
 **/
class WeakCached {
    constructor(...args) {
        switch (args.length) {
            case 1:
                if (typeof args[0] === "function") {
                    this.generator = args[0];
                    this.lifetime = WeakCached.DefaultLifetime * 1000;
                    this.timeout = WeakCached.DefaultTimeout * 1000;
                }
                else {
                    const opts = args[0];
                    this.generator = opts.generator || DefaultGenerator;
                    this.lifetime = (opts.lifetime || WeakCached.DefaultLifetime) * 1000;
                    this.timeout = (opts.timeout || WeakCached.DefaultTimeout) * 1000;
                    this.dispose = opts.dispose;
                    this.arg = opts.arg;
                }
                break;
            case 2:
                this.lifetime = WeakCached.DefaultLifetime * 1000;
                this.timeout = WeakCached.DefaultTimeout * 1000;
                this.generator = args[0] || DefaultGenerator;
                this.arg = args[1];
                break;
            case 0:
                this.lifetime = WeakCached.DefaultLifetime * 1000;
                this.timeout = WeakCached.DefaultTimeout * 1000;
                this.generator = DefaultGenerator;
                break;
            default:
                throw new Error("Invalid parameters");
        }
    }
    generate(...args) {
        let generator = this.generator;
        let arg = this.arg;
        switch (args.length) {
            case 1:
                if (typeof args[0] === "function")
                    generator = args[0];
                else
                    arg = args[0];
                break;
            case 2:
                generator = args[0];
                arg = args[1];
            case 0:
                break;
            default:
                throw new Error("Invalid parameters");
        }
        try {
            let cancel;
            let promised;
            const ret = generator((err, value) => {
                if (!promised)
                    promised = new Promised();
                if (err)
                    promised.reject(err);
                else
                    promised.resolve(value);
            }, arg);
            if (!promised)
                if (ret) {
                    if (ret.then)
                        promised = ret instanceof Promised ? ret : new Promised(ret);
                    else
                        cancel;
                }
                else
                    promised = new Promised();
            promised.dispose = this.dispose;
            try {
                clearTimeout(this.expires);
            }
            catch (e) { }
            this.expires = setTimeout(() => {
                promised.reject(new Error("Generationg timed out"));
            }, this.timeout).unref();
            const cancelPromise = function (valueOrError) {
                if (valueOrError instanceof Error)
                    promised.reject(valueOrError);
                else
                    promised.resolve(valueOrError);
                try {
                    cancel === null || cancel === void 0 ? void 0 : cancel(valueOrError);
                }
                finally {
                    cancel = null;
                }
            };
            const _raw = this.raw;
            const set = this.set.bind(this);
            promised.then(set, set);
            cancelPromise.finally = promised.finally.bind(promised);
            cancelPromise.catch = promised.catch.bind(promised);
            cancelPromise.then = promised.then.bind(promised);
            Object.defineProperty(cancelPromise, "finished", {
                configurable: false,
                enumerable: true,
                get: () => promised.finished
            });
            try {
                let raw = deref(_raw);
                if (raw) {
                    const dispose = this.dispose;
                    if (dispose && !(raw instanceof Error)) {
                        if (typeof raw == "function")
                            raw.then(dispose);
                        else
                            dispose(raw);
                    }
                }
            }
            catch (e) { }
            if (this.raw === _raw)
                this.raw = cancelPromise;
            return cancelPromise;
        }
        catch (e) {
            this.set(e);
        }
        return undefined;
    }
    /**
     * Set the internal value.
     *
     * @param value The value to use
     * @param lifetime Optionally a lifetime for this value
     **/
    set(value, lifetime) {
        var _a;
        try {
            clearTimeout(this.expires);
        }
        catch (e) { }
        let raw = this.raw;
        if (raw) {
            if (raw === value)
                return;
            const dispose = this.dispose;
            if (dispose) {
                if (raw instanceof ref)
                    raw = raw.deref();
                if (!(raw instanceof Error)) {
                    if (typeof raw == "function") {
                        raw.then(dispose);
                        raw();
                    }
                    else
                        dispose(raw);
                }
            }
        }
        if ((_a = value) === null || _a === void 0 ? void 0 : _a.then) {
            const promised = value instanceof Promised ? value : new Promised(value);
            const set = this.set.bind(this);
            promised.then(set, set);
            value = function (valueOrError) {
                if (valueOrError instanceof Error)
                    promised.reject(valueOrError);
                else
                    promised.resolve(valueOrError);
            };
            value.finally = promised.finally.bind(promised);
            value.catch = promised.catch.bind(promised);
            value.then = promised.then.bind(promised);
            Object.defineProperty(value, "finished", {
                configurable: false,
                enumerable: true,
                get: () => promised.finished
            });
        }
        else if (!(value instanceof Error))
            this.expires = setTimeout(() => this.expire(), lifetime || this.lifetime).unref();
        this.raw = value;
    }
    /**
     * Gets the internal value.
     *
     * @param value The value to use
     * @param lifetime Optionally a lifetime for this value
     **/
    get() {
        let raw = this.raw;
        if (raw instanceof ref)
            raw = raw.deref();
        if (raw === void 0 || raw === null) {
            this.generate();
            return this.raw;
        }
        return raw;
    }
    /**
     * Expire the value.
     **/
    expire() {
        this.set(undefined);
        return this;
    }
}
exports.WeakCached = WeakCached;
/**
 * Whether or not the JavaScript runtime supports WeakRefs
 */
WeakCached.supportsWeakRef = supportsWeakRef;
/**
 * The default generatation timeout, in seconds (1 minute)
 */
WeakCached.DefaultTimeout = 60;
/**
 * The default value lifetime, in seconds (5 minutes)
 */
WeakCached.DefaultLifetime = 300;
if (supportsWeakRef)
    WeakCached.prototype.expire = function () {
        const raw = this.raw;
        if (!raw)
            return;
        if (raw instanceof Error || typeof raw === "function")
            this.set(undefined);
        else
            this.raw = new ref(raw);
        return this;
    };
//# sourceMappingURL=WeakCached.js.map