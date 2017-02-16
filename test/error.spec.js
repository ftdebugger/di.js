import {expect} from 'chai';
import chaiAsPromised from 'chai-as-promised';

import {createContainer, staticResolver} from '../index';

describe('error handling', function () {
    let di;

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
