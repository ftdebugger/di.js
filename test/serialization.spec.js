import {expect} from 'chai';

import {createContainer, staticResolver} from '../index';

describe('serialization', function () {
    let di;

    beforeEach(function () {
        let Cls = function (data) {
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
            dependencies: {
                b: '!a'
            }
        });
    });

    it('must serialize to object', function () {
        di('a');

        expect(di.serialize()).to.eql({a: {test: 123}});
    });

    it('must serialize to object used reuse', function () {
        di('b');

        expect(di.serialize()).to.eql({a: {test: 123}, b: {test: 123}});
    });

    it('must restore from object', function () {
        di.restore({a: {test: 123}});

        expect(di('a').data).to.eql({test: 123});
    });

});
