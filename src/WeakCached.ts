import Promised = require("@nexustools/promised");

declare class WeakRef<V extends object> {
  constructor(val: V);
  deref(): V | undefined;
}

const r = (global as any).WeakRef;

const supportsWeakRef = !!r;
const ref: typeof WeakRef = supportsWeakRef ? r : class NoWeakRef {};
const deref = supportsWeakRef ? (val: any) => val instanceof ref ? val.deref() : val : val => val;

export interface Cancel<V> {
  (valueOrError?: V | Error): void;
}
export interface CancelPromised<V> extends Promised<V>, Cancel<V> {}

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

const DefaultGenerator = function() {
  throw new Error("No default generator passed in WeakCached constructor");
}

export class WeakCached<V extends object, A> {
  /**
   * Whether or not the JavaScript runtime supports WeakRefs
   */
  static readonly supportsWeakRef = supportsWeakRef;
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
  constructor(...args: any[]) {
    switch(args.length) {
      case 1:
        if(typeof args[0] === "function") {
          this.generator = args[0] as any;
          this.lifetime = WeakCached.DefaultLifetime * 1000;
          this.timeout = WeakCached.DefaultTimeout * 1000;
        } else {
          const opts = args[0] as Options<V, A>;
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
        this.generator = args[0] as any || DefaultGenerator;
        this.arg = args[1] as any;
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

  generate(arg?: A): CancelPromised<V>;
  generate(executor: Generator<V, A>, arg?: A): CancelPromised<V>;
  generate(...args: any[]): CancelPromised<V>{
    let generator = this.generator;
    let arg = this.arg;

    switch(args.length) {
      case 1:
        if(typeof args[0] === "function")
          generator = args[0] as any;
        else
          arg = args[0] as any;
        break;
      case 2:
        generator = args[0] as any;
        arg = args[1] as any;
      case 0:
        break;
      default:
        throw new Error("Invalid parameters");
    }

    try {
      let cancel: Cancel<V>;
      let promised: Promised<V>;
      const ret = generator((err?: Error, value?: V) => {
        if(!promised) promised = new Promised();

        if(err) promised.reject(err);
        else promised.resolve(value);
      }, arg);
      if(!promised)
        if(ret) {
          if((ret as any).then)
            promised = ret instanceof Promised ? ret : new Promised(ret as any);
          else cancel;
        } else promised = new Promised();
      promised.dispose = this.dispose;

      try{clearTimeout(this.expires)}catch(e){}
      this.expires = setTimeout(() => {
        promised.reject(new Error("Generationg timed out"));
      }, this.timeout).unref();

      const cancelPromise: CancelPromised<V> = function(valueOrError: V | Error) {
        if(valueOrError instanceof Error) promised.reject(valueOrError);
        else promised.resolve(valueOrError);

        try {
          cancel?.(valueOrError);
        } finally {
          cancel = null;
        }
      } as any;

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
        if(raw) {
          const dispose = this.dispose;
          if(dispose && !(raw instanceof Error)) {
            if(typeof raw == "function")
              (raw as CancelPromised<V>).then(dispose);
            else
              dispose(raw);
          }
        }
      } catch(e) {}

      if(this.raw === _raw) this.raw = cancelPromise;
      return cancelPromise;
    } catch(e) {
      this.set(e);
    }

    return undefined;
  }

  set(value: V | PromiseLike<V> | Error, lifetime?: number) {
    try{clearTimeout(this.expires)}catch(e){}

    let raw = this.raw;
    if(raw) {
      if(raw === value) return;
      const dispose = this.dispose;
      if(dispose) {
        if(raw instanceof ref) raw = raw.deref();
        if(!(raw instanceof Error)) {
          if(typeof raw == "function") {
            (raw as CancelPromised<V>).then(dispose);
            (raw as CancelPromised<V>)();
          } else
            dispose(raw);
        }
      }
    }

    if((value as any)?.then) {
      const promised = value instanceof Promised ? value : new Promised(value as any);

      const set = this.set.bind(this);
      promised.then(set, set);

      value = function(valueOrError: V | Error) {
        if(valueOrError instanceof Error) promised.reject(valueOrError);
        else promised.resolve(valueOrError);
      } as any;

      (value as CancelPromised<V>).finally = promised.finally.bind(promised);
      (value as CancelPromised<V>).catch = promised.catch.bind(promised);
      (value as CancelPromised<V>).then = promised.then.bind(promised);

      Object.defineProperty(value, "finished", {
        configurable: false,
        enumerable: true,
        get: () => promised.finished
      });
    } else if(!(value instanceof Error))
      this.expires = setTimeout(() => this.expire(), lifetime || this.lifetime).unref();

    this.raw = value as any;
  }
  get(onresult: (err: Error, value?: V) => void): CancelPromised<V> | void{
    let raw = this.raw;
    if(raw instanceof ref) raw = raw.deref();
    if(raw === void 0 || raw === null) {
      const cancel = this.generate();
      if(cancel) {
        cancel.then(onresult.bind(null, null), onresult);
        return cancel;
      }

      return this.get(onresult);
    }

    if(typeof raw === "function") {
      const cancel = raw as CancelPromised<V>;
      cancel.then(onresult.bind(null, null), onresult);
      return cancel;
    } else if(raw instanceof Error)
      onresult(raw);
    else
      onresult(null, raw);
  }

  expire(): this{
    this.set(undefined);
    return this;
  }

  private arg: A;
  private timeout: number;
  private lifetime: number;
  private expires: NodeJS.Timeout;
  private dispose: (value: V) => void;
  private generator: Generator<V, any>;
  private raw: V | CancelPromised<V> | WeakRef<V> | Error;
}
if(supportsWeakRef) (WeakCached.prototype as any).expire = function(this: WeakCached<any, any>) {
  const raw = (this as any).raw;
  if(!raw) return;

  if(raw instanceof Error || typeof raw === "function")
    this.set(undefined);
  else (this as any).raw = new ref(raw);

  return this;
};
