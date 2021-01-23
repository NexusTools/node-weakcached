/// <reference types="mocha" />

try {
  require("source-map-support/register")
} catch(e) {}

import Promised = require("@nexustools/promised");
import { Generator } from "../src/WeakCached";
import WeakCached = require("..");

const noreason = {};
import util = require("util");

const test = {tuna: true};
const test2 = {farm: test};
const errors = function(r, reason, cb: (err?: Error) => void) {
  if((r instanceof Error ? r.message : r) === (reason === noreason ? undefined : reason))
    return cb();

  cb(new Error("Expected error: " + util.inspect(reason) + " but got: " + util.inspect(r)));
}
const rejects = function(p: WeakCached<any, any>, reason: any, cb: (err?: Error) => void) {
  p.get((err, val) => {
    errors(err || val, reason, cb);
  });
}
const resolves = function(p: WeakCached<any, any>, equals: any, cb: (err?: Error) => void) {
  p.get((err, val) => {
    if(err) return cb(new Error("Expected value: " + util.inspect(equals) + " but got error: " + util.inspect(err)));

    if(val === equals)
      return cb();

    cb(new Error("Expected value: " + util.inspect(equals) + " but got: " + util.inspect(val)));
  });
}

const rejectsIt = (msg: string, impl: () => WeakCached<any, any>, reason: any = "test") =>
                                it(msg, (cb) => rejects(impl(), reason, cb));
const resolvesIt = (msg: string, impl: () => WeakCached<any, any>, equals: any = test) =>
                          it(msg, (cb) => resolves(impl(), equals, cb));

const tests = (weakcached: typeof WeakCached, hasweakref = true) => {
  const generator: Generator<any, any> = (callback) => callback(null, test);
  const idgenerator: Generator<any, any> = (callback, arg) => callback(null, arg);
  const errgenerator: Generator<any, any> = (callback) => callback(new Error("test"));
  describe("API", () => {
    resolvesIt("new {generator: c => c(null, test)}", () => new weakcached({generator}));
    rejectsIt("new {generator: c => c(new Error('test'))}", () => new weakcached({generator:errgenerator}));
    resolvesIt(".generate {generator: c => c(null, test)}", () => {
      const cached = new weakcached();
      cached.generate(generator);
      return cached;
    });
    rejectsIt(".generate {generator: c => c(new Error('test'))}", () => {
      const cached = new weakcached();
      cached.generate(errgenerator);
      return cached;
    });
    resolvesIt(".generate {generator: (c, arg) => c(null, arg)}, test", () => {
      const cached = new weakcached();
      cached.generate(idgenerator, test);
      return cached;
    });
    rejectsIt(".generate {generator: c => c(new Error('test'))}, test", () => {
      const cached = new weakcached();
      cached.generate(errgenerator, test);
      return cached;
    });
    resolvesIt("new {generator: (c, arg) => c(null, arg)}, .generate test", () => {
      const cached = new weakcached({generator:idgenerator});
      cached.generate(test);
      return cached;
    });
    resolvesIt("new (c, arg) => c(null, arg), .generate test", () => {
      const cached = new weakcached(idgenerator);
      cached.generate(test);
      return cached;
    });
    resolvesIt("new (c, arg) => c(null, arg), test", () => {
      return new weakcached(idgenerator, test);
    });
    rejectsIt("new (with no parameters)", () => {
      return new weakcached();
    }, "No default generator passed in WeakCached constructor");
    rejectsIt("new {}", () => {
      return new weakcached({});
    }, "No default generator passed in WeakCached constructor");
    rejectsIt("new null, test", () => {
      return new weakcached(null, test);
    }, "No default generator passed in WeakCached constructor");
    rejectsIt("new {generator: c => c(new Error('test'))}, .generate test", () => {
      const cached = new weakcached({generator:errgenerator});
      cached.generate(test);
      return cached;
    });
    it(".generate c => c(null, test), true, true (too many arguments)", (cb) => {
      const cached = new weakcached();
      try {
        (cached.generate as any)({generator}, true, true);
        cb(new Error("This should have errored..."));
      } catch(e) {
        errors(e, "Invalid parameters", cb);
      }
    });
    it("new c => c(null, test), true, true (too many arguments)", (cb) => {
      try {
        new (weakcached as any)({generator}, true, true);
        cb(new Error("This should have errored..."));
      } catch(e) {
        errors(e, "Invalid parameters", cb);
      }
    });
    resolvesIt("new c => setImmediate(c.bind(null, null, test))", () => {
      return new (weakcached as any)(callback => {
        setImmediate(callback.bind(null, null, test));
      });
    });
    rejectsIt("new c => setImmediate(c.bind(null, new Error('test')))", () => {
      return new (weakcached as any)(callback => {
        setImmediate(callback.bind(null, new Error('test')));
      });
    });
    resolvesIt("new c => new Promise(r => r(test))", () => {
      return new (weakcached as any)(callback => new Promise(r => r(test)));
    });
    resolvesIt("new c => new Promised(r => r(test))", () => {
      return new (weakcached as any)(callback => new Promised(r => r(test)));
    });
  });
  describe("Options", () => {
    rejectsIt("Timeout", () => new weakcached({
      generator: () => {}, // Will never return,
      timeout: 0.010 // 25ms
    }), "Generationg timed out");

    it("Expires", (cb) => {
      const cached = new weakcached({
        generator, lifetime: 0.010 // 25ms
      });
      cached.generate();

      setTimeout(() => {
        if(hasweakref) {
          if((cached as any).raw instanceof (global as any).WeakRef)
            return cb();
        } else if((cached as any).raw === undefined)
          return cb();

        cb(new Error("Value has not expired!"));
      }, 15);
    })
  });
};

describe("class WeakCached", () => {
  const WeakRef = (global as any).WeakRef;
  if(!WeakRef) throw new Error("Runtime with WeakRef is required for tests");

  (global as any).WeakRef = undefined;
  describe("Without WeakRef", () => {
    var name = require.resolve('../src/WeakCached');
    delete require.cache[name];

    tests(require(name).WeakCached, false);
  });

  (global as any).WeakRef = WeakRef;
  describe("WeakRef", () => {
    tests(WeakCached);
  });
});
