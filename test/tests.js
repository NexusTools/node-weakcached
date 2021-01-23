"use strict";
/// <reference types="mocha" />
Object.defineProperty(exports, "__esModule", { value: true });
try {
    require("source-map-support/register");
}
catch (e) { }
const Promised = require("@nexustools/promised");
const WeakCached = require("..");
const noreason = {};
const util = require("util");
const test = { tuna: true };
const test2 = { farm: test };
const errors = function (r, reason, cb) {
    if ((r instanceof Error ? r.message : r) === (reason === noreason ? undefined : reason))
        return cb();
    cb(new Error("Expected error: " + util.inspect(reason) + " but got: " + util.inspect(r)));
};
const rejects = function (p, reason, cb) {
    p.get((err, val) => {
        errors(err || val, reason, cb);
    });
};
const resolves = function (p, equals, cb) {
    p.get((err, val) => {
        if (err)
            return cb(new Error("Expected value: " + util.inspect(equals) + " but got error: " + util.inspect(err)));
        if (val === equals)
            return cb();
        cb(new Error("Expected value: " + util.inspect(equals) + " but got: " + util.inspect(val)));
    });
};
const rejectsIt = (msg, impl, reason = "test") => it(msg, (cb) => rejects(impl(), reason, cb));
const resolvesIt = (msg, impl, equals = test) => it(msg, (cb) => resolves(impl(), equals, cb));
const tests = (weakcached, hasweakref = true) => {
    const generator = (callback) => callback(null, test);
    const idgenerator = (callback, arg) => callback(null, arg);
    const errgenerator = (callback) => callback(new Error("test"));
    describe("API", () => {
        resolvesIt("new {generator: c => c(null, test)}", () => new weakcached({ generator }));
        rejectsIt("new {generator: c => c(new Error('test'))}", () => new weakcached({ generator: errgenerator }));
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
            const cached = new weakcached({ generator: idgenerator });
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
            const cached = new weakcached({ generator: errgenerator });
            cached.generate(test);
            return cached;
        });
        it(".generate c => c(null, test), true, true (too many arguments)", (cb) => {
            const cached = new weakcached();
            try {
                cached.generate({ generator }, true, true);
                cb(new Error("This should have errored..."));
            }
            catch (e) {
                errors(e, "Invalid parameters", cb);
            }
        });
        it("new c => c(null, test), true, true (too many arguments)", (cb) => {
            try {
                new weakcached({ generator }, true, true);
                cb(new Error("This should have errored..."));
            }
            catch (e) {
                errors(e, "Invalid parameters", cb);
            }
        });
        resolvesIt("new c => setImmediate(c.bind(null, null, test))", () => {
            return new weakcached(callback => {
                setImmediate(callback.bind(null, null, test));
            });
        });
        rejectsIt("new c => setImmediate(c.bind(null, new Error('test')))", () => {
            return new weakcached(callback => {
                setImmediate(callback.bind(null, new Error('test')));
            });
        });
        resolvesIt("new c => new Promise(r => r(test))", () => {
            return new weakcached(callback => new Promise(r => r(test)));
        });
        resolvesIt("new c => new Promised(r => r(test))", () => {
            return new weakcached(callback => new Promised(r => r(test)));
        });
    });
    describe("Options", () => {
        rejectsIt("Timeout", () => new weakcached({
            generator: () => { },
            timeout: 0.010 // 25ms
        }), "Generationg timed out");
        it("Expires", (cb) => {
            const cached = new weakcached({
                generator, lifetime: 0.010 // 25ms
            });
            cached.generate();
            setTimeout(() => {
                if (hasweakref) {
                    if (cached.raw instanceof global.WeakRef)
                        return cb();
                }
                else if (cached.raw === undefined)
                    return cb();
                cb(new Error("Value has not expired!"));
            }, 15);
        });
    });
};
describe("class WeakCached", () => {
    const WeakRef = global.WeakRef;
    if (!WeakRef)
        throw new Error("Runtime with WeakRef is required for tests");
    global.WeakRef = undefined;
    describe("Without WeakRef", () => {
        var name = require.resolve('../src/WeakCached');
        delete require.cache[name];
        tests(require(name).WeakCached, false);
    });
    global.WeakRef = WeakRef;
    describe("WeakRef", () => {
        tests(WeakCached);
    });
});
//# sourceMappingURL=tests.js.map