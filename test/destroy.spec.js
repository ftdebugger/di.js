import {expect} from 'chai';

import {createContainer, staticResolver} from '../index';

describe('destroy', function () {
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

    it('destroy all instances', function () {
        let instance = di('validModule');
        expect(di.getDefinition('validModule').instance).to.equal(instance);

        di.destroy();
        expect(di.getDefinition('validModule').instance).to.equal(null);
    });

});
