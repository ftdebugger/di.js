import {expect} from 'chai';

import {createContainer, staticResolver} from '../index';

describe('update dependencies', function () {
    let di;

    class A {
        updateDependencies(deps) {
            this.deps = deps;
        }
    }

    class B {
        constructor(deps) {
            this.deps = deps;
        }

        updateDependencies(deps) {
            return new B(deps);
        }
    }

    class C {
    }

    beforeEach(function () {
        di = createContainer({
            resolvers: [
                staticResolver({A, B, C})
            ],
            dependencies: {
                reuseA: ['!A', {b: 'B', c: 'C'}],
                reuseB1: ['!B', {a: 'A'}],
                reuseB2: ['!B', {c: 'C'}]
            }
        });
    });

    it('update reuse without instance recreation', function () {
        let session1 = di.session();
        let a1 = session1('reuseA'),
            b1 = a1.deps.b,
            c1 = a1.deps.c;
        session1.close();

        let session2 = di.session();
        let a2 = session2('reuseA'),
            b2 = a2.deps.b,
            c2 = a2.deps.c;
        session2.close();

        expect(a1).to.equal(a2);
        expect(b1).not.to.equal(b2);
        expect(c1).to.equal(c2);
    });

    it('update reuse with instance recreation', function () {
        let session1 = di.session();
        let b1 = session1('reuseB1'),
            a1 = b1.deps.a,
            c1 = b1.deps.c;
        session1.close();

        let session2 = di.session();
        let b2 = session2('reuseB1'),
            a2 = b2.deps.a,
            c2 = b2.deps.c;
        session2.close();

        let session3 = di.session();
        let b3 = session3('reuseB2'),
            a3 = b3.deps.a,
            c3 = b3.deps.c;
        session3.close();

        expect(b1).not.to.equal(b2);
        expect(b1).not.to.equal(b3);
        expect(b2).not.to.equal(b3);

        expect(a1).not.to.be.undefined;
        expect(c1).to.be.undefined;

        expect(a2).not.to.be.undefined;
        expect(c2).to.be.undefined;

        expect(a1).to.equal(a2);

        expect(a3).to.be.undefined;
        expect(c3).not.to.be.undefined;

        expect(di.getDefinition('B').instance).not.to.equal(b1);
        expect(di.getDefinition('B').instance).not.to.equal(b2);
        expect(di.getDefinition('B').instance).to.equal(b3);
    });

});
