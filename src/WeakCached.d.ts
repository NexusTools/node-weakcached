import Promised = require("@nexustools/promised");
export interface Cancel<V> {
    (valueOrError?: V | Error): void;
}
export interface CancelPromised<V> extends Promised<V>, Cancel<V> {
}
export interface Generator<V, A> {
    (callback?: (err: Error, value?: V) => void, arg?: A): PromiseLike<V> | Cancel<V> | void;
}
interface Options<V extends object, A> {
    /**
     * The default generator to use
     */
    generator?: Generator<V, A>;
    /**
     * The default argument to use
     */
    arg?: A;
    /**
     * Optional method to dispose of values cleanly
     */
    dispose?: (value: V) => void;
    /**
     * The value lifetime, in seconds (default is 5 minutes)
     *
     * When a value lifetime, if possible, it is made weak, otherwise it is removed
     */
    lifetime?: number;
    /**
     * The timeout for generating values, in seconds (default is 1 minutes)
     */
    timeout?: number;
}
/**
 * Configurable weakly cached node.
 **/
export declare class WeakCached<V extends object, A> {
    /**
     * Whether or not the JavaScript runtime supports WeakRefs
     */
    static readonly supportsWeakRef: boolean;
    /**
     * The default generatation timeout, in seconds (1 minute)
     */
    static readonly DefaultTimeout = 60;
    /**
     * The default value lifetime, in seconds (5 minutes)
     */
    static readonly DefaultLifetime = 300;
    constructor(options?: Options<V, A>);
    constructor(executor: Generator<V, A>, arg?: A);
    /**
     * Generate a value.
     **/
    generate(arg?: A): CancelPromised<V>;
    generate(executor: Generator<V, A>, arg?: A): CancelPromised<V>;
    /**
     * Set the internal value.
     *
     * @param value The value to use
     * @param lifetime Optionally a lifetime for this value
     **/
    set(value: V | PromiseLike<V> | Error, lifetime?: number): void;
    /**
     * Gets the internal value.
     *
     * @param value The value to use
     * @param lifetime Optionally a lifetime for this value
     **/
    get(): V | CancelPromised<V> | Error | void;
    /**
     * Expire the value.
     **/
    expire(): this;
    private arg;
    private timeout;
    private lifetime;
    private expires;
    private dispose;
    private generator;
    private raw;
}
export {};
