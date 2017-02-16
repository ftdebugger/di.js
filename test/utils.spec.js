import {expect} from 'chai'
import {all, then} from '../index';

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
