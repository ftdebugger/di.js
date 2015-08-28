import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {expect} from 'chai';

import {createContainer, staticResolver} from '../index.js';
//import {createContainer, staticResolver} from '../build/di.es5.min.js';

chai.use(chaiAsPromised);

describe('DI', function () {
    var di;

    class A {
    }

    class B {
        constructor({a}) {
            this.a = a;
        }
    }

    it('can create empty container', function () {
        expect(createContainer()).to.be.function;
    });

    it('can put item to container manually', function () {
        let di = createContainer(),
            config = {};

        di.put('config', config);

        expect(di('config')).to.equal(config);
    });

    it('can resolve static bundle', function () {
        let di = createContainer({
            resolvers: [
                staticResolver({
                    test: function () {
                    }
                })
            ]
        });

        expect(di('test')).to.be.defined;
    });

    it('can resolve sync dependencies', function () {
        let di = createContainer({
            resolvers: [
                staticResolver({
                    a: function (deps) {
                        this.name = 'a';
                        this.deps = deps;
                    },
                    b: function () {
                        this.name = 'b';
                    }
                })
            ],
            dependencies: {
                a: {
                    b: 'b'
                }
            }
        });

        var instance = di('a');

        expect(instance.name).to.equal('a');
        expect(instance.deps.b.name).to.equal('b');
    });

    it('can resolve async dependencies', function () {
        let di = createContainer({
            resolvers: [
                staticResolver({
                    a: function (deps) {
                        this.name = 'a';
                        this.deps = deps;
                    },
                    b: {
                        factory: function () {
                            return new Promise(resolve => {
                                setTimeout(_ => resolve({name: 'b'}));
                            });
                        }
                    }
                })
            ],
            dependencies: {
                a: {
                    b: 'b'
                }
            }
        });

        return di('a').then(instance => {
            expect(instance.name).to.equal('a');
            expect(instance.deps.b.name).to.equal('b');
        });
    });

    it('can build instance with another factory method', function () {
        let di = createContainer({
            resolvers: [
                staticResolver({
                    a: function (deps) {
                        this.name = 'a';
                        this.deps = deps;
                    },
                    b: {
                        otherFactory: function () {
                            return new Promise(resolve => {
                                setTimeout(_ => resolve({name: 'b'}));
                            });
                        }
                    }
                })
            ],
            dependencies: {
                a: {
                    b: 'b.otherFactory'
                }
            }
        });

        return di('a').then(instance => {
            expect(instance.name).to.equal('a');
            expect(instance.deps.b.name).to.equal('b');
        });
    });

    it('can resolve aliases', function () {
        let di = createContainer({
            resolvers: [
                staticResolver({
                    a: function (deps) {
                        this.name = 'a';
                        this.deps = deps;
                    },
                    b: {
                        otherFactory: function () {
                            return new Promise(resolve => {
                                setTimeout(_ => resolve({name: 'b'}));
                            });
                        }
                    }
                })
            ],
            dependencies: {
                test: ['a', {
                    b: 'b.otherFactory'
                }]
            }
        });

        return di('test').then(instance => {
            expect(instance.name).to.equal('a');
            expect(instance.deps.b.name).to.equal('b');
        });
    });

    describe('sessions', function () {
        let di;

        it('can create sessions', function () {
            di = createContainer({
                resolvers: [
                    staticResolver({
                        a: function (deps) {
                            this.name = 'a';
                            this.deps = deps;
                        },
                        b: {
                            first: function (deps) {
                                return {
                                    deps: deps,
                                    destroy: function () {
                                        deps.resolve();
                                    }
                                }
                            },
                            second: function () {
                                return {};
                            }
                        }
                    })
                ],
                dependencies: {
                    test1: ['a', {
                        b: 'b.first'
                    }],
                    test2: ['a', {
                        b: 'b.second'
                    }],
                    'b.first': {
                        resolve: 'resolve'
                    }
                }
            });

            return new Promise(resolve => {
                di.put('resolve', resolve);

                let session = di.session();
                session.load('test1');
                session.close();

                session = di.session();
                session.load('test2');
                session.close();
            });
        });
    });

});
