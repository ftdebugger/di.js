import {expect} from 'chai';

import {staticResolver, arrayResolver, webpackResolver} from '../index';

class A {
}

class B {
    constructor({a}) {
        this.a = a;
    }
}

describe('resolvers', function () {
    describe('static resolver', function () {
        it('can resolve module', function () {
            let resolve = staticResolver({
                A: A
            });

            expect(resolve('A')).to.equal(A);
            expect(resolve('B')).to.equal(undefined);
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
            expect(resolve('C')).to.equal(undefined);
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

            let resolve = webpackResolver([requireMock]);

            expect(resolve('A')).to.equal(A);
            expect(resolve('B')).to.equal(B);
            expect(resolve('C')).to.equal(undefined);
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

            let resolve = webpackResolver([requireMock]);

            return Promise.all([
                resolve('A'),
                resolve('B'),
                resolve('C')
            ]).then(([A, B, C]) => {
                expect(A).to.equal(A);
                expect(B).to.equal(B);
                expect(C).to.equal(undefined);
            });
        });

    });
});
