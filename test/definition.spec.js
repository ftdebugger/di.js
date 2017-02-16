import {expect} from 'chai';
import _ from 'lodash';

import {normalizeDefinition, normalizeDefinitions, parseStringDefinition} from '../index';

describe('definition', function () {
    describe('parseStringDefinition', function () {
        it('correct parse simple module name', function () {
            let def = parseStringDefinition('test');

            expect(def).to.eql({
                bundleName: 'test',
                parentId: 'test',
                update: undefined,
                factory: undefined
            });
        });

        it('correct parse module name with factory', function () {
            let def = parseStringDefinition('test.produce');
            expect(def.bundleName).to.equal('test');
            expect(def.factory).to.be.equal('produce');
        });

        it('correct parse module name with update function', function () {
            let def = parseStringDefinition('test#update');
            expect(def.bundleName).to.equal('test');
            expect(def.update).to.be.equal('update');
        });

        it('correct parse module name with factory and update function', function () {
            let def = parseStringDefinition('test.produce#update');
            expect(def.bundleName).to.equal('test');
            expect(def.factory).to.be.equal('produce');
            expect(def.update).to.be.equal('update');
        });

        it('parse reuse', function () {
            let def = parseStringDefinition('!User');
            expect(def.bundleName).to.equal(undefined);
            expect(def.factory).to.be.equal(undefined);
            expect(def.update).to.be.equal(undefined);
            expect(def.reuse).to.be.equal('User');
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
            let def = normalizeDefinition('test', 'test');

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
            let def = normalizeDefinition('test', 'test.produce');

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
            let def = normalizeDefinition('test', {
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
            let def = normalizeDefinition('test.produce', {
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
            let def = normalizeDefinition('test', ['abc', {}]);

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
            let def = normalizeDefinition('test', ['abc.produce', {}]);

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
            let def = normalizeDefinition('test', [{
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

        it('normalize reuse', function () {
            let def = normalizeDefinition('test', ['!User', {
                test: 'test'
            }]);

            expect(def).to.eql({
                dependencies: {
                    test: 'test'
                },
                id: 'test',
                reuse: 'User'
            });
        });

        it('normalizeDefinitions', function () {
            let defs = normalizeDefinitions({
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
            let defs = normalizeDefinitions({
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
            let defs = normalizeDefinitions({
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
            let defs = normalizeDefinitions({
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
            let defs = normalizeDefinitions({
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
            let defs = normalizeDefinitions({
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

        it('parse instance reuse', function () {
            let defs = normalizeDefinitions({
                User1: ['!User', {
                    test: 'Test'
                }]
            });

            expect(JSON.parse(JSON.stringify(defs))).to.eql({
                "Test": {
                    "bundleName": "Test",
                    "dependencies": {},
                    "factory": "factory",
                    "id": "Test",
                    "parentId": "Test",
                    "update": "updateDependencies"
                },
                "User": {
                    "bundleName": "User",
                    "dependencies": {},
                    "factory": "factory",
                    "id": "User",
                    "parentId": "User",
                    "update": "updateDependencies"
                },
                "User1": {
                    "dependencies": {
                        "test": "Test"
                    },
                    "id": "User1",
                    "parentId": "User1",
                    "reuse": "User"
                }
            })
        });
    });
});
