import {expect} from 'chai';

import {createContainer, staticResolver} from '../index';

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

        let instance = di('a');

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

    it('can build reuses', function () {
        let counter = 0;
        let di = createContainer({
            resolvers: [
                staticResolver({
                    a: function (deps) {
                        this.updateDependencies = deps => {
                            this.deps = deps;
                        }
                    },
                    b: function () {
                        this.name = 'b';
                    },
                    c: function () {
                        this.name = 'c';
                    }
                })
            ],
            dependencies: {
                a1: ['!a', {
                    b: 'b'
                }],
                a2: ['!a', {
                    c: 'c'
                }]
            }
        });

        let a1 = di('a1');
        expect(a1.deps.b.name).to.equal('b');
        expect(a1.deps.c).to.equal(undefined);
        let a2 = di('a2');
        expect(a1.deps.b).to.equal(undefined);
        expect(a2.deps.c.name).to.equal('c');

        expect(a1).to.equal(a2);

        let a = di('a');

        expect(a).to.equal(a1);
        expect(a).to.equal(a2);
    });

    it('can build aliased reuses', function () {
        let di = createContainer({
            resolvers: [
                staticResolver({
                    Document: function () {
                        this.name = 'doc';
                    }
                })
            ],
            dependencies: {
                document: '!Document',
                pageA: ['document'],
                pageB: ['document']
            }
        });

        let pageA = di('pageA');
        expect(pageA.name).to.equal('doc');
        let pageB = di('pageB');

        expect(pageA).to.equal(pageB);
    });

    it('can build reuses with different update functions', function () {
        let di = createContainer({
            resolvers: [
                staticResolver({
                    a: function () {
                        this.updateWithAssign = deps => {
                            this.deps = deps;
                        };
                        this.update = () => {
                        };
                    },
                    b: function () {
                        this.name = 'b';
                    },
                    c: function () {
                        this.name = 'c';
                    }
                })
            ],
            dependencies: {
                a1: ['!a#updateWithAssign', {
                    b: 'b'
                }],
                a2: ['!a#update', {
                    b: 'c'
                }]
            }
        });

        let a1 = di('a1');
        expect(a1.deps.b.name).to.equal('b');
        let a2 = di('a2');
        expect(a1.deps.b.name).to.equal('b');
        expect(a1).to.equal(a2);
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
