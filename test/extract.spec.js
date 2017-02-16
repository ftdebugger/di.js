import {expect} from 'chai';

import {extractModule} from '../index';

describe('extract module', function () {
    it('extract simple module', function () {
        let module = () => {
        };
        expect(extractModule(module)).to.equal(module);
    });

    it('extract simple module (object)', function () {
        let module = {};
        expect(extractModule(module)).to.equal(module);
    });

    it('extract es6 module', function () {
        let module = {
            __esModule: true, SomeModule: () => {
            }
        };
        expect(extractModule(module)).to.equal(module.SomeModule);
    });

    it('extract es6 module (object)', function () {
        let module = {__esModule: true, SomeModule: {}};
        expect(extractModule(module)).to.equal(module.SomeModule);
    });

    it('extract es6 module with additional not Class exports', function () {
        let module = {
            __esModule: true, abc: 12, SomeModule: () => {
            }
        };
        expect(extractModule(module)).to.equal(module.SomeModule);
    });

    it('extracts es6 default module even if it is not the first exported module', function () {
        let module = {
            __esModule: true, SomeModule: {}, default: {}
        };
        expect(extractModule(module)).to.equal(module.default);
    });

    it('extracts webpack modules', function () {
        let module = {};

        let User = function () {
            this.name = 'User';
        };

        Object.defineProperty(module, 'User', {
            get() {
                return User
            }
        });

        expect(extractModule(module)).to.equal(User);
    });

});
