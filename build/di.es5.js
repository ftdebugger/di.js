(function (global, factory) {
    if (typeof define === 'function' && define.amd) {
        define('di', ['exports', 'lodash/object/extend', 'lodash/lang/isArray', 'lodash/lang/isObject', 'lodash/object/defaults', 'lodash/collection/forEach', 'lodash/object/values', 'lodash/lang/isFunction', 'lodash/collection/map', 'lodash/utility/uniqueId'], factory);
    } else if (typeof exports !== 'undefined') {
        factory(exports, require('lodash/object/extend'), require('lodash/lang/isArray'), require('lodash/lang/isObject'), require('lodash/object/defaults'), require('lodash/collection/forEach'), require('lodash/object/values'), require('lodash/lang/isFunction'), require('lodash/collection/map'), require('lodash/utility/uniqueId'));
    } else {
        var mod = {
            exports: {}
        };
        factory(mod.exports, global._lodashObjectExtend, global._lodashLangIsArray, global._lodashLangIsObject, global._lodashObjectDefaults, global._lodashCollectionForEach, global._lodashObjectValues, global._lodashLangIsFunction, global._lodashCollectionMap, global._lodashUtilityUniqueId);
        global.di = mod.exports;
    }
})(this, function (exports, _lodashObjectExtend2, _lodashLangIsArray2, _lodashLangIsObject2, _lodashObjectDefaults2, _lodashCollectionForEach2, _lodashObjectValues2, _lodashLangIsFunction2, _lodashCollectionMap2, _lodashUtilityUniqueId2) {
    'use strict';

    var _lodashObjectExtend3 = _interopRequireDefault(_lodashObjectExtend2);

    var _lodashLangIsArray3 = _interopRequireDefault(_lodashLangIsArray2);

    var _lodashLangIsObject3 = _interopRequireDefault(_lodashLangIsObject2);

    var _lodashObjectDefaults3 = _interopRequireDefault(_lodashObjectDefaults2);

    var _lodashCollectionForEach3 = _interopRequireDefault(_lodashCollectionForEach2);

    var _lodashObjectValues3 = _interopRequireDefault(_lodashObjectValues2);

    var _lodashLangIsFunction3 = _interopRequireDefault(_lodashLangIsFunction2);

    var _lodashCollectionMap3 = _interopRequireDefault(_lodashCollectionMap2);

    var _lodashUtilityUniqueId3 = _interopRequireDefault(_lodashUtilityUniqueId2);

    Object.defineProperty(exports, '__esModule', {
        value: true
    });

    var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

    /**
     * @typedef {{bundleName: string, factory: string, Module: (function|{factory: function}), instance: object, dependencies: object}} DiDefinition
     */

    /**
     * @typedef {{session: function, put: function}} DiContainer
     */

    /**
     * @param {Promise|*} promise
     * @param {function} callback
     *
     * @returns {Promise|*}
     */
    var then = function then(promise, callback) {
        if (promise && promise.then) {
            return promise.then(callback);
        } else {
            return callback(promise);
        }
    };

    /**
     * @param {(Promise|*)[]} values
     * @param {function} callback
     *
     * @returns {Promise|*}
     */
    var all = function all(values, callback) {
        var some = values.some(function (promise) {
            return Boolean(promise && promise.then);
        });

        if (some) {
            return Promise.all(values).then(callback);
        } else {
            return callback(values);
        }
    };

    /**
     * @param {Promise|*} promise
     * @param {function} callback
     *
     * @returns {Promise|*}
     */
    var qCatch = function qCatch(promise, callback) {
        if (promise && promise['catch']) {
            promise['catch'](callback);
        }

        return promise;
    };

    /**
     * @param {function|{keys: function}} require
     * @returns {Function}
     */
    var createLoader = function createLoader(require) {
        var bundles = {};

        require.keys().forEach(function (path) {
            var name = path.match(/\/([^\/]+)$/)[1];

            bundles[name] = { path: path };
        });

        return function (name) {
            var description = bundles[name],
                bundleLoader = undefined;

            if (description) {
                bundleLoader = require(description.path);

                if (typeof bundleLoader === 'function' && !bundleLoader.name) {
                    return new Promise(function (resolve) {
                        bundleLoader(resolve);
                    });
                }

                return bundleLoader;
            }
        };
    };

    /**
     * Usage:
     *
     * ```
     *  resolvers: [
     *      webpackResolver([
     *          require.context('./states/', true, /State.js$/),
     *          require.context('./models/', true, /.js$/)
     *      ])
     *  ]
     * ```
     *
     * @param {function[]|{keys: function}[]} requires
     * @returns {Function}
     */
    var webpackResolver = function webpackResolver(requires) {
        var bundles = {};

        /**
         * @param {function|{keys: function}} require
         * @returns {Function}
         */
        var createLoader = function createLoader(require) {
            require.keys().forEach(function (path) {
                var name = path.match(/\/([^\/]+)$/)[1];

                // If we already has declared bundle, use it for loading
                // do not override
                if (!bundles[name]) {
                    bundles[name] = function () {
                        return require(path);
                    };
                }
            });
        };

        requires.forEach(createLoader);

        /**
         * @params {string} name
         *
         * @returns {Promise<object>|object}
         */
        return function (name) {
            if (!name.match(/\.js$/)) {
                name += '.js';
            }

            var require = bundles[name],
                bundleLoader = undefined;

            if (require) {
                bundleLoader = require();

                if (typeof bundleLoader === 'function' && !bundleLoader.name) {
                    return new Promise(function (resolve) {
                        bundleLoader(resolve);
                    });
                }

                return bundleLoader;
            }
        };
    };

    /**
     * Usage:
     *
     * ```
     *  resolvers: [
     *      staticResolver({
     *          config: {...},
     *          globalBus: new Backbone.Wreqr.EventEmitter()
     *      })
     *  ]
     * ```
     *
     * @param {object} hash
     * @returns {Function}
     */
    var staticResolver = function staticResolver(hash) {
        return function (name) {
            return hash[name];
        };
    };

    /**
     * @param {string} definition
     * @returns {{name: string, factory: string|undefined}}
     */
    var parseStringDefinition = function parseStringDefinition(definition) {
        var matches = definition.match(/^([^.]+)(\.(.+))?$/);

        if (!matches) {
            console.error(module);
            throw new Error('Unknown module format');
        }

        return {
            bundleName: matches[1],
            factory: matches[3]
        };
    };

    /**
     * @param {string} dependencyId
     * @param {{}} config
     * @returns {*}
     */
    var normalizeDependencyDefinition = function normalizeDependencyDefinition(dependencyId, config) {
        var definition = {
            id: dependencyId
        };

        if (typeof config === 'string') {
            (0, _lodashObjectExtend3['default'])(definition, parseStringDefinition(config));
        } else if ((0, _lodashLangIsArray3['default'])(config)) {
            if (config.length === 1) {
                (0, _lodashObjectExtend3['default'])(definition, config[0]);
            } else {
                (0, _lodashObjectExtend3['default'])(definition, parseStringDefinition(config[0]), { dependencies: config[1] });
            }
        } else if ((0, _lodashLangIsObject3['default'])(config)) {
            (0, _lodashObjectExtend3['default'])(definition, parseStringDefinition(dependencyId), { dependencies: config });
        } else {
            throw new Error('Unknown type of dependency definition');
        }

        return (0, _lodashObjectDefaults3['default'])(definition, {
            factory: 'factory'
        });
    };

    /**
     * @param {{}} dependencies
     * @returns {{}}
     */
    var normalizeDependencyDefinitions = function normalizeDependencyDefinitions(dependencies) {
        var definitions = {};

        (0, _lodashCollectionForEach3['default'])(dependencies, function (config, dependencyId) {
            definitions[dependencyId] = normalizeDependencyDefinition(dependencyId, config);
        });

        return definitions;
    };

    /**
     * @param {function[]} resolvers
     * @param {object} dependencies
     *
     * @returns {function}
     */
    var createContainer = function createContainer() {
        var _ref = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

        var _ref$resolvers = _ref.resolvers;
        var resolvers = _ref$resolvers === undefined ? [] : _ref$resolvers;
        var _ref$dependencies = _ref.dependencies;
        var dependencies = _ref$dependencies === undefined ? {} : _ref$dependencies;

        var bundleCache = {};

        var definitions = normalizeDependencyDefinitions(dependencies);

        /**
         * @param {DiDefinition} definition
         * @param {{}} dependencies
         *
         * @returns {Promise<object>|object}
         */
        var factory = function factory(definition, dependencies) {
            var Module = definition.Module,
                factory = definition.factory;

            if (Module.__esModule === true) {
                Module = (0, _lodashObjectValues3['default'])(Module)[0];
            }

            if (Module[factory]) {
                return Module[factory](dependencies);
            } else {
                return new Module(dependencies);
            }
        };

        /**
         * @param {DiDefinition} definition
         *
         * @returns {Promise<object>|object}
         */
        var loadModuleBundle = function loadModuleBundle(definition) {
            if (definition.Module) {
                return definition.Module;
            }

            var queue = resolvers.slice(),
                name = definition.bundleName;

            var loadBundle = function loadBundle() {
                if (bundleCache[name]) {
                    return bundleCache[name];
                }

                var nextLoader = function nextLoader() {
                    if (!queue.length) {
                        return Promise.reject(new Error('Cannot find bundle with name "' + definition.bundleName + '"'));
                    }

                    var loader = queue.shift();

                    return then(loader(name), function (result) {
                        if (result) {
                            return bundleCache[name] = result;
                        } else {
                            return nextLoader();
                        }
                    });
                };

                return bundleCache[name] = nextLoader();
            };

            return then(loadBundle(), function (Module) {
                definition.Module = Module;

                return Module;
            });
        };

        /**
         * @param {DiDefinition|string} module
         * @returns {DiDefinition}
         */
        var normalizeModule = function normalizeModule(module) {
            if (typeof module === 'string') {
                if (definitions[module]) {
                    return definitions[module];
                }

                return definitions[module] = normalizeDependencyDefinition(module, {});
            }

            console.log('UNKNOWN MODULE', module);

            throw new Error('Unknown module');
        };

        /**
         * @param {string|DiDefinition} moduleName
         * @param {{}} params
         *
         * @returns {Promise<object>}
         */
        var loadModule = function loadModule(moduleName, params) {
            var definition = normalizeModule(moduleName);

            var load = function load() {
                var promises = [definition.instance ? null : loadModuleBundle(definition), loadModuleDependencies(definition, params)];

                return all(promises, function (_ref2) {
                    var _ref22 = _slicedToArray(_ref2, 2);

                    var Module = _ref22[0];
                    var dependencies = _ref22[1];

                    var _factory = function _factory() {
                        if (definition.instance) {
                            return definition.instance;
                        } else {
                            return factory(definition, dependencies);
                        }
                    };

                    // If instance has updateDependencies invoke it before complete DI resolve
                    return then(_factory(), function (instance) {
                        var isNeedUpdate = !params.diSessionId || definition.diSessionId !== params.diSessionId;
                        definition.diSessionId = params.diSessionId;

                        if ((0, _lodashLangIsFunction3['default'])(instance.updateDependencies)) {
                            if (isNeedUpdate) {
                                return then(instance.updateDependencies(dependencies), function (_) {
                                    return instance;
                                });
                            }
                        }

                        return instance;
                    });
                });
            };

            if (definition._progress) {
                return definition._progress;
            }

            definition._progress = then(load(), function (instance) {
                definition.instance = instance;

                return instance;
            });

            return then(definition._progress, function (instance) {
                definition._progress = null;

                return instance;
            });
        };

        /**
         * @param {{}} dependencies
         * @param params
         *
         * @returns {Promise<object>|object}
         */
        var loadModules = function loadModules(dependencies, params) {
            var loaded = (0, _lodashObjectExtend3['default'])({}, params);

            if (dependencies) {
                var promises = (0, _lodashCollectionMap3['default'])(dependencies, function (dependencyName, key) {
                    return then(loadModule(dependencyName, params), function (dependency) {
                        return loaded[key] = dependency;
                    });
                });

                return all(promises, function (_) {
                    return loaded;
                });
            }

            return loaded;
        };

        /**
         * @param {string|DiDefinition} definition
         * @param {{}} params
         *
         * @returns {Promise<object>|object}
         */
        var loadModuleDependencies = function loadModuleDependencies(definition, params) {
            return loadModules(definition.dependencies, params);
        };

        /**
         * @param {string|object} module
         * @param {{}} [params]
         *
         * @returns {Promise<object>|object}
         */
        var di = function di(module, params) {
            var promise = undefined;

            params = params || {};

            if (typeof module === 'string') {
                promise = loadModule(module, params);
            } else {
                promise = loadModules(module, params);
            }

            qCatch(promise, function (err) {
                console.error(err);
                console.error(err.stack);
            });

            return promise;
        };

        /**
         * Create session of DI loading. When session close - all unknown dependencies will be truncated
         *
         * @returns {{load: Function, close: Function}}
         */
        di.session = function () {
            var id = (0, _lodashUtilityUniqueId3['default'])('di');

            return {

                /**
                 * Work like original DI function
                 *
                 * @see di
                 *
                 * @param {string|object} module
                 * @param {{}} [params]
                 *
                 * @returns {Promise<object>|object}
                 */
                load: function load(module, params) {
                    params = params || {};
                    params.diSessionId = id;

                    return di(module, params);
                },

                /**
                 * Run GC to destroy unknown dependencies
                 */
                close: function close() {
                    (0, _lodashCollectionForEach3['default'])(definitions, function (module) {
                        var instance = module.instance;

                        if (module.diSessionId && module.diSessionId !== id && instance) {
                            if (instance.trigger) {
                                instance.trigger('di:destroy');
                            }

                            if ((0, _lodashLangIsFunction3['default'])(instance.destroy)) {
                                instance.destroy();
                            }

                            module.instance = null;
                        }
                    });
                }
            };
        };

        /**
         * @param {string} inputDefinition
         * @param instance
         *
         * @returns {DiContainer}
         */
        di.put = function (inputDefinition, instance) {
            var definition = normalizeModule(inputDefinition);
            definition.instance = instance;

            return undefined;
        };

        return di;
    };

    exports.createContainer = createContainer;
    exports.webpackResolver = webpackResolver;
    exports.staticResolver = staticResolver;
    exports.then = then;
    exports.all = all;
    exports.qCatch = qCatch;
});

//# sourceMappingURL=data:application/json;base64,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RUYsZUFBTyxFQUFFLENBQUM7S0FDYixDQUFDOztZQUVNLGVBQWUsR0FBZixlQUFlO1lBQUUsZUFBZSxHQUFmLGVBQWU7WUFBRSxjQUFjLEdBQWQsY0FBYztZQUFFLElBQUksR0FBSixJQUFJO1lBQUUsR0FBRyxHQUFILEdBQUc7WUFBRSxNQUFNLEdBQU4sTUFBTSIsImZpbGUiOiJkaS5lczUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgXyBmcm9tICdsb2Rhc2gnO1xuXG5cbi8qKlxuICogQHR5cGVkZWYge3tidW5kbGVOYW1lOiBzdHJpbmcsIGZhY3Rvcnk6IHN0cmluZywgTW9kdWxlOiAoZnVuY3Rpb258e2ZhY3Rvcnk6IGZ1bmN0aW9ufSksIGluc3RhbmNlOiBvYmplY3QsIGRlcGVuZGVuY2llczogb2JqZWN0fX0gRGlEZWZpbml0aW9uXG4gKi9cblxuLyoqXG4gKiBAdHlwZWRlZiB7e3Nlc3Npb246IGZ1bmN0aW9uLCBwdXQ6IGZ1bmN0aW9ufX0gRGlDb250YWluZXJcbiAqL1xuXG4vKipcbiAqIEBwYXJhbSB7UHJvbWlzZXwqfSBwcm9taXNlXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1xuICpcbiAqIEByZXR1cm5zIHtQcm9taXNlfCp9XG4gKi9cbmxldCB0aGVuID0gKHByb21pc2UsIGNhbGxiYWNrKSA9PiB7XG4gICAgaWYgKHByb21pc2UgJiYgcHJvbWlzZS50aGVuKSB7XG4gICAgICAgIHJldHVybiBwcm9taXNlLnRoZW4oY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhwcm9taXNlKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7KFByb21pc2V8KilbXX0gdmFsdWVzXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1xuICpcbiAqIEByZXR1cm5zIHtQcm9taXNlfCp9XG4gKi9cbmxldCBhbGwgPSAodmFsdWVzLCBjYWxsYmFjaykgPT4ge1xuICAgIGxldCBzb21lID0gdmFsdWVzLnNvbWUocHJvbWlzZSA9PiBCb29sZWFuKHByb21pc2UgJiYgcHJvbWlzZS50aGVuKSk7XG5cbiAgICBpZiAoc29tZSkge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwodmFsdWVzKS50aGVuKGNhbGxiYWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2sodmFsdWVzKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7UHJvbWlzZXwqfSBwcm9taXNlXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1xuICpcbiAqIEByZXR1cm5zIHtQcm9taXNlfCp9XG4gKi9cbmxldCBxQ2F0Y2ggPSAocHJvbWlzZSwgY2FsbGJhY2spID0+IHtcbiAgICBpZiAocHJvbWlzZSAmJiBwcm9taXNlLmNhdGNoKSB7XG4gICAgICAgIHByb21pc2UuY2F0Y2goY2FsbGJhY2spO1xuICAgIH1cblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxuLyoqXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufHtrZXlzOiBmdW5jdGlvbn19IHJlcXVpcmVcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn1cbiAqL1xubGV0IGNyZWF0ZUxvYWRlciA9IGZ1bmN0aW9uIChyZXF1aXJlKSB7XG4gICAgbGV0IGJ1bmRsZXMgPSB7fTtcblxuICAgIHJlcXVpcmUua2V5cygpLmZvckVhY2goKHBhdGgpID0+IHtcbiAgICAgICAgbGV0IG5hbWUgPSBwYXRoLm1hdGNoKC9cXC8oW15cXC9dKykkLylbMV07XG5cbiAgICAgICAgYnVuZGxlc1tuYW1lXSA9IHtwYXRofTtcbiAgICB9KTtcblxuICAgIHJldHVybiAobmFtZSkgPT4ge1xuICAgICAgICBsZXQgZGVzY3JpcHRpb24gPSBidW5kbGVzW25hbWVdLFxuICAgICAgICAgICAgYnVuZGxlTG9hZGVyO1xuXG4gICAgICAgIGlmIChkZXNjcmlwdGlvbikge1xuICAgICAgICAgICAgYnVuZGxlTG9hZGVyID0gcmVxdWlyZShkZXNjcmlwdGlvbi5wYXRoKTtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBidW5kbGVMb2FkZXIgPT09ICdmdW5jdGlvbicgJiYgIWJ1bmRsZUxvYWRlci5uYW1lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGJ1bmRsZUxvYWRlcihyZXNvbHZlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGJ1bmRsZUxvYWRlcjtcbiAgICAgICAgfVxuICAgIH07XG59O1xuXG4vKipcbiAqIFVzYWdlOlxuICpcbiAqIGBgYFxuICogIHJlc29sdmVyczogW1xuICogICAgICB3ZWJwYWNrUmVzb2x2ZXIoW1xuICogICAgICAgICAgcmVxdWlyZS5jb250ZXh0KCcuL3N0YXRlcy8nLCB0cnVlLCAvU3RhdGUuanMkLyksXG4gKiAgICAgICAgICByZXF1aXJlLmNvbnRleHQoJy4vbW9kZWxzLycsIHRydWUsIC8uanMkLylcbiAqICAgICAgXSlcbiAqICBdXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0ge2Z1bmN0aW9uW118e2tleXM6IGZ1bmN0aW9ufVtdfSByZXF1aXJlc1xuICogQHJldHVybnMge0Z1bmN0aW9ufVxuICovXG5sZXQgd2VicGFja1Jlc29sdmVyID0gKHJlcXVpcmVzKSA9PiB7XG4gICAgbGV0IGJ1bmRsZXMgPSB7fTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb258e2tleXM6IGZ1bmN0aW9ufX0gcmVxdWlyZVxuICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbn1cbiAgICAgKi9cbiAgICBsZXQgY3JlYXRlTG9hZGVyID0gZnVuY3Rpb24gKHJlcXVpcmUpIHtcbiAgICAgICAgcmVxdWlyZS5rZXlzKCkuZm9yRWFjaCgocGF0aCkgPT4ge1xuICAgICAgICAgICAgbGV0IG5hbWUgPSBwYXRoLm1hdGNoKC9cXC8oW15cXC9dKykkLylbMV07XG5cbiAgICAgICAgICAgIC8vIElmIHdlIGFscmVhZHkgaGFzIGRlY2xhcmVkIGJ1bmRsZSwgdXNlIGl0IGZvciBsb2FkaW5nXG4gICAgICAgICAgICAvLyBkbyBub3Qgb3ZlcnJpZGVcbiAgICAgICAgICAgIGlmICghYnVuZGxlc1tuYW1lXSkge1xuICAgICAgICAgICAgICAgIGJ1bmRsZXNbbmFtZV0gPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXF1aXJlKHBhdGgpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICByZXF1aXJlcy5mb3JFYWNoKGNyZWF0ZUxvYWRlcik7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW1zIHtzdHJpbmd9IG5hbWVcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPG9iamVjdD58b2JqZWN0fVxuICAgICAqL1xuICAgIHJldHVybiAobmFtZSkgPT4ge1xuICAgICAgICBpZiAoIW5hbWUubWF0Y2goL1xcLmpzJC8pKSB7XG4gICAgICAgICAgICBuYW1lICs9ICcuanMnO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHJlcXVpcmUgPSBidW5kbGVzW25hbWVdLFxuICAgICAgICAgICAgYnVuZGxlTG9hZGVyO1xuXG4gICAgICAgIGlmIChyZXF1aXJlKSB7XG4gICAgICAgICAgICBidW5kbGVMb2FkZXIgPSByZXF1aXJlKCk7XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgYnVuZGxlTG9hZGVyID09PSAnZnVuY3Rpb24nICYmICFidW5kbGVMb2FkZXIubmFtZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBidW5kbGVMb2FkZXIocmVzb2x2ZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBidW5kbGVMb2FkZXI7XG4gICAgICAgIH1cbiAgICB9O1xufTtcblxuLyoqXG4gKiBVc2FnZTpcbiAqXG4gKiBgYGBcbiAqICByZXNvbHZlcnM6IFtcbiAqICAgICAgc3RhdGljUmVzb2x2ZXIoe1xuICogICAgICAgICAgY29uZmlnOiB7Li4ufSxcbiAqICAgICAgICAgIGdsb2JhbEJ1czogbmV3IEJhY2tib25lLldyZXFyLkV2ZW50RW1pdHRlcigpXG4gKiAgICAgIH0pXG4gKiAgXVxuICogYGBgXG4gKlxuICogQHBhcmFtIHtvYmplY3R9IGhhc2hcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn1cbiAqL1xubGV0IHN0YXRpY1Jlc29sdmVyID0gKGhhc2gpID0+IHtcbiAgICByZXR1cm4gKG5hbWUpID0+IHtcbiAgICAgICAgcmV0dXJuIGhhc2hbbmFtZV07XG4gICAgfVxufTtcblxuLyoqXG4gKiBAcGFyYW0ge3N0cmluZ30gZGVmaW5pdGlvblxuICogQHJldHVybnMge3tuYW1lOiBzdHJpbmcsIGZhY3Rvcnk6IHN0cmluZ3x1bmRlZmluZWR9fVxuICovXG5sZXQgcGFyc2VTdHJpbmdEZWZpbml0aW9uID0gKGRlZmluaXRpb24pID0+IHtcbiAgICBsZXQgbWF0Y2hlcyA9IGRlZmluaXRpb24ubWF0Y2goL14oW14uXSspKFxcLiguKykpPyQvKTtcblxuICAgIGlmICghbWF0Y2hlcykge1xuICAgICAgICBjb25zb2xlLmVycm9yKG1vZHVsZSk7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBtb2R1bGUgZm9ybWF0Jyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgYnVuZGxlTmFtZTogbWF0Y2hlc1sxXSxcbiAgICAgICAgZmFjdG9yeTogbWF0Y2hlc1szXVxuICAgIH07XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7c3RyaW5nfSBkZXBlbmRlbmN5SWRcbiAqIEBwYXJhbSB7e319IGNvbmZpZ1xuICogQHJldHVybnMgeyp9XG4gKi9cbmxldCBub3JtYWxpemVEZXBlbmRlbmN5RGVmaW5pdGlvbiA9IChkZXBlbmRlbmN5SWQsIGNvbmZpZykgPT4ge1xuICAgIGxldCBkZWZpbml0aW9uID0ge1xuICAgICAgICBpZDogZGVwZW5kZW5jeUlkXG4gICAgfTtcblxuICAgIGlmICh0eXBlb2YgY29uZmlnID09PSAnc3RyaW5nJykge1xuICAgICAgICBfLmV4dGVuZChkZWZpbml0aW9uLCBwYXJzZVN0cmluZ0RlZmluaXRpb24oY29uZmlnKSk7XG4gICAgfSBlbHNlIGlmIChfLmlzQXJyYXkoY29uZmlnKSkge1xuICAgICAgICBpZiAoY29uZmlnLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgXy5leHRlbmQoZGVmaW5pdGlvbiwgY29uZmlnWzBdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIF8uZXh0ZW5kKGRlZmluaXRpb24sIHBhcnNlU3RyaW5nRGVmaW5pdGlvbihjb25maWdbMF0pLCB7ZGVwZW5kZW5jaWVzOiBjb25maWdbMV19KTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoXy5pc09iamVjdChjb25maWcpKSB7XG4gICAgICAgIF8uZXh0ZW5kKGRlZmluaXRpb24sIHBhcnNlU3RyaW5nRGVmaW5pdGlvbihkZXBlbmRlbmN5SWQpLCB7ZGVwZW5kZW5jaWVzOiBjb25maWd9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gdHlwZSBvZiBkZXBlbmRlbmN5IGRlZmluaXRpb24nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gXy5kZWZhdWx0cyhkZWZpbml0aW9uLCB7XG4gICAgICAgIGZhY3Rvcnk6ICdmYWN0b3J5J1xuICAgIH0pO1xufTtcblxuLyoqXG4gKiBAcGFyYW0ge3t9fSBkZXBlbmRlbmNpZXNcbiAqIEByZXR1cm5zIHt7fX1cbiAqL1xubGV0IG5vcm1hbGl6ZURlcGVuZGVuY3lEZWZpbml0aW9ucyA9IChkZXBlbmRlbmNpZXMpID0+IHtcbiAgICBsZXQgZGVmaW5pdGlvbnMgPSB7fTtcblxuICAgIF8uZm9yRWFjaChkZXBlbmRlbmNpZXMsIChjb25maWcsIGRlcGVuZGVuY3lJZCkgPT4ge1xuICAgICAgICBkZWZpbml0aW9uc1tkZXBlbmRlbmN5SWRdID0gbm9ybWFsaXplRGVwZW5kZW5jeURlZmluaXRpb24oZGVwZW5kZW5jeUlkLCBjb25maWcpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGRlZmluaXRpb25zO1xufTtcblxuLyoqXG4gKiBAcGFyYW0ge2Z1bmN0aW9uW119IHJlc29sdmVyc1xuICogQHBhcmFtIHtvYmplY3R9IGRlcGVuZGVuY2llc1xuICpcbiAqIEByZXR1cm5zIHtmdW5jdGlvbn1cbiAqL1xubGV0IGNyZWF0ZUNvbnRhaW5lciA9ICh7cmVzb2x2ZXJzID0gW10sIGRlcGVuZGVuY2llcyA9IHt9fSA9IHt9KSA9PiB7XG4gICAgbGV0IGJ1bmRsZUNhY2hlID0ge307XG5cbiAgICBsZXQgZGVmaW5pdGlvbnMgPSBub3JtYWxpemVEZXBlbmRlbmN5RGVmaW5pdGlvbnMoZGVwZW5kZW5jaWVzKTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7RGlEZWZpbml0aW9ufSBkZWZpbml0aW9uXG4gICAgICogQHBhcmFtIHt7fX0gZGVwZW5kZW5jaWVzXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fG9iamVjdH1cbiAgICAgKi9cbiAgICBsZXQgZmFjdG9yeSA9IChkZWZpbml0aW9uLCBkZXBlbmRlbmNpZXMpID0+IHtcbiAgICAgICAgbGV0IE1vZHVsZSA9IGRlZmluaXRpb24uTW9kdWxlLFxuICAgICAgICAgICAgZmFjdG9yeSA9IGRlZmluaXRpb24uZmFjdG9yeTtcblxuICAgICAgICBpZiAoTW9kdWxlLl9fZXNNb2R1bGUgPT09IHRydWUpIHtcbiAgICAgICAgICAgIE1vZHVsZSA9IF8udmFsdWVzKE1vZHVsZSlbMF07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoTW9kdWxlW2ZhY3RvcnldKSB7XG4gICAgICAgICAgICByZXR1cm4gTW9kdWxlW2ZhY3RvcnldKGRlcGVuZGVuY2llcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IE1vZHVsZShkZXBlbmRlbmNpZXMpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7RGlEZWZpbml0aW9ufSBkZWZpbml0aW9uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fG9iamVjdH1cbiAgICAgKi9cbiAgICBsZXQgbG9hZE1vZHVsZUJ1bmRsZSA9IChkZWZpbml0aW9uKSA9PiB7XG4gICAgICAgIGlmIChkZWZpbml0aW9uLk1vZHVsZSkge1xuICAgICAgICAgICAgcmV0dXJuIGRlZmluaXRpb24uTW9kdWxlO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHF1ZXVlID0gcmVzb2x2ZXJzLnNsaWNlKCksXG4gICAgICAgICAgICBuYW1lID0gZGVmaW5pdGlvbi5idW5kbGVOYW1lO1xuXG4gICAgICAgIGxldCBsb2FkQnVuZGxlID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYgKGJ1bmRsZUNhY2hlW25hbWVdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJ1bmRsZUNhY2hlW25hbWVdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgbmV4dExvYWRlciA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXF1ZXVlLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKCdDYW5ub3QgZmluZCBidW5kbGUgd2l0aCBuYW1lIFwiJyArIGRlZmluaXRpb24uYnVuZGxlTmFtZSArICdcIicpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBsZXQgbG9hZGVyID0gcXVldWUuc2hpZnQoKTtcblxuICAgICAgICAgICAgICAgIHJldHVybiB0aGVuKGxvYWRlcihuYW1lKSwgcmVzdWx0ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGJ1bmRsZUNhY2hlW25hbWVdID0gcmVzdWx0O1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5leHRMb2FkZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgcmV0dXJuIGJ1bmRsZUNhY2hlW25hbWVdID0gbmV4dExvYWRlcigpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiB0aGVuKGxvYWRCdW5kbGUoKSwgKE1vZHVsZSkgPT4ge1xuICAgICAgICAgICAgZGVmaW5pdGlvbi5Nb2R1bGUgPSBNb2R1bGU7XG5cbiAgICAgICAgICAgIHJldHVybiBNb2R1bGU7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0RpRGVmaW5pdGlvbnxzdHJpbmd9IG1vZHVsZVxuICAgICAqIEByZXR1cm5zIHtEaURlZmluaXRpb259XG4gICAgICovXG4gICAgbGV0IG5vcm1hbGl6ZU1vZHVsZSA9IChtb2R1bGUpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBpZiAoZGVmaW5pdGlvbnNbbW9kdWxlXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBkZWZpbml0aW9uc1ttb2R1bGVdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZGVmaW5pdGlvbnNbbW9kdWxlXSA9IG5vcm1hbGl6ZURlcGVuZGVuY3lEZWZpbml0aW9uKG1vZHVsZSwge30pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc29sZS5sb2coJ1VOS05PV04gTU9EVUxFJywgbW9kdWxlKTtcblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gbW9kdWxlJyk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfERpRGVmaW5pdGlvbn0gbW9kdWxlTmFtZVxuICAgICAqIEBwYXJhbSB7e319IHBhcmFtc1xuICAgICAqXG4gICAgICogQHJldHVybnMge1Byb21pc2U8b2JqZWN0Pn1cbiAgICAgKi9cbiAgICBsZXQgbG9hZE1vZHVsZSA9IChtb2R1bGVOYW1lLCBwYXJhbXMpID0+IHtcbiAgICAgICAgbGV0IGRlZmluaXRpb24gPSBub3JtYWxpemVNb2R1bGUobW9kdWxlTmFtZSk7XG5cbiAgICAgICAgbGV0IGxvYWQgPSAoKSA9PiB7XG4gICAgICAgICAgICBsZXQgcHJvbWlzZXMgPSBbXG4gICAgICAgICAgICAgICAgZGVmaW5pdGlvbi5pbnN0YW5jZSA/IG51bGwgOiBsb2FkTW9kdWxlQnVuZGxlKGRlZmluaXRpb24pLFxuICAgICAgICAgICAgICAgIGxvYWRNb2R1bGVEZXBlbmRlbmNpZXMoZGVmaW5pdGlvbiwgcGFyYW1zKVxuICAgICAgICAgICAgXTtcblxuICAgICAgICAgICAgcmV0dXJuIGFsbChwcm9taXNlcywgKFtNb2R1bGUsIGRlcGVuZGVuY2llc10pID0+IHtcbiAgICAgICAgICAgICAgICBsZXQgX2ZhY3RvcnkgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkZWZpbml0aW9uLmluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGVmaW5pdGlvbi5pbnN0YW5jZTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWN0b3J5KGRlZmluaXRpb24sIGRlcGVuZGVuY2llcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgLy8gSWYgaW5zdGFuY2UgaGFzIHVwZGF0ZURlcGVuZGVuY2llcyBpbnZva2UgaXQgYmVmb3JlIGNvbXBsZXRlIERJIHJlc29sdmVcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhlbihfZmFjdG9yeSgpLCBpbnN0YW5jZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBpc05lZWRVcGRhdGUgPSAhcGFyYW1zLmRpU2Vzc2lvbklkIHx8IGRlZmluaXRpb24uZGlTZXNzaW9uSWQgIT09IHBhcmFtcy5kaVNlc3Npb25JZDtcbiAgICAgICAgICAgICAgICAgICAgZGVmaW5pdGlvbi5kaVNlc3Npb25JZCA9IHBhcmFtcy5kaVNlc3Npb25JZDtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoXy5pc0Z1bmN0aW9uKGluc3RhbmNlLnVwZGF0ZURlcGVuZGVuY2llcykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc05lZWRVcGRhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhlbihpbnN0YW5jZS51cGRhdGVEZXBlbmRlbmNpZXMoZGVwZW5kZW5jaWVzKSwgXyA9PiBpbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAoZGVmaW5pdGlvbi5fcHJvZ3Jlc3MpIHtcbiAgICAgICAgICAgIHJldHVybiBkZWZpbml0aW9uLl9wcm9ncmVzcztcbiAgICAgICAgfVxuXG4gICAgICAgIGRlZmluaXRpb24uX3Byb2dyZXNzID0gdGhlbihsb2FkKCksIGluc3RhbmNlID0+IHtcbiAgICAgICAgICAgIGRlZmluaXRpb24uaW5zdGFuY2UgPSBpbnN0YW5jZTtcblxuICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gdGhlbihkZWZpbml0aW9uLl9wcm9ncmVzcywgaW5zdGFuY2UgPT4ge1xuICAgICAgICAgICAgZGVmaW5pdGlvbi5fcHJvZ3Jlc3MgPSBudWxsO1xuXG4gICAgICAgICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3t9fSBkZXBlbmRlbmNpZXNcbiAgICAgKiBAcGFyYW0gcGFyYW1zXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fG9iamVjdH1cbiAgICAgKi9cbiAgICBsZXQgbG9hZE1vZHVsZXMgPSAoZGVwZW5kZW5jaWVzLCBwYXJhbXMpID0+IHtcbiAgICAgICAgbGV0IGxvYWRlZCA9IF8uZXh0ZW5kKHt9LCBwYXJhbXMpO1xuXG4gICAgICAgIGlmIChkZXBlbmRlbmNpZXMpIHtcbiAgICAgICAgICAgIGxldCBwcm9taXNlcyA9IF8ubWFwKGRlcGVuZGVuY2llcywgKGRlcGVuZGVuY3lOYW1lLCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhlbihsb2FkTW9kdWxlKGRlcGVuZGVuY3lOYW1lLCBwYXJhbXMpLCBkZXBlbmRlbmN5ID0+IGxvYWRlZFtrZXldID0gZGVwZW5kZW5jeSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIGFsbChwcm9taXNlcywgXyA9PiBsb2FkZWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGxvYWRlZDtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd8RGlEZWZpbml0aW9ufSBkZWZpbml0aW9uXG4gICAgICogQHBhcmFtIHt7fX0gcGFyYW1zXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fG9iamVjdH1cbiAgICAgKi9cbiAgICBsZXQgbG9hZE1vZHVsZURlcGVuZGVuY2llcyA9IChkZWZpbml0aW9uLCBwYXJhbXMpID0+IHtcbiAgICAgICAgcmV0dXJuIGxvYWRNb2R1bGVzKGRlZmluaXRpb24uZGVwZW5kZW5jaWVzLCBwYXJhbXMpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9IG1vZHVsZVxuICAgICAqIEBwYXJhbSB7e319IFtwYXJhbXNdXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fG9iamVjdH1cbiAgICAgKi9cbiAgICBsZXQgZGkgPSAobW9kdWxlLCBwYXJhbXMpID0+IHtcbiAgICAgICAgbGV0IHByb21pc2U7XG5cbiAgICAgICAgcGFyYW1zID0gcGFyYW1zIHx8IHt9O1xuXG4gICAgICAgIGlmICh0eXBlb2YgbW9kdWxlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgcHJvbWlzZSA9IGxvYWRNb2R1bGUobW9kdWxlLCBwYXJhbXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJvbWlzZSA9IGxvYWRNb2R1bGVzKG1vZHVsZSwgcGFyYW1zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHFDYXRjaChwcm9taXNlLCBlcnIgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIuc3RhY2spO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIHNlc3Npb24gb2YgREkgbG9hZGluZy4gV2hlbiBzZXNzaW9uIGNsb3NlIC0gYWxsIHVua25vd24gZGVwZW5kZW5jaWVzIHdpbGwgYmUgdHJ1bmNhdGVkXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7e2xvYWQ6IEZ1bmN0aW9uLCBjbG9zZTogRnVuY3Rpb259fVxuICAgICAqL1xuICAgIGRpLnNlc3Npb24gPSAoKSA9PiB7XG4gICAgICAgIGxldCBpZCA9IF8udW5pcXVlSWQoJ2RpJyk7XG5cbiAgICAgICAgcmV0dXJuIHtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBXb3JrIGxpa2Ugb3JpZ2luYWwgREkgZnVuY3Rpb25cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAc2VlIGRpXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHBhcmFtIHtzdHJpbmd8b2JqZWN0fSBtb2R1bGVcbiAgICAgICAgICAgICAqIEBwYXJhbSB7e319IFtwYXJhbXNdXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHJldHVybnMge1Byb21pc2U8b2JqZWN0PnxvYmplY3R9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGxvYWQ6IChtb2R1bGUsIHBhcmFtcykgPT4ge1xuICAgICAgICAgICAgICAgIHBhcmFtcyA9IHBhcmFtcyB8fCB7fTtcbiAgICAgICAgICAgICAgICBwYXJhbXMuZGlTZXNzaW9uSWQgPSBpZDtcblxuICAgICAgICAgICAgICAgIHJldHVybiBkaShtb2R1bGUsIHBhcmFtcyk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFJ1biBHQyB0byBkZXN0cm95IHVua25vd24gZGVwZW5kZW5jaWVzXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGNsb3NlOiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgXy5mb3JFYWNoKGRlZmluaXRpb25zLCAobW9kdWxlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBpbnN0YW5jZSA9IG1vZHVsZS5pbnN0YW5jZTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAobW9kdWxlLmRpU2Vzc2lvbklkICYmIG1vZHVsZS5kaVNlc3Npb25JZCAhPT0gaWQgJiYgaW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpbnN0YW5jZS50cmlnZ2VyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2UudHJpZ2dlcignZGk6ZGVzdHJveScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoXy5pc0Z1bmN0aW9uKGluc3RhbmNlLmRlc3Ryb3kpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2UuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBtb2R1bGUuaW5zdGFuY2UgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBpbnB1dERlZmluaXRpb25cbiAgICAgKiBAcGFyYW0gaW5zdGFuY2VcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtEaUNvbnRhaW5lcn1cbiAgICAgKi9cbiAgICBkaS5wdXQgPSAoaW5wdXREZWZpbml0aW9uLCBpbnN0YW5jZSkgPT4ge1xuICAgICAgICBsZXQgZGVmaW5pdGlvbiA9IG5vcm1hbGl6ZU1vZHVsZShpbnB1dERlZmluaXRpb24pO1xuICAgICAgICBkZWZpbml0aW9uLmluc3RhbmNlID0gaW5zdGFuY2U7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIHJldHVybiBkaTtcbn07XG5cbmV4cG9ydCB7Y3JlYXRlQ29udGFpbmVyLCB3ZWJwYWNrUmVzb2x2ZXIsIHN0YXRpY1Jlc29sdmVyLCB0aGVuLCBhbGwsIHFDYXRjaH07XG4iXX0=