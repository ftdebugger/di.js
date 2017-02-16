import {expect} from 'chai';

import {createContainer, staticResolver} from '../index';

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

    describe('reuse with sessions', function () {
        let di, isDestroyed;

        beforeEach(function () {
            isDestroyed = false;
            di = createContainer({
                resolvers: [
                    staticResolver({
                        a: function () {
                            this.destroy = () => {
                                isDestroyed = true;
                            }
                        }
                    })
                ],
                dependencies: {
                    a1: ['!a', {}],
                    a2: ['!a', {}]
                }
            });
        });

        it('not destroy reuse instance which in use', function () {
            let session1 = di.session();
            let a1 = session1('a1');
            session1.close();

            let session2 = di.session();
            let a2 = session2('a2');
            session2.close();

            expect(a1).to.equal(a2);
            expect(isDestroyed).to.equal(false);
        });

        it('destroy reuse if not in use', function () {
            let session1 = di.session();
            let a1 = session1('a1');
            session1.close();

            di.session().close();

            expect(isDestroyed).to.equal(true);
            expect(di.getDefinition('a').instance).to.equal(null);
            expect(di.getDefinition('a1').instance).to.equal(null);
        });

        it('can recreate after destroy', function () {
            let session1 = di.session();
            let a1 = session1('a1');
            session1.close();

            di.session().close();

            let session2 = di.session();
            let a2 = session2('a1');
            session2.close();

            expect(a1).not.to.equal(a2);
        });
    });

});
