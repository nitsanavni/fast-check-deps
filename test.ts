import test from "ava";
import * as fc from "fast-check";
import { chain, each, isEmpty, isEqual, pullAll } from "lodash";

// [["a","b"]] -> ["b","a"]

test.serial("resolve", (t) => {
    t.timeout(30000);

    type Element = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j";
    // https://english.stackexchange.com/questions/25575/what-is-the-correct-word-for-dependee
    // the dependent depends on / requires the requisite
    type Dependency = { dependent: Element; requisite: Element };

    const resolve = (deps: Dependency[]): Element[] => {
        const requisites: { [key in Element]?: { dependent: Element; requisites: Element[] } } = {};

        deps.forEach(({ dependent, requisite }) => {
            const empty = (e: Element) => ({ dependent: e, requisites: [] });
            (requisites[dependent] ??= empty(dependent)).requisites.push(requisite);
            requisites[requisite] ??= empty(requisite);
        });

        const ret: Element[] = [];
        const expectedLength = chain(deps)
            .map(({ dependent, requisite }) => [dependent, requisite])
            .flatten()
            .uniq()
            .value().length;

        console.log(requisites);
        while (ret.length < expectedLength) {
            const ready = chain(requisites)
                .filter((b) => isEmpty(b?.requisites))
                .map((b) => b?.dependent)
                .compact()
                .value();

            if (ready.length === 0) {
                throw "circular";
            }

            ret.push(...ready);

            each(ready, (r) => delete requisites[r]);
            each(requisites, (b) => pullAll(b!.requisites, ready));
        }

        return ret;
    };

    const elements = "abcdefghij".split("") as Element[];
    const element = fc.nat({ max: elements.length - 1 }).map((i) => elements[i]);
    const dependency = fc
        .tuple(element, element)
        .filter(([e1, e2]) => e1 !== e2)
        .map(([dependent, requisite]) => ({ dependent, requisite }));
    const dependencies = fc.set(dependency, { compare: isEqual });

    t.notThrows(() =>
        fc.assert(
            fc.property(dependencies, (deps) => {
                try {
                    const resolved = resolve(deps);

                    console.log(deps, resolved);

                    if (
                        !deps.every(
                            ({ dependent, requisite }) =>
                                resolved.some((e) => e === dependent) && resolved.some((e) => e === requisite)
                        )
                    ) {
                        return false;
                    }

                    if (
                        !deps.every(
                            ({ dependent, requisite }) => resolved.indexOf(dependent) > resolved.indexOf(requisite)
                        )
                    ) {
                        return false;
                    }

                    return true;
                } catch (e) {
                    if (/circular/.test(`${e}`)) {
                        return true;
                    }
                }

                return false;
            }),
            { verbose: true }
        )
    );
});

test("explore fast-check", (t) => {
    t.notThrows(() => fc.assert(fc.property(fc.string({ minLength: 1 }), (t0) => t0 !== "")));

    const thrown = t.throws(() => fc.assert(fc.property(fc.string({ minLength: 0 }), (t0) => t0 !== ""))).message;

    t.regex(thrown, /Counterexample.*\"\"/im);
});
