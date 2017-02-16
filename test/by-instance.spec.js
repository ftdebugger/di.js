import {expect} from 'chai';

import {createContainer} from '../index';

describe('definition by instance', function () {
    let inst1, inst2, di;

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
