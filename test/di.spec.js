import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {expect} from 'chai';
import _ from 'lodash';

import {
    parseStringDefinition,
    normalizeDefinitions,
    normalizeDefinition,

    createContainer,
    extractModule,

    webpackResolver,
    staticResolver,
    arrayResolver,

    createInstanceFactory,
    createMethodFactory,
    createArrayFactory,

    then,
    all
} from '../index.js';

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

    describe('utils', function () {

        it('then work with sync return', function () {
            return then('test', function (data) {
                expect(data).to.equal('test');
            });
        });

        it('then work with async return', function () {
            return then(Promise.resolve('test'), function (data) {
                expect(data).to.equal('test');
            });
        });

        it('then work with null return', function () {
            return then(null, function (data) {
                expect(data).to.be.null;
            });
        });

        it('all work with sync return', function () {
            return all(['test1', 'test2'], function ([a, b]) {
                expect(a).to.equal('test1');
                expect(b).to.equal('test2');
            });
        });

        it('all work with async return', function () {
            return all([Promise.resolve('test1'), Promise.resolve('test2')], function ([a, b]) {
                expect(a).to.equal('test1');
                expect(b).to.equal('test2');
            });
        });

        it('all work with mixed return', function () {
            return all([Promise.resolve('test1'), 'test2'], function ([a, b]) {
                expect(a).to.equal('test1');
                expect(b).to.equal('test2');
            });
        });

        it('all work with mixed null return', function () {
            return all([null, 'test2'], function ([a, b]) {
                expect(a).to.be.null;
                expect(b).to.equal('test2');
            });
        });

    });

    describe('definition', function () {
        describe('parseStringDefinition', function () {
            it('correct parse simple module name', function () {
                var def = parseStringDefinition('test');

                expect(def).to.eql({
                    bundleName: 'test',
                    parentId: 'test',
                    update: undefined,
                    factory: undefined
                });
            });

            it('correct parse module name with factory', function () {
                var def = parseStringDefinition('test.produce');
                expect(def.bundleName).to.equal('test');
                expect(def.factory).to.be.equal('produce');
            });

            it('correct parse module name with update function', function () {
                var def = parseStringDefinition('test#update');
                expect(def.bundleName).to.equal('test');
                expect(def.update).to.be.equal('update');
            });

            it('correct parse module name with factory and update function', function () {
                var def = parseStringDefinition('test.produce#update');
                expect(def.bundleName).to.equal('test');
                expect(def.factory).to.be.equal('produce');
                expect(def.update).to.be.equal('update');
            });

            it('empty string produce error', function () {
                expect(_ => parseStringDefinition('')).to.throw(Error);
            });

            it('null produce error', function () {
                expect(_ => parseStringDefinition(null)).to.throw(Error);
            });
        });

        describe('normalizeDefinition', function () {
            it('alias string definition', function () {
                var def = normalizeDefinition('test', 'test');

                expect(def).to.eql({
                    id: 'test',
                    parentId: 'test',
                    bundleName: 'test',
                    factory: 'factory',
                    dependencies: {},
                    update: 'updateDependencies'
                });
            });

            it('alias string definition with factory', function () {
                var def = normalizeDefinition('test', 'test.produce');

                expect(def).to.eql({
                    id: 'test',
                    parentId: 'test.produce',
                    bundleName: 'test',
                    factory: 'produce',
                    dependencies: {},
                    update: 'updateDependencies'
                });
            });

            it('simple string definition with dependencies', function () {
                var def = normalizeDefinition('test', {
                    abc: 'abc'
                });

                expect(def).to.eql({
                    id: 'test',
                    parentId: 'test',
                    bundleName: 'test',
                    factory: 'factory',
                    dependencies: {
                        abc: 'abc'
                    },
                    update: 'updateDependencies'
                });
            });

            it('string definition with factory and dependencies', function () {
                var def = normalizeDefinition('test.produce', {
                    abc: 'abc'
                });

                expect(def).to.eql({
                    id: 'test.produce',
                    parentId: 'test.produce',
                    bundleName: 'test',
                    factory: 'produce',
                    dependencies: {
                        abc: 'abc'
                    },
                    update: 'updateDependencies'
                });
            });

            it('alias definition', function () {
                var def = normalizeDefinition('test', ['abc', {}]);

                expect(def).to.eql({
                    id: 'test',
                    parentId: 'abc',
                    bundleName: 'abc',
                    factory: 'factory',
                    dependencies: {},
                    update: 'updateDependencies'
                });
            });

            it('alias definition with factory', function () {
                var def = normalizeDefinition('test', ['abc.produce', {}]);

                expect(def).to.eql({
                    id: 'test',
                    parentId: 'abc.produce',
                    bundleName: 'abc',
                    factory: 'produce',
                    dependencies: {},
                    update: 'updateDependencies'
                });
            });

            it('full definition', function () {
                var def = normalizeDefinition('test', [{
                    bundleName: 'abc',
                    factory: 'produce',
                    dependencies: {
                        abc: 'abc'
                    }
                }]);

                expect(def.id).to.be.string;

                expect(_.omit(def, 'id')).to.eql({
                    bundleName: 'abc',
                    factory: 'produce',
                    dependencies: {
                        abc: 'abc'
                    },
                    update: 'updateDependencies'
                });
            });

            it('normalizeDefinitions', function () {
                var defs = normalizeDefinitions({
                    test1: 'test',
                    test: {
                        abc: 'abc.produce'
                    },
                    test2: ['test', {
                        abc: 'abc.factory'
                    }],
                    test3: {
                        bundleName: 'HelloWorld'
                    }
                });

                expect(defs).to.eql({
                    test1: {
                        id: 'test1',
                        parentId: 'test',
                        bundleName: 'test',
                        factory: 'factory',
                        dependencies: {abc: 'test/abc'},
                        update: 'updateDependencies'
                    },
                    test: {
                        id: 'test',
                        parentId: 'test',
                        bundleName: 'test',
                        factory: 'factory',
                        dependencies: {abc: 'test/abc'},
                        update: 'updateDependencies'
                    },
                    test2: {
                        id: 'test2',
                        parentId: 'test',
                        bundleName: 'test',
                        factory: 'factory',
                        dependencies: {abc: 'test2/abc'},
                        update: 'updateDependencies'
                    },
                    test3: {
                        id: 'test3',
                        parentId: 'test3',
                        bundleName: 'test3',
                        factory: 'factory',
                        dependencies: {bundleName: 'HelloWorld'},
                        update: 'updateDependencies'
                    },
                    HelloWorld: {
                        id: 'HelloWorld',
                        parentId: 'HelloWorld',
                        bundleName: 'HelloWorld',
                        factory: 'factory',
                        dependencies: {},
                        update: 'updateDependencies'
                    },
                    abc: {
                        id: 'abc',
                        parentId: 'abc',
                        bundleName: 'abc',
                        factory: 'factory',
                        dependencies: {},
                        update: 'updateDependencies'
                    },
                    'test/abc': {
                        id: 'test/abc',
                        parentId: 'abc',
                        bundleName: 'abc',
                        factory: 'produce',
                        dependencies: {},
                        update: 'updateDependencies'
                    },
                    'test2/abc': {
                        id: 'test2/abc',
                        parentId: 'abc',
                        bundleName: 'abc',
                        factory: 'factory',
                        dependencies: {},
                        update: 'updateDependencies'
                    }
                });
            });

            it('nesting definitions', function () {
                var defs = normalizeDefinitions({
                    test: 'Test',
                    user: ['User', {
                        test1: 'test',
                        test2: 'Test',
                        test3: 'Test.update',
                        test4: ['Test', {}],
                        test5: 'test.update'
                    }]
                });

                expect(defs).to.eql({
                    Test: {
                        bundleName: 'Test',
                        dependencies: {},
                        factory: 'factory',
                        id: 'Test',
                        parentId: 'Test',
                        update: 'updateDependencies'
                    },
                    test: {
                        bundleName: 'Test',
                        dependencies: {},
                        factory: 'factory',
                        id: 'test',
                        parentId: 'Test',
                        update: 'updateDependencies'
                    },
                    User: {
                        bundleName: 'User',
                        dependencies: {},
                        factory: 'factory',
                        id: 'User',
                        parentId: 'User',
                        update: 'updateDependencies'
                    },
                    user: {
                        bundleName: 'User',
                        dependencies: {
                            test1: 'test',
                            test2: 'Test',
                            test3: 'user/test3',
                            test4: 'user/test4',
                            test5: 'user/test5'
                        },
                        factory: 'factory',
                        id: 'user',
                        parentId: 'User',
                        update: 'updateDependencies'
                    },
                    'user/test3': {
                        bundleName: 'Test',
                        dependencies: {},
                        factory: 'update',
                        id: 'user/test3',
                        parentId: 'Test',
                        update: 'updateDependencies'
                    },
                    'user/test4': {
                        bundleName: 'Test',
                        dependencies: {},
                        factory: 'factory',
                        id: 'user/test4',
                        parentId: 'Test',
                        update: 'updateDependencies'
                    },
                    'user/test5': {
                        bundleName: 'Test',
                        dependencies: {},
                        factory: 'update',
                        id: 'user/test5',
                        parentId: 'test',
                        update: 'updateDependencies'
                    }
                });
            });

            it('nesting parenting', function () {
                var defs = normalizeDefinitions({
                    user: 'User.produce',
                    userDeps: ['user', {
                        abc: 'abc'
                    }],
                    userOverrideFactory: 'userDeps.overrided',
                    userOverrideUpdate: 'userOverrideFactory#update',
                    userOverrideDeps: ['userOverrideUpdate', {
                        cde: 'cde'
                    }]
                });

                expect(defs).to.eql({
                    User: {
                        id: 'User',
                        parentId: 'User',
                        bundleName: 'User',
                        factory: 'factory',
                        update: 'updateDependencies',
                        dependencies: {}
                    },
                    user: {
                        id: 'user',
                        parentId: 'User',
                        bundleName: 'User',
                        factory: 'produce',
                        update: 'updateDependencies',
                        dependencies: {}
                    },
                    userDeps: {
                        id: 'userDeps',
                        parentId: 'user',
                        bundleName: 'User',
                        factory: 'produce',
                        update: 'updateDependencies',
                        dependencies: {abc: 'abc'}
                    },
                    userOverrideFactory: {
                        id: 'userOverrideFactory',
                        parentId: 'userDeps',
                        bundleName: 'User',
                        factory: 'overrided',
                        update: 'updateDependencies',
                        dependencies: {abc: 'abc'}
                    },
                    userOverrideUpdate: {
                        id: 'userOverrideUpdate',
                        parentId: 'userOverrideFactory',
                        bundleName: 'User',
                        factory: 'overrided',
                        update: 'update',
                        dependencies: {abc: 'abc'}
                    },
                    userOverrideDeps: {
                        id: 'userOverrideDeps',
                        parentId: 'userOverrideUpdate',
                        bundleName: 'User',
                        factory: 'overrided',
                        update: 'update',
                        dependencies: {
                            abc: 'abc',
                            cde: 'cde'
                        }
                    },
                    abc: {
                        id: 'abc',
                        parentId: 'abc',
                        bundleName: 'abc',
                        factory: 'factory',
                        update: 'updateDependencies',
                        dependencies: {}
                    },
                    cde: {
                        id: 'cde',
                        parentId: 'cde',
                        bundleName: 'cde',
                        factory: 'factory',
                        update: 'updateDependencies',
                        dependencies: {}
                    }
                });
            });

            it('nesting parenting with null override', function () {
                var defs = normalizeDefinitions({
                    User: {
                        abc: 'abc'
                    },
                    user2: ['User', {
                        abc: null
                    }]
                });

                expect(defs).to.eql({
                    User: {
                        id: 'User',
                        parentId: 'User',
                        bundleName: 'User',
                        factory: 'factory',
                        update: 'updateDependencies',
                        dependencies: {
                            abc: 'abc'
                        }
                    },
                    user2: {
                        id: 'user2',
                        parentId: 'User',
                        bundleName: 'User',
                        factory: 'factory',
                        update: 'updateDependencies',
                        dependencies: {}
                    },
                    abc: {
                        id: 'abc',
                        parentId: 'abc',
                        bundleName: 'abc',
                        factory: 'factory',
                        update: 'updateDependencies',
                        dependencies: {}
                    }
                })
            });

            it('normalize dependencies', function () {
                var defs = normalizeDefinitions({
                    a: {
                        b: ['b.produce', {
                            c: 'c'
                        }],
                        d: {
                            c: 'c'
                        }
                    }
                });

                expect(defs.a.id).to.equal('a');
                expect(defs.a.dependencies.b).to.be.string;
                expect(defs.a.dependencies.d).to.be.string;

                expect(defs[defs.a.dependencies.b].dependencies.c).to.equal('c');
                expect(defs[defs.a.dependencies.d].dependencies.c).to.equal('c');
            });

            it('correct cycle parenting', function () {
                var defs = normalizeDefinitions({
                    User: 'User.produce',
                    User1: ['User1.produce', {
                        user: 'User'
                    }]
                });

                expect(defs).to.eql({
                    User: {
                        id: 'User',
                        parentId: 'User',
                        bundleName: 'User',
                        factory: 'produce',
                        update: 'updateDependencies',
                        dependencies: {}
                    },
                    User1: {
                        id: 'User1',
                        parentId: 'User1',
                        bundleName: 'User1',
                        factory: 'produce',
                        update: 'updateDependencies',
                        dependencies: {
                            user: 'User'
                        }
                    }
                });
            });
        });
    });

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
            var instance = factory({Module: Abc}, {abc: 123});
            expect(instance).to.be.instanceof(Abc);
            expect(instance.deps.abc).to.equal(123);
        });

        it('can create class with factory', function () {
            var instance = factory({Module: Abc, factory: 'producer'}, {abc: 123});
            expect(instance).to.be.instanceof(Abc);
            expect(instance.deps.data.abc).to.equal(123);
        });
    });

    describe('resolvers', function () {
        describe('static resolver', function () {
            it('can resolve module', function () {
                let resolve = staticResolver({
                    A: A
                });

                expect(resolve('A')).to.equal(A);
                expect(resolve('B')).to.be.undefined;
            });
        });

        describe('array resolver', function () {
            it('can resolve module', function () {
                let resolve = arrayResolver([
                    staticResolver({A: A}),
                    staticResolver({B: B})
                ]);

                expect(resolve('A')).to.equal(A);
                expect(resolve('B')).to.equal(B);
                expect(resolve('C')).to.be.undefined;
            });
        });

        describe('webpack resolver', function () {

            it('sync', function () {
                let bundles = {
                    './bundle/name/A.js': A,
                    './other/B.js': B
                };

                let requireMock = function (name) {
                    return bundles[name];
                };

                requireMock.keys = _=> Object.keys(bundles);

                let resolve = webpackResolver([requireMock])

                expect(resolve('A')).to.equal(A);
                expect(resolve('B')).to.equal(B);
                expect(resolve('C')).to.be.undefined;
            });

            it('async', function () {
                let bundles = {
                    './bundle/name/A.js': A,
                    './other/B.js': B
                };

                let requireMock = function (name) {
                    return function (callback) {
                        setTimeout(_ => callback(bundles[name]));
                    };
                };

                requireMock.keys = _=> Object.keys(bundles);

                let resolve = webpackResolver([requireMock])

                return Promise.all([
                    resolve('A'),
                    resolve('B'),
                    resolve('C')
                ]).then(([A, B, C]) => {
                    expect(A).to.equal(A);
                    expect(B).to.equal(B);
                    expect(C).to.be.undefined;
                });
            });

        });
    });

    describe('container', function () {

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

        it('run update dependencies method on every instance', function () {
            let di = createContainer({
                resolvers: [
                    staticResolver({
                        test: function () {
                            this.invoke = 0;
                            this.name = 'test';
                            this.update = function (deps) {
                                this.invoke++;
                                this.deps = deps;
                            };
                        },
                        dep1: function () {
                            this.name = 'dep1';
                        }
                    })
                ],
                dependencies: {
                    test1: ['test#update', {
                        dep: 'dep1'
                    }]
                }
            });

            let instance = di('test1');

            expect(instance.name).to.equal('test');
            expect(instance.invoke).to.equal(1);
            expect(instance.deps.dep.name).to.equal('dep1');
        });

        it('use instance from #update, when it have the same type', function () {
            let instance2 = {
                update: function () {
                }
            };
            let instance1 = {
                update: function () {
                    if (this.invoked) {
                        return instance2;
                    } else {
                        this.invoked = true;
                    }
                }
            };

            let di = createContainer({
                resolvers: [
                    staticResolver({
                        test: function () {
                            return instance1
                        }
                    })
                ],
                dependencies: {
                    test1: ['test#update']
                }
            });

            let session = di.session();
            expect(session('test1')).to.equal(instance1);
            expect(session('test1')).to.equal(instance1);
            session.close();

            let session2 = di.session();
            expect(session2('test1')).to.equal(instance2);
            expect(session2('test1')).to.equal(instance2);
        });

        it('do not use instance from #update, when it have other type', function () {
            let instance2 = new function () {
            };

            let instance1 = new function () {
                this.update = function () {
                    return instance2;
                }
            };

            let di = createContainer({
                resolvers: [
                    staticResolver({
                        test: function () {
                            return instance1
                        }
                    })
                ],
                dependencies: {
                    test1: ['test#update']
                }
            });

            expect(di('test1')).to.equal(instance1);
        });

        describe('#update previous instance', function () {
            class TestInstance {
                constructor(id) {
                    this.id = id;
                    this.destroyed = false;
                }

                destroy() {
                    this.destroyed = true;
                }

                update() {
                    if (this.invoked) {
                        return new TestInstance(this.id + 1);
                    } else {
                        this.invoked = true;
                    }
                }

                error() {
                    throw new Error();
                }
            }

            it('should be destroyed', function () {
                let di = createContainer({
                    resolvers: [
                        staticResolver({
                            test: () => new TestInstance(1)
                        })
                    ],
                    dependencies: {
                        test: ['test#update']
                    }
                });

                let session1 = di.session();
                let testInstance1 = session1('test');
                expect(testInstance1.id).to.equal(1);
                session1.close();

                let session2 = di.session();
                let testInstance2 = session2('test');
                expect(testInstance2.id).to.equal(2);
                session2.close();

                expect(testInstance1.destroyed).to.be.true;
                expect(testInstance2.destroyed).to.be.false;
            });

            it('should not be destroy instance after next update when #update method not implemented', function () {
                let di = createContainer({
                    resolvers: [
                        staticResolver({
                            test: {
                                factory: function ({dep1}) {
                                    return [
                                        {id: 1, source: dep1}
                                    ];
                                }
                            },
                            dep1: function () {
                                this.name = 'dep1';

                                this.destroy = function () {
                                    this.name = null;
                                }
                            }
                        })
                    ],
                    dependencies: {
                        test: ['test', {
                            dep1: 'dep1',
                        }]
                    }
                });

                let session1 = di.session();
                let testInstance1 = session1('test');
                session1.close();

                let session2 = di.session();
                let testInstance2 = session2('test');
                session2.close();

                let session3 = di.session();
                let testInstance3 = session3('test');
                session3.close();

                expect(testInstance1).to.equal(testInstance2);
                expect(testInstance2).to.equal(testInstance3);

                expect(testInstance2[0].source).to.equal(testInstance3[0].source);
                expect(testInstance2[0].source.name).to.equal('dep1');
            });

            it('should not be destroyed, when error was in pipe', function () {
                let di = createContainer({
                    resolvers: [
                        staticResolver({
                            TestInstance: TestInstance
                        })
                    ],
                    dependencies: {
                        test: 'TestInstance#update',
                        test2: ['TestInstance#error', {
                            test: 'test'
                        }]
                    }
                });

                let session1 = di.session();
                let testInstance1 = di('test');
                session1.close();

                let session2 = di.session();
                let testInstance2 = di('test');

                return di('test2').then(
                    () => {
                        throw new Error()
                    },
                    () => {
                        expect(testInstance1).not.to.equal(testInstance2);
                        expect(testInstance1.destroyed).to.be.false;
                        expect(testInstance2.destroyed).to.be.false;
                        session2.close();
                        expect(testInstance1.destroyed).to.be.true;
                        expect(testInstance2.destroyed).to.be.false;
                    }
                );
            });

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

        it('has all methods as parent', function () {
            di = createContainer();
            let session = di.session();

            expect(session.put).not.to.be.undefined;
            expect(session.session).not.to.be.undefined;
            expect(session.serialize).not.to.be.undefined;
        });

        it('can pass default params to every dependency', function () {
            di = createContainer({
                resolvers: [
                    staticResolver({
                        a: function (deps) {
                            this.name = 'a';
                            this.deps = deps;
                        }
                    })
                ]
            });

            let session = di.session({abc: 1});
            let a = session('a');

            expect(a.name).to.equal('a');
            expect(a.deps.abc).to.equal(1);
        });
    });

    describe('unnamed dependencies', function () {

        it('simple unnamed', function () {
            di = createContainer({
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
            di = createContainer({
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

    describe('serialization', function () {
        beforeEach(function () {
            var Cls = function (data) {
                this.data = data;

                this.serialize = function () {
                    return {
                        test: 123
                    };
                };
            };

            di = createContainer({
                resolvers: [
                    staticResolver({
                        a: {
                            factory: function () {
                                return new Cls();
                            },
                            restore: function (data) {
                                return new Cls(data);
                            }
                        }
                    })
                ],
                dependencies: {}
            });
        });

        it('must serialize to object', function () {
            di('a');

            expect(di.serialize()).to.eql({a: {test: 123}});
        });

        it('must restore from object', function () {
            di.restore({a: {test: 123}});

            expect(di('a').data).to.eql({test: 123});
        });

    });

    describe('destroy', function () {

        beforeEach(function () {
            di = createContainer({
                resolvers: [
                    staticResolver({
                        validModule: function () {

                        }
                    })
                ]
            });
        });

        it('destroy all instances', function () {
            let instance = di('validModule');
            expect(di.getDefinition('validModule').instance).to.equal(instance);

            di.destroy();
            expect(di.getDefinition('validModule').instance).to.equal(null);
        });

    });

    describe('clone', function () {

        beforeEach(function () {
            di = createContainer({
                resolvers: [
                    staticResolver({
                        validModule: function () {

                        }
                    })
                ]
            });
        });

        it('without instances', function () {
            let instance = di('validModule');
            let clone = di.clone();

            expect(di.getDefinition('validModule').instance).to.equal(instance);
            expect(clone.getDefinition('validModule').instance).to.equal(undefined);
        });

        it('with instances', function () {
            let instance = di('validModule');
            let clone = di.clone({cloneInstances: true});

            expect(di.getDefinition('validModule').instance).to.equal(instance);
            expect(clone.getDefinition('validModule').instance).to.equal(instance);
        });

        it('definition is not shared', function () {
            di.getDefinition('validModule').abc = 1;

            let clone = di.clone({cloneInstances: true});
            clone.getDefinition('validModule').abc = 2;

            expect(di.getDefinition('validModule').abc).to.equal(1);
        });

        it('definition dependencies is not shared', function () {
            var sourceDefinition = di.getDefinition('validModule');
            let clone = di.clone({cloneInstances: true});

            expect(clone.getDefinition('validModule').dependencies).not.to.equal(sourceDefinition.dependencies);
        });

    });

    describe('extract module', function () {
        it('extract simple module', function () {
            var module = () => {
            };
            expect(extractModule(module)).to.equal(module);
        });

        it('extract simple module (object)', function () {
            var module = {};
            expect(extractModule(module)).to.equal(module);
        });

        it('extract es6 module', function () {
            var module = {
                __esModule: true, SomeModule: () => {
                }
            };
            expect(extractModule(module)).to.equal(module.SomeModule);
        });

        it('extract es6 module (object)', function () {
            var module = {__esModule: true, SomeModule: {}};
            expect(extractModule(module)).to.equal(module.SomeModule);
        });

        it('extract es6 module with additional not Class exports', function () {
            var module = {
                __esModule: true, abc: 12, SomeModule: () => {
                }
            };
            expect(extractModule(module)).to.equal(module.SomeModule);
        });
    });

    describe('definition by instance', function () {
        let inst1, inst2;

        beforeEach(function () {
            inst1 = {};
            inst2 = {};

            di = createContainer({
                resolvers: []
            });

            di.put('inst1', inst1);
        });

        it('return definition by instance', function () {
            expect(di.getInstanceDefinition(inst1).instance).to.equal(inst1);
            expect(di.getInstanceDefinition(inst2)).to.equal(undefined);
        });

        it('destroy links after destroy container', function () {
            di.destroy();
            expect(di.getInstanceDefinition(inst1)).to.equal(undefined);
        });

    });

    describe('error handling', function () {
        beforeEach(function () {
            let count = 0;

            di = createContainer({
                resolvers: [
                    staticResolver({
                        syncModule: {
                            factory: () => {
                                throw new Error('sync error')
                            }
                        },
                        asyncModule: {
                            factory: () => {
                                return Promise.reject(new Error('async error'));
                            }
                        },
                        emptyFactory: {
                            factory: () => {

                            }
                        },
                        notValidModule: 12,
                        validModule: function () {

                        },
                        workOnSecond: () => {
                            if (!count) {
                                count++;
                                throw new Error('Try again');
                            }
                            return {};
                        }
                    })
                ]
            });
        });

        it('can handle sync errors as promise reject', function () {
            return expect(di('syncModule')).to.eventually.be.rejectedWith(Error, 'sync error');
        });

        it('can handle async errors as promise reject', function () {
            return expect(di('asyncModule')).to.eventually.be.rejectedWith(Error, 'async error');
        });

        it('can handle error when load unknown modules', function () {
            return expect(di('UnknownModule')).to.eventually.be.rejectedWith(Error, 'Error: Cannot find bundle with name "UnknownModule"');
        });

        it('can handle error when factory return nothing', function () {
            return expect(di('emptyFactory')).to.eventually.be.rejectedWith(Error, 'Error: Factory "emptyFactory.factory" return instance of undefined type');
        });

        it('can handle error when module is not valid', function () {
            return expect(di('notValidModule')).to.eventually.be.rejectedWith(Error, 'Error: Module "notValidModule" cannot be constructed, because has number type');
        });

        it('can handle error when factory not found', function () {
            return expect(di('validModule.produce')).to.eventually.be.rejectedWith(Error, 'Error: Module "validModule.produce" has no factory with name "produce"');
        });

        it('can handle error when update not found', function () {
            return expect(di('validModule#update')).to.eventually.be.rejectedWith(Error, 'Error: Module "validModule#update" has no instance method with name "update"');
        });

        it('allow reconstruct failed instance', function () {
            return expect(di('workOnSecond')).to.eventually.be.rejectedWith(Error, 'Error: Try again').then(() => {
                return expect(di('workOnSecond')).to.be.eql({});
            });
        });
    });

})
;
