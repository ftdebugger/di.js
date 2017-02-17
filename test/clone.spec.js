import {expect} from 'chai';

import {createContainer, staticResolver} from '../index';

describe('clone', function () {
    let di;

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
        let sourceDefinition = di.getDefinition('validModule');
        let clone = di.clone({cloneInstances: true});

        expect(clone.getDefinition('validModule').dependencies).not.to.equal(sourceDefinition.dependencies);
    });

    it('clones reuse', function () {
        let di = createContainer({
            dependencies: {
                a: 'a',
                b: '!a'
            }
        });
        let definitions = di.getDefinitions();
        let newDefinitions = di.clone().getDefinitions();

        expect(definitions).not.equal(newDefinitions);
        expect(definitions.b.__proto__).eql(definitions.a);
        expect(newDefinitions.b.__proto__).eql(newDefinitions.a);
    });

    it('clone static dependencies', function () {
        let di = createContainer({
            dependencies: {
                User: {
                    static: {
                        abc: 1
                    }
                }
            }
        });

        let clone = di.clone();
        expect(clone.getDefinition('User').static).to.eql({abc: 1});
    });

    it('clone static dependencies with same config', function () {
        let config = {
            dependencies: {
                User: {
                    static: {
                        abc: 1
                    }
                }
            }
        };

        let di = createContainer(config);
        let diClone = createContainer(config);

        expect(di.getDefinition('User').static).to.eql({abc: 1});
        expect(diClone.getDefinition('User').static).to.eql({abc: 1});
    });

});
