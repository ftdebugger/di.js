import {expect} from 'chai';

import {createContainer, staticResolver} from '../index';

describe('unnamed dependencies', function () {
    it('simple unnamed', function () {
        let di = createContainer({
            resolvers: [
                staticResolver({
                    a: function (deps) {
                        this.name = 'a';
                        this.deps = deps;
                    },
                    b: {
                        first: function (deps) {
                            return {name: 'b', deps};
                        }
                    },
                    c: function () {
                        return {name: 'c'};
                    }
                })
            ],
            dependencies: {
                a: {
                    b: ['b.first', {c: 'c'}]
                }
            }
        });

        let instance = di('a');
        expect(instance.name).to.equal('a');
        expect(instance.deps.b.name).to.equal('b');
        expect(instance.deps.b.deps.c.name).to.equal('c');
    });

    it('different unnamed deps instances', function () {
        let di = createContainer({
            resolvers: [
                staticResolver({
                    a: function (deps) {
                        this.name = 'a';
                        this.deps = deps;
                    },
                    b: {
                        first: function (deps) {
                            return {name: 'b', deps};
                        }
                    },
                    c: function () {
                        return {name: 'c'};
                    }
                })
            ],
            dependencies: {
                a: {
                    b: ['b.first', {c: 'c'}],
                    d: ['b.first', {c: 'c'}]
                }
            }
        });

        let instance = di('a');
        expect(instance.deps.b).not.to.equal(instance.deps.d);
        expect(instance.deps.b.deps.c).to.equal(instance.deps.d.deps.c);
    });

});
