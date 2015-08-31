(function (global, factory) {
    if (typeof define === 'function' && define.amd) {
        define('di', ['exports', 'lodash/object/extend', 'lodash/lang/isArray', 'lodash/utility/uniqueId', 'lodash/lang/isObject', 'lodash/object/defaults', 'lodash/collection/forEach', 'lodash/object/values', 'lodash/lang/isFunction', 'lodash/collection/map'], factory);
    } else if (typeof exports !== 'undefined') {
        factory(exports, require('lodash/object/extend'), require('lodash/lang/isArray'), require('lodash/utility/uniqueId'), require('lodash/lang/isObject'), require('lodash/object/defaults'), require('lodash/collection/forEach'), require('lodash/object/values'), require('lodash/lang/isFunction'), require('lodash/collection/map'));
    } else {
        var mod = {
            exports: {}
        };
        factory(mod.exports, global._lodashObjectExtend, global._lodashLangIsArray, global._lodashUtilityUniqueId, global._lodashLangIsObject, global._lodashObjectDefaults, global._lodashCollectionForEach, global._lodashObjectValues, global._lodashLangIsFunction, global._lodashCollectionMap);
        global.di = mod.exports;
    }
})(this, function (exports, _lodashObjectExtend2, _lodashLangIsArray2, _lodashUtilityUniqueId2, _lodashLangIsObject2, _lodashObjectDefaults2, _lodashCollectionForEach2, _lodashObjectValues2, _lodashLangIsFunction2, _lodashCollectionMap2) {
    'use strict';

    var _lodashObjectExtend3 = _interopRequireDefault(_lodashObjectExtend2);

    var _lodashLangIsArray3 = _interopRequireDefault(_lodashLangIsArray2);

    var _lodashUtilityUniqueId3 = _interopRequireDefault(_lodashUtilityUniqueId2);

    var _lodashLangIsObject3 = _interopRequireDefault(_lodashLangIsObject2);

    var _lodashObjectDefaults3 = _interopRequireDefault(_lodashObjectDefaults2);

    var _lodashCollectionForEach3 = _interopRequireDefault(_lodashCollectionForEach2);

    var _lodashObjectValues3 = _interopRequireDefault(_lodashObjectValues2);

    var _lodashLangIsFunction3 = _interopRequireDefault(_lodashLangIsFunction2);

    var _lodashCollectionMap3 = _interopRequireDefault(_lodashCollectionMap2);

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
     *          config: _ => {...},
     *          globalBus: _ => new Backbone.Wreqr.EventEmitter()
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
     * Usage:
     *
     * ```
     *  resolvers: [
     *      arrayResolver([
     *          staticResolver(...),
     *          webpackResolver(...),
     *          ....
     *      ])
     *  ]
     * ```
     *
     * @param {function(name: string)[]} resolvers
     * @returns {Function}
     */
    var arrayResolver = function arrayResolver(resolvers) {
        var bundleCache = {};

        return function (name) {
            var queue = resolvers.slice();

            if (bundleCache[name]) {
                return bundleCache[name];
            }

            var nextLoader = function nextLoader() {
                if (!queue.length) {
                    return;
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
    };

    /**
     * @param {string} definition
     * @returns {{name: string, factory: string|undefined}}
     */
    var parseStringDefinition = function parseStringDefinition(definition) {
        var matches = definition ? definition.match(/^([^.]+)(\.(.+))?$/) : null;

        if (!matches) {
            throw new Error('Unknown module format: ' + JSON.stringify(definition));
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
    var normalizeDefinition = function normalizeDefinition(dependencyId, config) {
        var definition = {
            id: dependencyId
        };

        if (typeof config === 'string') {
            (0, _lodashObjectExtend3['default'])(definition, parseStringDefinition(config));
        } else if ((0, _lodashLangIsArray3['default'])(config)) {
            if (config.length === 1) {
                definition.id = (0, _lodashUtilityUniqueId3['default'])('di');

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
            factory: 'factory',
            dependencies: {}
        });
    };

    /**
     * @param {{}} dependencies
     * @returns {{}}
     */
    var normalizeDefinitions = function normalizeDefinitions(dependencies) {
        var definitions = {};

        (0, _lodashCollectionForEach3['default'])(dependencies, function (config, dependencyId) {
            definitions[dependencyId] = normalizeDefinition(dependencyId, config);
        });

        return definitions;
    };

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

        var definitions = normalizeDefinitions(dependencies),
            resolve = arrayResolver(resolvers);

        /**
         * @param {DiDefinition} definition
         *
         * @returns {Promise<object>|object}
         */
        var loadModuleBundle = function loadModuleBundle(definition) {
            if (definition.Module) {
                return definition.Module;
            }

            return then(resolve(definition.bundleName), function (Module) {
                if (!Module) {
                    return Promise.reject(new Error('Cannot find bundle with name "' + definition.bundleName + '"'));
                }

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

                return definitions[module] = normalizeDefinition(module, {});
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
                var promises = [loadModuleDependencies(definition, params), definition.instance ? null : loadModuleBundle(definition)];

                return all(promises, function (_ref2) {
                    var _ref22 = _slicedToArray(_ref2, 1);

                    var dependencies = _ref22[0];

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
                    (0, _lodashCollectionForEach3['default'])(definitions, function (definition) {
                        var instance = definition.instance;

                        if (!definition.isPersistent && definition.diSessionId && definition.diSessionId !== id && instance) {
                            if (instance.trigger) {
                                instance.trigger('di:destroy');
                            }

                            if ((0, _lodashLangIsFunction3['default'])(instance.destroy)) {
                                instance.destroy();
                            }

                            definition.instance = null;
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
            definition.isPersistent = true;

            return undefined;
        };

        return di;
    };

    exports.createContainer = createContainer;
    exports.webpackResolver = webpackResolver;
    exports.staticResolver = staticResolver;
    exports.arrayResolver = arrayResolver;
    exports.then = then;
    exports.all = all;
    exports.qCatch = qCatch;
    exports.parseStringDefinition = parseStringDefinition;
    exports.normalizeDefinitions = normalizeDefinitions;
    exports.normalizeDefinition = normalizeDefinition;
    exports.factory = factory;
});

//# sourceMappingURL=data:application/json;base64,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QUFDO3lCQUM5QjtxQkFDSixDQUFDLENBQUM7aUJBQ047YUFDSixDQUFDO1NBQ0wsQ0FBQzs7Ozs7Ozs7QUFRRixVQUFFLENBQUMsR0FBRyxHQUFHLFVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBSztBQUNwQyxnQkFBSSxVQUFVLEdBQUcsZUFBZSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ2xELHNCQUFVLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztBQUMvQixzQkFBVSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUM7O0FBRS9CLDZCQUFZO1NBQ2YsQ0FBQzs7QUFFRixlQUFPLEVBQUUsQ0FBQztLQUNiLENBQUM7O1lBR0UsZUFBZSxHQUFmLGVBQWU7WUFFZixlQUFlLEdBQWYsZUFBZTtZQUNmLGNBQWMsR0FBZCxjQUFjO1lBQ2QsYUFBYSxHQUFiLGFBQWE7WUFFYixJQUFJLEdBQUosSUFBSTtZQUNKLEdBQUcsR0FBSCxHQUFHO1lBQ0gsTUFBTSxHQUFOLE1BQU07WUFFTixxQkFBcUIsR0FBckIscUJBQXFCO1lBQ3JCLG9CQUFvQixHQUFwQixvQkFBb0I7WUFDcEIsbUJBQW1CLEdBQW5CLG1CQUFtQjtZQUVuQixPQUFPLEdBQVAsT0FBTyIsImZpbGUiOiJkaS5lczUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgXyBmcm9tICdsb2Rhc2gnO1xuXG5cbi8qKlxuICogQHR5cGVkZWYge3tidW5kbGVOYW1lOiBzdHJpbmcsIGZhY3Rvcnk6IHN0cmluZywgTW9kdWxlOiAoZnVuY3Rpb258e2ZhY3Rvcnk6IGZ1bmN0aW9ufSksIGluc3RhbmNlOiBvYmplY3QsIGRlcGVuZGVuY2llczogb2JqZWN0fX0gRGlEZWZpbml0aW9uXG4gKi9cblxuLyoqXG4gKiBAdHlwZWRlZiB7e3Nlc3Npb246IGZ1bmN0aW9uLCBwdXQ6IGZ1bmN0aW9ufX0gRGlDb250YWluZXJcbiAqL1xuXG4vKipcbiAqIEBwYXJhbSB7UHJvbWlzZXwqfSBwcm9taXNlXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1xuICpcbiAqIEByZXR1cm5zIHtQcm9taXNlfCp9XG4gKi9cbmxldCB0aGVuID0gKHByb21pc2UsIGNhbGxiYWNrKSA9PiB7XG4gICAgaWYgKHByb21pc2UgJiYgcHJvbWlzZS50aGVuKSB7XG4gICAgICAgIHJldHVybiBwcm9taXNlLnRoZW4oY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhwcm9taXNlKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7KFByb21pc2V8KilbXX0gdmFsdWVzXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1xuICpcbiAqIEByZXR1cm5zIHtQcm9taXNlfCp9XG4gKi9cbmxldCBhbGwgPSAodmFsdWVzLCBjYWxsYmFjaykgPT4ge1xuICAgIGxldCBzb21lID0gdmFsdWVzLnNvbWUocHJvbWlzZSA9PiBCb29sZWFuKHByb21pc2UgJiYgcHJvbWlzZS50aGVuKSk7XG5cbiAgICBpZiAoc29tZSkge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwodmFsdWVzKS50aGVuKGNhbGxiYWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2sodmFsdWVzKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7UHJvbWlzZXwqfSBwcm9taXNlXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1xuICpcbiAqIEByZXR1cm5zIHtQcm9taXNlfCp9XG4gKi9cbmxldCBxQ2F0Y2ggPSAocHJvbWlzZSwgY2FsbGJhY2spID0+IHtcbiAgICBpZiAocHJvbWlzZSAmJiBwcm9taXNlLmNhdGNoKSB7XG4gICAgICAgIHByb21pc2UuY2F0Y2goY2FsbGJhY2spO1xuICAgIH1cblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxuLyoqXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufHtrZXlzOiBmdW5jdGlvbn19IHJlcXVpcmVcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn1cbiAqL1xubGV0IGNyZWF0ZUxvYWRlciA9IGZ1bmN0aW9uIChyZXF1aXJlKSB7XG4gICAgbGV0IGJ1bmRsZXMgPSB7fTtcblxuICAgIHJlcXVpcmUua2V5cygpLmZvckVhY2goKHBhdGgpID0+IHtcbiAgICAgICAgbGV0IG5hbWUgPSBwYXRoLm1hdGNoKC9cXC8oW15cXC9dKykkLylbMV07XG5cbiAgICAgICAgYnVuZGxlc1tuYW1lXSA9IHtwYXRofTtcbiAgICB9KTtcblxuICAgIHJldHVybiAobmFtZSkgPT4ge1xuICAgICAgICBsZXQgZGVzY3JpcHRpb24gPSBidW5kbGVzW25hbWVdLFxuICAgICAgICAgICAgYnVuZGxlTG9hZGVyO1xuXG4gICAgICAgIGlmIChkZXNjcmlwdGlvbikge1xuICAgICAgICAgICAgYnVuZGxlTG9hZGVyID0gcmVxdWlyZShkZXNjcmlwdGlvbi5wYXRoKTtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBidW5kbGVMb2FkZXIgPT09ICdmdW5jdGlvbicgJiYgIWJ1bmRsZUxvYWRlci5uYW1lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGJ1bmRsZUxvYWRlcihyZXNvbHZlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGJ1bmRsZUxvYWRlcjtcbiAgICAgICAgfVxuICAgIH07XG59O1xuXG4vKipcbiAqIFVzYWdlOlxuICpcbiAqIGBgYFxuICogIHJlc29sdmVyczogW1xuICogICAgICB3ZWJwYWNrUmVzb2x2ZXIoW1xuICogICAgICAgICAgcmVxdWlyZS5jb250ZXh0KCcuL3N0YXRlcy8nLCB0cnVlLCAvU3RhdGUuanMkLyksXG4gKiAgICAgICAgICByZXF1aXJlLmNvbnRleHQoJy4vbW9kZWxzLycsIHRydWUsIC8uanMkLylcbiAqICAgICAgXSlcbiAqICBdXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0ge2Z1bmN0aW9uW118e2tleXM6IGZ1bmN0aW9ufVtdfSByZXF1aXJlc1xuICogQHJldHVybnMge0Z1bmN0aW9ufVxuICovXG5sZXQgd2VicGFja1Jlc29sdmVyID0gKHJlcXVpcmVzKSA9PiB7XG4gICAgbGV0IGJ1bmRsZXMgPSB7fTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb258e2tleXM6IGZ1bmN0aW9ufX0gcmVxdWlyZVxuICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbn1cbiAgICAgKi9cbiAgICBsZXQgY3JlYXRlTG9hZGVyID0gZnVuY3Rpb24gKHJlcXVpcmUpIHtcbiAgICAgICAgcmVxdWlyZS5rZXlzKCkuZm9yRWFjaCgocGF0aCkgPT4ge1xuICAgICAgICAgICAgbGV0IG5hbWUgPSBwYXRoLm1hdGNoKC9cXC8oW15cXC9dKykkLylbMV07XG5cbiAgICAgICAgICAgIC8vIElmIHdlIGFscmVhZHkgaGFzIGRlY2xhcmVkIGJ1bmRsZSwgdXNlIGl0IGZvciBsb2FkaW5nXG4gICAgICAgICAgICAvLyBkbyBub3Qgb3ZlcnJpZGVcbiAgICAgICAgICAgIGlmICghYnVuZGxlc1tuYW1lXSkge1xuICAgICAgICAgICAgICAgIGJ1bmRsZXNbbmFtZV0gPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXF1aXJlKHBhdGgpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICByZXF1aXJlcy5mb3JFYWNoKGNyZWF0ZUxvYWRlcik7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW1zIHtzdHJpbmd9IG5hbWVcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPG9iamVjdD58b2JqZWN0fVxuICAgICAqL1xuICAgIHJldHVybiAobmFtZSkgPT4ge1xuICAgICAgICBpZiAoIW5hbWUubWF0Y2goL1xcLmpzJC8pKSB7XG4gICAgICAgICAgICBuYW1lICs9ICcuanMnO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHJlcXVpcmUgPSBidW5kbGVzW25hbWVdLFxuICAgICAgICAgICAgYnVuZGxlTG9hZGVyO1xuXG4gICAgICAgIGlmIChyZXF1aXJlKSB7XG4gICAgICAgICAgICBidW5kbGVMb2FkZXIgPSByZXF1aXJlKCk7XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgYnVuZGxlTG9hZGVyID09PSAnZnVuY3Rpb24nICYmICFidW5kbGVMb2FkZXIubmFtZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBidW5kbGVMb2FkZXIocmVzb2x2ZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBidW5kbGVMb2FkZXI7XG4gICAgICAgIH1cbiAgICB9O1xufTtcblxuLyoqXG4gKiBVc2FnZTpcbiAqXG4gKiBgYGBcbiAqICByZXNvbHZlcnM6IFtcbiAqICAgICAgc3RhdGljUmVzb2x2ZXIoe1xuICogICAgICAgICAgY29uZmlnOiBfID0+IHsuLi59LFxuICogICAgICAgICAgZ2xvYmFsQnVzOiBfID0+IG5ldyBCYWNrYm9uZS5XcmVxci5FdmVudEVtaXR0ZXIoKVxuICogICAgICB9KVxuICogIF1cbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBoYXNoXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259XG4gKi9cbmxldCBzdGF0aWNSZXNvbHZlciA9IChoYXNoKSA9PiB7XG4gICAgcmV0dXJuIChuYW1lKSA9PiB7XG4gICAgICAgIHJldHVybiBoYXNoW25hbWVdO1xuICAgIH1cbn07XG5cbi8qKlxuICogVXNhZ2U6XG4gKlxuICogYGBgXG4gKiAgcmVzb2x2ZXJzOiBbXG4gKiAgICAgIGFycmF5UmVzb2x2ZXIoW1xuICogICAgICAgICAgc3RhdGljUmVzb2x2ZXIoLi4uKSxcbiAqICAgICAgICAgIHdlYnBhY2tSZXNvbHZlciguLi4pLFxuICogICAgICAgICAgLi4uLlxuICogICAgICBdKVxuICogIF1cbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB7ZnVuY3Rpb24obmFtZTogc3RyaW5nKVtdfSByZXNvbHZlcnNcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn1cbiAqL1xubGV0IGFycmF5UmVzb2x2ZXIgPSAocmVzb2x2ZXJzKSA9PiB7XG4gICAgbGV0IGJ1bmRsZUNhY2hlID0ge307XG5cbiAgICByZXR1cm4gKG5hbWUpID0+IHtcbiAgICAgICAgbGV0IHF1ZXVlID0gcmVzb2x2ZXJzLnNsaWNlKCk7XG5cbiAgICAgICAgaWYgKGJ1bmRsZUNhY2hlW25hbWVdKSB7XG4gICAgICAgICAgICByZXR1cm4gYnVuZGxlQ2FjaGVbbmFtZV07XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgbmV4dExvYWRlciA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICghcXVldWUubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgbG9hZGVyID0gcXVldWUuc2hpZnQoKTtcblxuICAgICAgICAgICAgcmV0dXJuIHRoZW4obG9hZGVyKG5hbWUpLCByZXN1bHQgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGJ1bmRsZUNhY2hlW25hbWVdID0gcmVzdWx0O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXh0TG9hZGVyKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIGJ1bmRsZUNhY2hlW25hbWVdID0gbmV4dExvYWRlcigpO1xuICAgIH1cbn07XG5cbi8qKlxuICogQHBhcmFtIHtzdHJpbmd9IGRlZmluaXRpb25cbiAqIEByZXR1cm5zIHt7bmFtZTogc3RyaW5nLCBmYWN0b3J5OiBzdHJpbmd8dW5kZWZpbmVkfX1cbiAqL1xubGV0IHBhcnNlU3RyaW5nRGVmaW5pdGlvbiA9IChkZWZpbml0aW9uKSA9PiB7XG4gICAgbGV0IG1hdGNoZXMgPSBkZWZpbml0aW9uID9cbiAgICAgICAgZGVmaW5pdGlvbi5tYXRjaCgvXihbXi5dKykoXFwuKC4rKSk/JC8pIDpcbiAgICAgICAgbnVsbDtcblxuICAgIGlmICghbWF0Y2hlcykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gbW9kdWxlIGZvcm1hdDogJyArIEpTT04uc3RyaW5naWZ5KGRlZmluaXRpb24pKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBidW5kbGVOYW1lOiBtYXRjaGVzWzFdLFxuICAgICAgICBmYWN0b3J5OiBtYXRjaGVzWzNdXG4gICAgfTtcbn07XG5cbi8qKlxuICogQHBhcmFtIHtzdHJpbmd9IGRlcGVuZGVuY3lJZFxuICogQHBhcmFtIHt7fX0gY29uZmlnXG4gKiBAcmV0dXJucyB7Kn1cbiAqL1xubGV0IG5vcm1hbGl6ZURlZmluaXRpb24gPSAoZGVwZW5kZW5jeUlkLCBjb25maWcpID0+IHtcbiAgICBsZXQgZGVmaW5pdGlvbiA9IHtcbiAgICAgICAgaWQ6IGRlcGVuZGVuY3lJZFxuICAgIH07XG5cbiAgICBpZiAodHlwZW9mIGNvbmZpZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgXy5leHRlbmQoZGVmaW5pdGlvbiwgcGFyc2VTdHJpbmdEZWZpbml0aW9uKGNvbmZpZykpO1xuICAgIH0gZWxzZSBpZiAoXy5pc0FycmF5KGNvbmZpZykpIHtcbiAgICAgICAgaWYgKGNvbmZpZy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIGRlZmluaXRpb24uaWQgPSBfLnVuaXF1ZUlkKCdkaScpO1xuXG4gICAgICAgICAgICBfLmV4dGVuZChkZWZpbml0aW9uLCBjb25maWdbMF0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgXy5leHRlbmQoZGVmaW5pdGlvbiwgcGFyc2VTdHJpbmdEZWZpbml0aW9uKGNvbmZpZ1swXSksIHtkZXBlbmRlbmNpZXM6IGNvbmZpZ1sxXX0pO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChfLmlzT2JqZWN0KGNvbmZpZykpIHtcbiAgICAgICAgXy5leHRlbmQoZGVmaW5pdGlvbiwgcGFyc2VTdHJpbmdEZWZpbml0aW9uKGRlcGVuZGVuY3lJZCksIHtkZXBlbmRlbmNpZXM6IGNvbmZpZ30pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biB0eXBlIG9mIGRlcGVuZGVuY3kgZGVmaW5pdGlvbicpO1xuICAgIH1cblxuICAgIHJldHVybiBfLmRlZmF1bHRzKGRlZmluaXRpb24sIHtcbiAgICAgICAgZmFjdG9yeTogJ2ZhY3RvcnknLFxuICAgICAgICBkZXBlbmRlbmNpZXM6IHt9XG4gICAgfSk7XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7e319IGRlcGVuZGVuY2llc1xuICogQHJldHVybnMge3t9fVxuICovXG5sZXQgbm9ybWFsaXplRGVmaW5pdGlvbnMgPSAoZGVwZW5kZW5jaWVzKSA9PiB7XG4gICAgbGV0IGRlZmluaXRpb25zID0ge307XG5cbiAgICBfLmZvckVhY2goZGVwZW5kZW5jaWVzLCAoY29uZmlnLCBkZXBlbmRlbmN5SWQpID0+IHtcbiAgICAgICAgZGVmaW5pdGlvbnNbZGVwZW5kZW5jeUlkXSA9IG5vcm1hbGl6ZURlZmluaXRpb24oZGVwZW5kZW5jeUlkLCBjb25maWcpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGRlZmluaXRpb25zO1xufTtcblxuLyoqXG4gKiBAcGFyYW0ge0RpRGVmaW5pdGlvbn0gZGVmaW5pdGlvblxuICogQHBhcmFtIHt7fX0gZGVwZW5kZW5jaWVzXG4gKlxuICogQHJldHVybnMge1Byb21pc2U8b2JqZWN0PnxvYmplY3R9XG4gKi9cbmxldCBmYWN0b3J5ID0gKGRlZmluaXRpb24sIGRlcGVuZGVuY2llcykgPT4ge1xuICAgIGxldCBNb2R1bGUgPSBkZWZpbml0aW9uLk1vZHVsZSxcbiAgICAgICAgZmFjdG9yeSA9IGRlZmluaXRpb24uZmFjdG9yeTtcblxuICAgIGlmIChNb2R1bGUuX19lc01vZHVsZSA9PT0gdHJ1ZSkge1xuICAgICAgICBNb2R1bGUgPSBfLnZhbHVlcyhNb2R1bGUpWzBdO1xuICAgIH1cblxuICAgIGlmIChNb2R1bGVbZmFjdG9yeV0pIHtcbiAgICAgICAgcmV0dXJuIE1vZHVsZVtmYWN0b3J5XShkZXBlbmRlbmNpZXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBuZXcgTW9kdWxlKGRlcGVuZGVuY2llcyk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBAcGFyYW0ge2Z1bmN0aW9uW119IHJlc29sdmVyc1xuICogQHBhcmFtIHtvYmplY3R9IGRlcGVuZGVuY2llc1xuICpcbiAqIEByZXR1cm5zIHtmdW5jdGlvbn1cbiAqL1xubGV0IGNyZWF0ZUNvbnRhaW5lciA9ICh7cmVzb2x2ZXJzID0gW10sIGRlcGVuZGVuY2llcyA9IHt9fSA9IHt9KSA9PiB7XG4gICAgbGV0IGRlZmluaXRpb25zID0gbm9ybWFsaXplRGVmaW5pdGlvbnMoZGVwZW5kZW5jaWVzKSxcbiAgICAgICAgcmVzb2x2ZSA9IGFycmF5UmVzb2x2ZXIocmVzb2x2ZXJzKTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7RGlEZWZpbml0aW9ufSBkZWZpbml0aW9uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fG9iamVjdH1cbiAgICAgKi9cbiAgICBsZXQgbG9hZE1vZHVsZUJ1bmRsZSA9IChkZWZpbml0aW9uKSA9PiB7XG4gICAgICAgIGlmIChkZWZpbml0aW9uLk1vZHVsZSkge1xuICAgICAgICAgICAgcmV0dXJuIGRlZmluaXRpb24uTW9kdWxlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoZW4ocmVzb2x2ZShkZWZpbml0aW9uLmJ1bmRsZU5hbWUpLCAoTW9kdWxlKSA9PiB7XG4gICAgICAgICAgICBpZiAoIU1vZHVsZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ0Nhbm5vdCBmaW5kIGJ1bmRsZSB3aXRoIG5hbWUgXCInICsgZGVmaW5pdGlvbi5idW5kbGVOYW1lICsgJ1wiJykpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBkZWZpbml0aW9uLk1vZHVsZSA9IE1vZHVsZTtcblxuICAgICAgICAgICAgcmV0dXJuIE1vZHVsZTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7RGlEZWZpbml0aW9ufHN0cmluZ30gbW9kdWxlXG4gICAgICogQHJldHVybnMge0RpRGVmaW5pdGlvbn1cbiAgICAgKi9cbiAgICBsZXQgbm9ybWFsaXplTW9kdWxlID0gKG1vZHVsZSkgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIG1vZHVsZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGlmIChkZWZpbml0aW9uc1ttb2R1bGVdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRlZmluaXRpb25zW21vZHVsZV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBkZWZpbml0aW9uc1ttb2R1bGVdID0gbm9ybWFsaXplRGVmaW5pdGlvbihtb2R1bGUsIHt9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnNvbGUubG9nKCdVTktOT1dOIE1PRFVMRScsIG1vZHVsZSk7XG5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIG1vZHVsZScpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xEaURlZmluaXRpb259IG1vZHVsZU5hbWVcbiAgICAgKiBAcGFyYW0ge3t9fSBwYXJhbXNcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPG9iamVjdD59XG4gICAgICovXG4gICAgbGV0IGxvYWRNb2R1bGUgPSAobW9kdWxlTmFtZSwgcGFyYW1zKSA9PiB7XG4gICAgICAgIGxldCBkZWZpbml0aW9uID0gbm9ybWFsaXplTW9kdWxlKG1vZHVsZU5hbWUpO1xuXG4gICAgICAgIGxldCBsb2FkID0gKCkgPT4ge1xuICAgICAgICAgICAgbGV0IHByb21pc2VzID0gW1xuICAgICAgICAgICAgICAgIGxvYWRNb2R1bGVEZXBlbmRlbmNpZXMoZGVmaW5pdGlvbiwgcGFyYW1zKSxcbiAgICAgICAgICAgICAgICBkZWZpbml0aW9uLmluc3RhbmNlID8gbnVsbCA6IGxvYWRNb2R1bGVCdW5kbGUoZGVmaW5pdGlvbilcbiAgICAgICAgICAgIF07XG5cbiAgICAgICAgICAgIHJldHVybiBhbGwocHJvbWlzZXMsIChbZGVwZW5kZW5jaWVzXSkgPT4ge1xuICAgICAgICAgICAgICAgIGxldCBfZmFjdG9yeSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRlZmluaXRpb24uaW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkZWZpbml0aW9uLmluc3RhbmNlO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhY3RvcnkoZGVmaW5pdGlvbiwgZGVwZW5kZW5jaWVzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAvLyBJZiBpbnN0YW5jZSBoYXMgdXBkYXRlRGVwZW5kZW5jaWVzIGludm9rZSBpdCBiZWZvcmUgY29tcGxldGUgREkgcmVzb2x2ZVxuICAgICAgICAgICAgICAgIHJldHVybiB0aGVuKF9mYWN0b3J5KCksIGluc3RhbmNlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGlzTmVlZFVwZGF0ZSA9ICFwYXJhbXMuZGlTZXNzaW9uSWQgfHwgZGVmaW5pdGlvbi5kaVNlc3Npb25JZCAhPT0gcGFyYW1zLmRpU2Vzc2lvbklkO1xuICAgICAgICAgICAgICAgICAgICBkZWZpbml0aW9uLmRpU2Vzc2lvbklkID0gcGFyYW1zLmRpU2Vzc2lvbklkO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChfLmlzRnVuY3Rpb24oaW5zdGFuY2UudXBkYXRlRGVwZW5kZW5jaWVzKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzTmVlZFVwZGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGVuKGluc3RhbmNlLnVwZGF0ZURlcGVuZGVuY2llcyhkZXBlbmRlbmNpZXMpLCBfID0+IGluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChkZWZpbml0aW9uLl9wcm9ncmVzcykge1xuICAgICAgICAgICAgcmV0dXJuIGRlZmluaXRpb24uX3Byb2dyZXNzO1xuICAgICAgICB9XG5cbiAgICAgICAgZGVmaW5pdGlvbi5fcHJvZ3Jlc3MgPSB0aGVuKGxvYWQoKSwgaW5zdGFuY2UgPT4ge1xuICAgICAgICAgICAgZGVmaW5pdGlvbi5pbnN0YW5jZSA9IGluc3RhbmNlO1xuXG4gICAgICAgICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiB0aGVuKGRlZmluaXRpb24uX3Byb2dyZXNzLCBpbnN0YW5jZSA9PiB7XG4gICAgICAgICAgICBkZWZpbml0aW9uLl9wcm9ncmVzcyA9IG51bGw7XG5cbiAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7e319IGRlcGVuZGVuY2llc1xuICAgICAqIEBwYXJhbSBwYXJhbXNcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPG9iamVjdD58b2JqZWN0fVxuICAgICAqL1xuICAgIGxldCBsb2FkTW9kdWxlcyA9IChkZXBlbmRlbmNpZXMsIHBhcmFtcykgPT4ge1xuICAgICAgICBsZXQgbG9hZGVkID0gXy5leHRlbmQoe30sIHBhcmFtcyk7XG5cbiAgICAgICAgaWYgKGRlcGVuZGVuY2llcykge1xuICAgICAgICAgICAgbGV0IHByb21pc2VzID0gXy5tYXAoZGVwZW5kZW5jaWVzLCAoZGVwZW5kZW5jeU5hbWUsIGtleSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGVuKGxvYWRNb2R1bGUoZGVwZW5kZW5jeU5hbWUsIHBhcmFtcyksIGRlcGVuZGVuY3kgPT4gbG9hZGVkW2tleV0gPSBkZXBlbmRlbmN5KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gYWxsKHByb21pc2VzLCBfID0+IGxvYWRlZCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbG9hZGVkO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xEaURlZmluaXRpb259IGRlZmluaXRpb25cbiAgICAgKiBAcGFyYW0ge3t9fSBwYXJhbXNcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPG9iamVjdD58b2JqZWN0fVxuICAgICAqL1xuICAgIGxldCBsb2FkTW9kdWxlRGVwZW5kZW5jaWVzID0gKGRlZmluaXRpb24sIHBhcmFtcykgPT4ge1xuICAgICAgICByZXR1cm4gbG9hZE1vZHVsZXMoZGVmaW5pdGlvbi5kZXBlbmRlbmNpZXMsIHBhcmFtcyk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfG9iamVjdH0gbW9kdWxlXG4gICAgICogQHBhcmFtIHt7fX0gW3BhcmFtc11cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPG9iamVjdD58b2JqZWN0fVxuICAgICAqL1xuICAgIGxldCBkaSA9IChtb2R1bGUsIHBhcmFtcykgPT4ge1xuICAgICAgICBsZXQgcHJvbWlzZTtcblxuICAgICAgICBwYXJhbXMgPSBwYXJhbXMgfHwge307XG5cbiAgICAgICAgaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBwcm9taXNlID0gbG9hZE1vZHVsZShtb2R1bGUsIHBhcmFtcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwcm9taXNlID0gbG9hZE1vZHVsZXMobW9kdWxlLCBwYXJhbXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcUNhdGNoKHByb21pc2UsIGVyciA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGVyci5zdGFjayk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgc2Vzc2lvbiBvZiBESSBsb2FkaW5nLiBXaGVuIHNlc3Npb24gY2xvc2UgLSBhbGwgdW5rbm93biBkZXBlbmRlbmNpZXMgd2lsbCBiZSB0cnVuY2F0ZWRcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHt7bG9hZDogRnVuY3Rpb24sIGNsb3NlOiBGdW5jdGlvbn19XG4gICAgICovXG4gICAgZGkuc2Vzc2lvbiA9ICgpID0+IHtcbiAgICAgICAgbGV0IGlkID0gXy51bmlxdWVJZCgnZGknKTtcblxuICAgICAgICByZXR1cm4ge1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFdvcmsgbGlrZSBvcmlnaW5hbCBESSBmdW5jdGlvblxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEBzZWUgZGlcbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9IG1vZHVsZVxuICAgICAgICAgICAgICogQHBhcmFtIHt7fX0gW3BhcmFtc11cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fG9iamVjdH1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgbG9hZDogKG1vZHVsZSwgcGFyYW1zKSA9PiB7XG4gICAgICAgICAgICAgICAgcGFyYW1zID0gcGFyYW1zIHx8IHt9O1xuICAgICAgICAgICAgICAgIHBhcmFtcy5kaVNlc3Npb25JZCA9IGlkO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGRpKG1vZHVsZSwgcGFyYW1zKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogUnVuIEdDIHRvIGRlc3Ryb3kgdW5rbm93biBkZXBlbmRlbmNpZXNcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgY2xvc2U6ICgpID0+IHtcbiAgICAgICAgICAgICAgICBfLmZvckVhY2goZGVmaW5pdGlvbnMsIChkZWZpbml0aW9uKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBpbnN0YW5jZSA9IGRlZmluaXRpb24uaW5zdGFuY2U7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFkZWZpbml0aW9uLmlzUGVyc2lzdGVudCAmJiBkZWZpbml0aW9uLmRpU2Vzc2lvbklkICYmIGRlZmluaXRpb24uZGlTZXNzaW9uSWQgIT09IGlkICYmIGluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaW5zdGFuY2UudHJpZ2dlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLnRyaWdnZXIoJ2RpOmRlc3Ryb3knKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF8uaXNGdW5jdGlvbihpbnN0YW5jZS5kZXN0cm95KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgZGVmaW5pdGlvbi5pbnN0YW5jZSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGlucHV0RGVmaW5pdGlvblxuICAgICAqIEBwYXJhbSBpbnN0YW5jZVxuICAgICAqXG4gICAgICogQHJldHVybnMge0RpQ29udGFpbmVyfVxuICAgICAqL1xuICAgIGRpLnB1dCA9IChpbnB1dERlZmluaXRpb24sIGluc3RhbmNlKSA9PiB7XG4gICAgICAgIGxldCBkZWZpbml0aW9uID0gbm9ybWFsaXplTW9kdWxlKGlucHV0RGVmaW5pdGlvbik7XG4gICAgICAgIGRlZmluaXRpb24uaW5zdGFuY2UgPSBpbnN0YW5jZTtcbiAgICAgICAgZGVmaW5pdGlvbi5pc1BlcnNpc3RlbnQgPSB0cnVlO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICByZXR1cm4gZGk7XG59O1xuXG5leHBvcnQge1xuICAgIGNyZWF0ZUNvbnRhaW5lcixcblxuICAgIHdlYnBhY2tSZXNvbHZlcixcbiAgICBzdGF0aWNSZXNvbHZlcixcbiAgICBhcnJheVJlc29sdmVyLFxuXG4gICAgdGhlbixcbiAgICBhbGwsXG4gICAgcUNhdGNoLFxuXG4gICAgcGFyc2VTdHJpbmdEZWZpbml0aW9uLFxuICAgIG5vcm1hbGl6ZURlZmluaXRpb25zLFxuICAgIG5vcm1hbGl6ZURlZmluaXRpb24sXG5cbiAgICBmYWN0b3J5XG59O1xuIl19