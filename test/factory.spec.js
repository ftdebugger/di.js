import {expect} from 'chai';

import {
    createMethodFactory,
    createInstanceFactory,
    createArrayFactory
} from '../index';

describe('factory', function () {
    let factory = createArrayFactory([
        createMethodFactory(),
        createInstanceFactory()
    ]);

    class Abc {
        constructor(deps) {
            this.deps = deps;
        }

        static producer(deps) {
            return new this({data: deps});
        }
    }

    it('can create class without factory', function () {
        let instance = factory({Module: Abc}, {abc: 123});
        expect(instance).to.be.instanceof(Abc);
        expect(instance.deps.abc).to.equal(123);
    });

    it('can create class with factory', function () {
        let instance = factory({Module: Abc, factory: 'producer'}, {abc: 123});
        expect(instance).to.be.instanceof(Abc);
        expect(instance.deps.data.abc).to.equal(123);
    });
});
