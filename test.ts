import test from "ava";
import * as fc from "fast-check";
import { chain, each, isEmpty, isEqual, pullAll } from "lodash";

test.serial("resolve", (t) => {
    type Element = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j";
    // https://english.stackexchange.com/questions/25575/what-is-the-correct-word-for-dependee
    // the dependent depends on / requires the requisite
    type Dependency = { dependent: Element; requisite: Element };

    const resolve = (deps: Dependency[]): Element[] => {
        const aggregate: { [key in Element]?: { dependent: Element; allRequisites: Element[] } } = {};

        deps.forEach(({ dependent, requisite }) => {
            const empty = (e: Element) => ({ dependent: e, allRequisites: [] });
            (aggregate[dependent] ??= empty(dependent)).allRequisites.push(requisite);
            aggregate[requisite] ??= empty(requisite);
        });

        const ret: Element[] = [];
        const expectedLength = chain(deps)
            .map(({ dependent, requisite }) => [dependent, requisite])
            .flatten()
            .uniq()
            .value().length;

        while (ret.length < expectedLength) {
            const ready = chain(aggregate)
                .filter((b) => isEmpty(b?.allRequisites))
                .map((b) => b?.dependent)
                .compact()
                .value();

            if (ready.length === 0) {
                throw "circular";
            }

            ret.push(...ready);

            each(ready, (r) => delete aggregate[r]);
            each(aggregate, (b) => pullAll(b!.allRequisites, ready));
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

                    return deps.every(
                        ({ dependent, requisite }) =>
                            resolved.some((e) => e === dependent) &&
                            resolved.some((e) => e === requisite) &&
                            resolved.indexOf(dependent) > resolved.indexOf(requisite)
                    );
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
