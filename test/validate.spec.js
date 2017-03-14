import {expect} from 'chai';

import {createContainer, staticResolver} from '../index';

describe('validate instances', function () {
    let di;

    class A {
        destroy() {
            this.destroyed = true;
        }

        isInstanceValid() {
            return !this.destroyed;
        }

        updateDependencies(deps) {
            this.deps = deps;
        }
    }

    class B {

    }

    class C {
        isInstanceValid(params) {
            return params.event.name !== 'profile';
        }


        updateDependencies(deps) {
            this.deps = deps;
        }
    }

    beforeEach(function () {
        di = createContainer({
            resolvers: [
                staticResolver({A, B, C})
            ],
            dependencies: {
                a: ['A', {b: 'B'}],
                c: ['C', {b: 'B'}]
            }
        });
    });

    it('create new instance in case if previous is invalid', function () {
        let session1 = di.session();
        let a1 = session1('a'),
            b1 = a1.deps.b;

        a1.destroy();

        session1.close();

        let session2 = di.session();
        let a2 = session2('a'),
            b2 = a2.deps.b;

        session2.close();

        expect(a1).to.not.equal(a2);
        expect(b1).to.equal(b2);
    });

    it('create new instance in case if previous is invalid in single session', function () {
        let session1 = di.session();
        let a1 = session1('a'),
            b1 = a1.deps.b;

        a1.destroy();

        let a2 = session1('a'),
            b2 = a2.deps.b;

        session1.close();

        expect(a1).to.not.equal(a2);
        expect(b1).to.equal(b2);
    });

    it('do not create new instance in case if previous is valid', function () {
        let session1 = di.session();
        let a1 = session1('a'),
            b1 = a1.deps.b;

        session1.close();

        let session2 = di.session();
        let a2 = session2('a'),
            b2 = a2.deps.b;

        session2.close();

        expect(a1).to.equal(a2);
        expect(b1).to.equal(b2);
    });

    it('do not create new instance in case if previous is valid in single session', function () {
        let session1 = di.session();
        let a1 = session1('a'),
            b1 = a1.deps.b;

        let a2 = session1('a'),
            b2 = a2.deps.b;

        session1.close();

        expect(a1).to.equal(a2);
        expect(b1).to.equal(b2);
    });

    it('check params from session and create new instance', function () {
        let session1 = di.session({event: {name: 'home'}});
        let c1 = session1('c'),
            b1 = c1.deps.b;

        let session2 = di.session({event: {name: 'profile'}});
        let c2 = session2('c'),
            b2 = c2.deps.b;

        session2.close();

        expect(c1).to.not.equal(c2);
        expect(b1).to.equal(b2);
    });

    it('check params from session and do not create new instance', function () {
        let session1 = di.session({event: {name: 'home'}});
        let c1 = session1('c'),
            b1 = c1.deps.b;

        let session2 = di.session({event: {name: 'search'}});
        let c2 = session2('c'),
            b2 = c2.deps.b;

        session2.close();

        expect(c1).to.equal(c2);
        expect(b1).to.equal(b2);
    });

});
