(function (global, factory) {
    if (typeof define === 'function' && define.amd) {
        define('di', ['exports', 'lodash'], factory);
    } else if (typeof exports !== 'undefined') {
        factory(exports, require('lodash'));
    } else {
        var mod = {
            exports: {}
        };
        factory(mod.exports, global.lodash);
        global.di = mod.exports;
    }
})(this, function (exports, _lodash) {
    'use strict';

    Object.defineProperty(exports, '__esModule', {
        value: true
    });

    var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

    //let {
    //    extend,
    //
    //    defaults,
    //    uniqueId,
    //    values,
    //
    //    isArray,
    //    isObject,
    //    isFunction,
    //
    //    forEach,
    //    map
    //    } = _;
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
            (0, _lodash.extend)(definition, parseStringDefinition(config));
        } else if ((0, _lodash.isArray)(config)) {
            if (config.length === 1) {
                definition.id = (0, _lodash.uniqueId)('di');

                (0, _lodash.extend)(definition, config[0]);
            } else {
                (0, _lodash.extend)(definition, parseStringDefinition(config[0]), { dependencies: config[1] });
            }
        } else if ((0, _lodash.isObject)(config)) {
            (0, _lodash.extend)(definition, parseStringDefinition(dependencyId), { dependencies: config });
        } else {
            throw new Error('Unknown type of dependency definition');
        }

        return (0, _lodash.defaults)(definition, {
            factory: 'factory',
            dependencies: {}
        });
    };

    /**
     * @param {DiDefinition} definition
     * @param {{}} definitions
     */
    var normalizeDefinitionDependencies = function normalizeDefinitionDependencies(definition, definitions) {
        (0, _lodash.forEach)(definition.dependencies, function (dependency, name) {
            if (typeof dependency === 'object' && !(0, _lodash.isArray)(dependency)) {
                dependency = [name, dependency];
            }

            if ((0, _lodash.isArray)(dependency)) {
                var depDefinition = normalizeDefinition((0, _lodash.uniqueId)(definition.id + '/' + name), dependency);
                definitions[depDefinition.id] = depDefinition;
                definition.dependencies[name] = depDefinition.id;

                normalizeDefinitionDependencies(depDefinition, definitions);
            }
        });
    };

    /**
     * @param {{}} dependencies
     * @returns {{}}
     */
    var normalizeDefinitions = function normalizeDefinitions(dependencies) {
        var definitions = {};

        (0, _lodash.forEach)(dependencies, function (config, dependencyId) {
            definitions[dependencyId] = normalizeDefinition(dependencyId, config);
        });

        (0, _lodash.forEach)(definitions, function (definition) {
            normalizeDefinitionDependencies(definition, definitions);
        });

        return definitions;
    };

    /**
     * @param {{__esModule: boolean}|function} Module
     * @param {string} factory
     * @param {{}} dependencies
     *
     * @returns {Promise<object>|object}
     */
    var factory = function factory(_ref, dependencies) {
        var Module = _ref.Module;
        var _factory2 = _ref.factory;

        if (Module.__esModule === true) {
            Module = (0, _lodash.values)(Module)[0];
        }

        if (Module[_factory2]) {
            return Module[_factory2](dependencies);
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
        var _ref2 = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

        var _ref2$resolvers = _ref2.resolvers;
        var resolvers = _ref2$resolvers === undefined ? [] : _ref2$resolvers;
        var _ref2$dependencies = _ref2.dependencies;
        var dependencies = _ref2$dependencies === undefined ? {} : _ref2$dependencies;

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

                return all(promises, function (_ref3) {
                    var _ref32 = _slicedToArray(_ref3, 1);

                    var dependencies = _ref32[0];

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

                        if ((0, _lodash.isFunction)(instance.updateDependencies)) {
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
            var loaded = (0, _lodash.extend)({}, params);

            if (dependencies) {
                var promises = (0, _lodash.map)(dependencies, function (dependencyName, key) {
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
        var di = function di(module) {
            var params = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

            var promise = undefined;

            if (typeof module === 'string') {
                promise = loadModule(module, params);
            } else {
                promise = loadModules(module, params);
            }

            return promise;
        };

        /**
         * Create session of DI loading. When session close - all unknown dependencies will be truncated
         *
         * @returns {{load: Function, close: Function}}
         */
        di.session = function () {
            var id = (0, _lodash.uniqueId)('di');

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
                load: function load(module) {
                    var params = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

                    params.diSessionId = id;

                    return di(module, params);
                },

                /**
                 * Run GC to destroy unknown dependencies
                 */
                close: function close() {
                    (0, _lodash.forEach)(definitions, function (definition) {
                        var instance = definition.instance;

                        if (!definition.isPersistent && definition.diSessionId && definition.diSessionId !== id && instance) {
                            if (instance.trigger) {
                                instance.trigger('di:destroy');
                            }

                            if ((0, _lodash.isFunction)(instance.destroy)) {
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
    exports.normalizeDefinitionDependencies = normalizeDefinitionDependencies;
    exports.parseStringDefinition = parseStringDefinition;
    exports.normalizeDefinitions = normalizeDefinitions;
    exports.normalizeDefinition = normalizeDefinition;
    exports.factory = factory;
});

//# sourceMappingURL=data:application/json;base64,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QUMvQixzQkFBVSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUM7O0FBRS9CLDZCQUFZO1NBQ2YsQ0FBQzs7QUFFRixlQUFPLEVBQUUsQ0FBQztLQUNiLENBQUM7O1lBR0UsZUFBZSxHQUFmLGVBQWU7WUFFZixlQUFlLEdBQWYsZUFBZTtZQUNmLGNBQWMsR0FBZCxjQUFjO1lBQ2QsYUFBYSxHQUFiLGFBQWE7WUFFYixJQUFJLEdBQUosSUFBSTtZQUNKLEdBQUcsR0FBSCxHQUFHO1lBQ0gsTUFBTSxHQUFOLE1BQU07WUFFTiwrQkFBK0IsR0FBL0IsK0JBQStCO1lBQy9CLHFCQUFxQixHQUFyQixxQkFBcUI7WUFDckIsb0JBQW9CLEdBQXBCLG9CQUFvQjtZQUNwQixtQkFBbUIsR0FBbkIsbUJBQW1CO1lBRW5CLE9BQU8sR0FBUCxPQUFPIiwiZmlsZSI6ImRpLmVzNS5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gICAgZXh0ZW5kLFxuXG4gICAgZGVmYXVsdHMsXG4gICAgdW5pcXVlSWQsXG4gICAgdmFsdWVzLFxuXG4gICAgaXNBcnJheSxcbiAgICBpc09iamVjdCxcbiAgICBpc0Z1bmN0aW9uLFxuXG4gICAgZm9yRWFjaCxcbiAgICBtYXBcbn0gZnJvbSAnbG9kYXNoJztcblxuLy9sZXQge1xuLy8gICAgZXh0ZW5kLFxuLy9cbi8vICAgIGRlZmF1bHRzLFxuLy8gICAgdW5pcXVlSWQsXG4vLyAgICB2YWx1ZXMsXG4vL1xuLy8gICAgaXNBcnJheSxcbi8vICAgIGlzT2JqZWN0LFxuLy8gICAgaXNGdW5jdGlvbixcbi8vXG4vLyAgICBmb3JFYWNoLFxuLy8gICAgbWFwXG4vLyAgICB9ID0gXztcbi8qKlxuICogQHR5cGVkZWYge3tidW5kbGVOYW1lOiBzdHJpbmcsIGZhY3Rvcnk6IHN0cmluZywgTW9kdWxlOiAoZnVuY3Rpb258e2ZhY3Rvcnk6IGZ1bmN0aW9ufSksIGluc3RhbmNlOiBvYmplY3QsIGRlcGVuZGVuY2llczogb2JqZWN0fX0gRGlEZWZpbml0aW9uXG4gKi9cblxuLyoqXG4gKiBAdHlwZWRlZiB7e3Nlc3Npb246IGZ1bmN0aW9uLCBwdXQ6IGZ1bmN0aW9ufX0gRGlDb250YWluZXJcbiAqL1xuXG4vKipcbiAqIEBwYXJhbSB7UHJvbWlzZXwqfSBwcm9taXNlXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1xuICpcbiAqIEByZXR1cm5zIHtQcm9taXNlfCp9XG4gKi9cbmxldCB0aGVuID0gKHByb21pc2UsIGNhbGxiYWNrKSA9PiB7XG4gICAgaWYgKHByb21pc2UgJiYgcHJvbWlzZS50aGVuKSB7XG4gICAgICAgIHJldHVybiBwcm9taXNlLnRoZW4oY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhwcm9taXNlKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7KFByb21pc2V8KilbXX0gdmFsdWVzXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1xuICpcbiAqIEByZXR1cm5zIHtQcm9taXNlfCp9XG4gKi9cbmxldCBhbGwgPSAodmFsdWVzLCBjYWxsYmFjaykgPT4ge1xuICAgIGxldCBzb21lID0gdmFsdWVzLnNvbWUocHJvbWlzZSA9PiBCb29sZWFuKHByb21pc2UgJiYgcHJvbWlzZS50aGVuKSk7XG5cbiAgICBpZiAoc29tZSkge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwodmFsdWVzKS50aGVuKGNhbGxiYWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2sodmFsdWVzKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7UHJvbWlzZXwqfSBwcm9taXNlXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1xuICpcbiAqIEByZXR1cm5zIHtQcm9taXNlfCp9XG4gKi9cbmxldCBxQ2F0Y2ggPSAocHJvbWlzZSwgY2FsbGJhY2spID0+IHtcbiAgICBpZiAocHJvbWlzZSAmJiBwcm9taXNlLmNhdGNoKSB7XG4gICAgICAgIHByb21pc2UuY2F0Y2goY2FsbGJhY2spO1xuICAgIH1cblxuICAgIHJldHVybiBwcm9taXNlO1xufTtcblxuLyoqXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufHtrZXlzOiBmdW5jdGlvbn19IHJlcXVpcmVcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn1cbiAqL1xubGV0IGNyZWF0ZUxvYWRlciA9IGZ1bmN0aW9uIChyZXF1aXJlKSB7XG4gICAgbGV0IGJ1bmRsZXMgPSB7fTtcblxuICAgIHJlcXVpcmUua2V5cygpLmZvckVhY2goKHBhdGgpID0+IHtcbiAgICAgICAgbGV0IG5hbWUgPSBwYXRoLm1hdGNoKC9cXC8oW15cXC9dKykkLylbMV07XG5cbiAgICAgICAgYnVuZGxlc1tuYW1lXSA9IHtwYXRofTtcbiAgICB9KTtcblxuICAgIHJldHVybiAobmFtZSkgPT4ge1xuICAgICAgICBsZXQgZGVzY3JpcHRpb24gPSBidW5kbGVzW25hbWVdLFxuICAgICAgICAgICAgYnVuZGxlTG9hZGVyO1xuXG4gICAgICAgIGlmIChkZXNjcmlwdGlvbikge1xuICAgICAgICAgICAgYnVuZGxlTG9hZGVyID0gcmVxdWlyZShkZXNjcmlwdGlvbi5wYXRoKTtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBidW5kbGVMb2FkZXIgPT09ICdmdW5jdGlvbicgJiYgIWJ1bmRsZUxvYWRlci5uYW1lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGJ1bmRsZUxvYWRlcihyZXNvbHZlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGJ1bmRsZUxvYWRlcjtcbiAgICAgICAgfVxuICAgIH07XG59O1xuXG4vKipcbiAqIFVzYWdlOlxuICpcbiAqIGBgYFxuICogIHJlc29sdmVyczogW1xuICogICAgICB3ZWJwYWNrUmVzb2x2ZXIoW1xuICogICAgICAgICAgcmVxdWlyZS5jb250ZXh0KCcuL3N0YXRlcy8nLCB0cnVlLCAvU3RhdGUuanMkLyksXG4gKiAgICAgICAgICByZXF1aXJlLmNvbnRleHQoJy4vbW9kZWxzLycsIHRydWUsIC8uanMkLylcbiAqICAgICAgXSlcbiAqICBdXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0ge2Z1bmN0aW9uW118e2tleXM6IGZ1bmN0aW9ufVtdfSByZXF1aXJlc1xuICogQHJldHVybnMge0Z1bmN0aW9ufVxuICovXG5sZXQgd2VicGFja1Jlc29sdmVyID0gKHJlcXVpcmVzKSA9PiB7XG4gICAgbGV0IGJ1bmRsZXMgPSB7fTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb258e2tleXM6IGZ1bmN0aW9ufX0gcmVxdWlyZVxuICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbn1cbiAgICAgKi9cbiAgICBsZXQgY3JlYXRlTG9hZGVyID0gZnVuY3Rpb24gKHJlcXVpcmUpIHtcbiAgICAgICAgcmVxdWlyZS5rZXlzKCkuZm9yRWFjaCgocGF0aCkgPT4ge1xuICAgICAgICAgICAgbGV0IG5hbWUgPSBwYXRoLm1hdGNoKC9cXC8oW15cXC9dKykkLylbMV07XG5cbiAgICAgICAgICAgIC8vIElmIHdlIGFscmVhZHkgaGFzIGRlY2xhcmVkIGJ1bmRsZSwgdXNlIGl0IGZvciBsb2FkaW5nXG4gICAgICAgICAgICAvLyBkbyBub3Qgb3ZlcnJpZGVcbiAgICAgICAgICAgIGlmICghYnVuZGxlc1tuYW1lXSkge1xuICAgICAgICAgICAgICAgIGJ1bmRsZXNbbmFtZV0gPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXF1aXJlKHBhdGgpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICByZXF1aXJlcy5mb3JFYWNoKGNyZWF0ZUxvYWRlcik7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW1zIHtzdHJpbmd9IG5hbWVcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPG9iamVjdD58b2JqZWN0fVxuICAgICAqL1xuICAgIHJldHVybiAobmFtZSkgPT4ge1xuICAgICAgICBpZiAoIW5hbWUubWF0Y2goL1xcLmpzJC8pKSB7XG4gICAgICAgICAgICBuYW1lICs9ICcuanMnO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHJlcXVpcmUgPSBidW5kbGVzW25hbWVdLFxuICAgICAgICAgICAgYnVuZGxlTG9hZGVyO1xuXG4gICAgICAgIGlmIChyZXF1aXJlKSB7XG4gICAgICAgICAgICBidW5kbGVMb2FkZXIgPSByZXF1aXJlKCk7XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgYnVuZGxlTG9hZGVyID09PSAnZnVuY3Rpb24nICYmICFidW5kbGVMb2FkZXIubmFtZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBidW5kbGVMb2FkZXIocmVzb2x2ZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBidW5kbGVMb2FkZXI7XG4gICAgICAgIH1cbiAgICB9O1xufTtcblxuLyoqXG4gKiBVc2FnZTpcbiAqXG4gKiBgYGBcbiAqICByZXNvbHZlcnM6IFtcbiAqICAgICAgc3RhdGljUmVzb2x2ZXIoe1xuICogICAgICAgICAgY29uZmlnOiBfID0+IHsuLi59LFxuICogICAgICAgICAgZ2xvYmFsQnVzOiBfID0+IG5ldyBCYWNrYm9uZS5XcmVxci5FdmVudEVtaXR0ZXIoKVxuICogICAgICB9KVxuICogIF1cbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBoYXNoXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259XG4gKi9cbmxldCBzdGF0aWNSZXNvbHZlciA9IChoYXNoKSA9PiB7XG4gICAgcmV0dXJuIChuYW1lKSA9PiB7XG4gICAgICAgIHJldHVybiBoYXNoW25hbWVdO1xuICAgIH1cbn07XG5cbi8qKlxuICogVXNhZ2U6XG4gKlxuICogYGBgXG4gKiAgcmVzb2x2ZXJzOiBbXG4gKiAgICAgIGFycmF5UmVzb2x2ZXIoW1xuICogICAgICAgICAgc3RhdGljUmVzb2x2ZXIoLi4uKSxcbiAqICAgICAgICAgIHdlYnBhY2tSZXNvbHZlciguLi4pLFxuICogICAgICAgICAgLi4uLlxuICogICAgICBdKVxuICogIF1cbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB7ZnVuY3Rpb24obmFtZTogc3RyaW5nKVtdfSByZXNvbHZlcnNcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn1cbiAqL1xubGV0IGFycmF5UmVzb2x2ZXIgPSAocmVzb2x2ZXJzKSA9PiB7XG4gICAgbGV0IGJ1bmRsZUNhY2hlID0ge307XG5cbiAgICByZXR1cm4gKG5hbWUpID0+IHtcbiAgICAgICAgbGV0IHF1ZXVlID0gcmVzb2x2ZXJzLnNsaWNlKCk7XG5cbiAgICAgICAgaWYgKGJ1bmRsZUNhY2hlW25hbWVdKSB7XG4gICAgICAgICAgICByZXR1cm4gYnVuZGxlQ2FjaGVbbmFtZV07XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgbmV4dExvYWRlciA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICghcXVldWUubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgbG9hZGVyID0gcXVldWUuc2hpZnQoKTtcblxuICAgICAgICAgICAgcmV0dXJuIHRoZW4obG9hZGVyKG5hbWUpLCByZXN1bHQgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGJ1bmRsZUNhY2hlW25hbWVdID0gcmVzdWx0O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXh0TG9hZGVyKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIGJ1bmRsZUNhY2hlW25hbWVdID0gbmV4dExvYWRlcigpO1xuICAgIH1cbn07XG5cbi8qKlxuICogQHBhcmFtIHtzdHJpbmd9IGRlZmluaXRpb25cbiAqIEByZXR1cm5zIHt7bmFtZTogc3RyaW5nLCBmYWN0b3J5OiBzdHJpbmd8dW5kZWZpbmVkfX1cbiAqL1xubGV0IHBhcnNlU3RyaW5nRGVmaW5pdGlvbiA9IChkZWZpbml0aW9uKSA9PiB7XG4gICAgbGV0IG1hdGNoZXMgPSBkZWZpbml0aW9uID9cbiAgICAgICAgZGVmaW5pdGlvbi5tYXRjaCgvXihbXi5dKykoXFwuKC4rKSk/JC8pIDpcbiAgICAgICAgbnVsbDtcblxuICAgIGlmICghbWF0Y2hlcykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gbW9kdWxlIGZvcm1hdDogJyArIEpTT04uc3RyaW5naWZ5KGRlZmluaXRpb24pKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBidW5kbGVOYW1lOiBtYXRjaGVzWzFdLFxuICAgICAgICBmYWN0b3J5OiBtYXRjaGVzWzNdXG4gICAgfTtcbn07XG5cbi8qKlxuICogQHBhcmFtIHtzdHJpbmd9IGRlcGVuZGVuY3lJZFxuICogQHBhcmFtIHt7fX0gY29uZmlnXG4gKiBAcmV0dXJucyB7Kn1cbiAqL1xubGV0IG5vcm1hbGl6ZURlZmluaXRpb24gPSAoZGVwZW5kZW5jeUlkLCBjb25maWcpID0+IHtcbiAgICBsZXQgZGVmaW5pdGlvbiA9IHtcbiAgICAgICAgaWQ6IGRlcGVuZGVuY3lJZFxuICAgIH07XG5cbiAgICBpZiAodHlwZW9mIGNvbmZpZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgZXh0ZW5kKGRlZmluaXRpb24sIHBhcnNlU3RyaW5nRGVmaW5pdGlvbihjb25maWcpKTtcbiAgICB9IGVsc2UgaWYgKGlzQXJyYXkoY29uZmlnKSkge1xuICAgICAgICBpZiAoY29uZmlnLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgZGVmaW5pdGlvbi5pZCA9IHVuaXF1ZUlkKCdkaScpO1xuXG4gICAgICAgICAgICBleHRlbmQoZGVmaW5pdGlvbiwgY29uZmlnWzBdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGV4dGVuZChkZWZpbml0aW9uLCBwYXJzZVN0cmluZ0RlZmluaXRpb24oY29uZmlnWzBdKSwge2RlcGVuZGVuY2llczogY29uZmlnWzFdfSk7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzT2JqZWN0KGNvbmZpZykpIHtcbiAgICAgICAgZXh0ZW5kKGRlZmluaXRpb24sIHBhcnNlU3RyaW5nRGVmaW5pdGlvbihkZXBlbmRlbmN5SWQpLCB7ZGVwZW5kZW5jaWVzOiBjb25maWd9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gdHlwZSBvZiBkZXBlbmRlbmN5IGRlZmluaXRpb24nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGVmYXVsdHMoZGVmaW5pdGlvbiwge1xuICAgICAgICBmYWN0b3J5OiAnZmFjdG9yeScsXG4gICAgICAgIGRlcGVuZGVuY2llczoge31cbiAgICB9KTtcbn07XG5cbi8qKlxuICogQHBhcmFtIHtEaURlZmluaXRpb259IGRlZmluaXRpb25cbiAqIEBwYXJhbSB7e319IGRlZmluaXRpb25zXG4gKi9cbmxldCBub3JtYWxpemVEZWZpbml0aW9uRGVwZW5kZW5jaWVzID0gKGRlZmluaXRpb24sIGRlZmluaXRpb25zKSA9PiB7XG4gICAgZm9yRWFjaChkZWZpbml0aW9uLmRlcGVuZGVuY2llcywgKGRlcGVuZGVuY3ksIG5hbWUpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBkZXBlbmRlbmN5ID09PSAnb2JqZWN0JyAmJiAhaXNBcnJheShkZXBlbmRlbmN5KSkge1xuICAgICAgICAgICAgZGVwZW5kZW5jeSA9IFtuYW1lLCBkZXBlbmRlbmN5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc0FycmF5KGRlcGVuZGVuY3kpKSB7XG4gICAgICAgICAgICBsZXQgZGVwRGVmaW5pdGlvbiA9IG5vcm1hbGl6ZURlZmluaXRpb24odW5pcXVlSWQoZGVmaW5pdGlvbi5pZCArICcvJyArIG5hbWUpLCBkZXBlbmRlbmN5KTtcbiAgICAgICAgICAgIGRlZmluaXRpb25zW2RlcERlZmluaXRpb24uaWRdID0gZGVwRGVmaW5pdGlvbjtcbiAgICAgICAgICAgIGRlZmluaXRpb24uZGVwZW5kZW5jaWVzW25hbWVdID0gZGVwRGVmaW5pdGlvbi5pZDtcblxuICAgICAgICAgICAgbm9ybWFsaXplRGVmaW5pdGlvbkRlcGVuZGVuY2llcyhkZXBEZWZpbml0aW9uLCBkZWZpbml0aW9ucyk7XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbi8qKlxuICogQHBhcmFtIHt7fX0gZGVwZW5kZW5jaWVzXG4gKiBAcmV0dXJucyB7e319XG4gKi9cbmxldCBub3JtYWxpemVEZWZpbml0aW9ucyA9IChkZXBlbmRlbmNpZXMpID0+IHtcbiAgICBsZXQgZGVmaW5pdGlvbnMgPSB7fTtcblxuICAgIGZvckVhY2goZGVwZW5kZW5jaWVzLCAoY29uZmlnLCBkZXBlbmRlbmN5SWQpID0+IHtcbiAgICAgICAgZGVmaW5pdGlvbnNbZGVwZW5kZW5jeUlkXSA9IG5vcm1hbGl6ZURlZmluaXRpb24oZGVwZW5kZW5jeUlkLCBjb25maWcpO1xuICAgIH0pO1xuXG4gICAgZm9yRWFjaChkZWZpbml0aW9ucywgKGRlZmluaXRpb24pID0+IHtcbiAgICAgICAgbm9ybWFsaXplRGVmaW5pdGlvbkRlcGVuZGVuY2llcyhkZWZpbml0aW9uLCBkZWZpbml0aW9ucyk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gZGVmaW5pdGlvbnM7XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7e19fZXNNb2R1bGU6IGJvb2xlYW59fGZ1bmN0aW9ufSBNb2R1bGVcbiAqIEBwYXJhbSB7c3RyaW5nfSBmYWN0b3J5XG4gKiBAcGFyYW0ge3t9fSBkZXBlbmRlbmNpZXNcbiAqXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fG9iamVjdH1cbiAqL1xubGV0IGZhY3RvcnkgPSAoe01vZHVsZSwgZmFjdG9yeX0sIGRlcGVuZGVuY2llcykgPT4ge1xuICAgIGlmIChNb2R1bGUuX19lc01vZHVsZSA9PT0gdHJ1ZSkge1xuICAgICAgICBNb2R1bGUgPSB2YWx1ZXMoTW9kdWxlKVswXTtcbiAgICB9XG5cbiAgICBpZiAoTW9kdWxlW2ZhY3RvcnldKSB7XG4gICAgICAgIHJldHVybiBNb2R1bGVbZmFjdG9yeV0oZGVwZW5kZW5jaWVzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbmV3IE1vZHVsZShkZXBlbmRlbmNpZXMpO1xuICAgIH1cbn07XG5cbi8qKlxuICogQHBhcmFtIHtmdW5jdGlvbltdfSByZXNvbHZlcnNcbiAqIEBwYXJhbSB7b2JqZWN0fSBkZXBlbmRlbmNpZXNcbiAqXG4gKiBAcmV0dXJucyB7ZnVuY3Rpb259XG4gKi9cbmxldCBjcmVhdGVDb250YWluZXIgPSAoe3Jlc29sdmVycyA9IFtdLCBkZXBlbmRlbmNpZXMgPSB7fX0gPSB7fSkgPT4ge1xuICAgIGxldCBkZWZpbml0aW9ucyA9IG5vcm1hbGl6ZURlZmluaXRpb25zKGRlcGVuZGVuY2llcyksXG4gICAgICAgIHJlc29sdmUgPSBhcnJheVJlc29sdmVyKHJlc29sdmVycyk7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0RpRGVmaW5pdGlvbn0gZGVmaW5pdGlvblxuICAgICAqXG4gICAgICogQHJldHVybnMge1Byb21pc2U8b2JqZWN0PnxvYmplY3R9XG4gICAgICovXG4gICAgbGV0IGxvYWRNb2R1bGVCdW5kbGUgPSAoZGVmaW5pdGlvbikgPT4ge1xuICAgICAgICBpZiAoZGVmaW5pdGlvbi5Nb2R1bGUpIHtcbiAgICAgICAgICAgIHJldHVybiBkZWZpbml0aW9uLk1vZHVsZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGVuKHJlc29sdmUoZGVmaW5pdGlvbi5idW5kbGVOYW1lKSwgKE1vZHVsZSkgPT4ge1xuICAgICAgICAgICAgaWYgKCFNb2R1bGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKCdDYW5ub3QgZmluZCBidW5kbGUgd2l0aCBuYW1lIFwiJyArIGRlZmluaXRpb24uYnVuZGxlTmFtZSArICdcIicpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZGVmaW5pdGlvbi5Nb2R1bGUgPSBNb2R1bGU7XG5cbiAgICAgICAgICAgIHJldHVybiBNb2R1bGU7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0RpRGVmaW5pdGlvbnxzdHJpbmd9IG1vZHVsZVxuICAgICAqIEByZXR1cm5zIHtEaURlZmluaXRpb259XG4gICAgICovXG4gICAgbGV0IG5vcm1hbGl6ZU1vZHVsZSA9IChtb2R1bGUpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBpZiAoZGVmaW5pdGlvbnNbbW9kdWxlXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBkZWZpbml0aW9uc1ttb2R1bGVdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZGVmaW5pdGlvbnNbbW9kdWxlXSA9IG5vcm1hbGl6ZURlZmluaXRpb24obW9kdWxlLCB7fSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zb2xlLmxvZygnVU5LTk9XTiBNT0RVTEUnLCBtb2R1bGUpO1xuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBtb2R1bGUnKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd8RGlEZWZpbml0aW9ufSBtb2R1bGVOYW1lXG4gICAgICogQHBhcmFtIHt7fX0gcGFyYW1zXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fVxuICAgICAqL1xuICAgIGxldCBsb2FkTW9kdWxlID0gKG1vZHVsZU5hbWUsIHBhcmFtcykgPT4ge1xuICAgICAgICBsZXQgZGVmaW5pdGlvbiA9IG5vcm1hbGl6ZU1vZHVsZShtb2R1bGVOYW1lKTtcblxuICAgICAgICBsZXQgbG9hZCA9ICgpID0+IHtcbiAgICAgICAgICAgIGxldCBwcm9taXNlcyA9IFtcbiAgICAgICAgICAgICAgICBsb2FkTW9kdWxlRGVwZW5kZW5jaWVzKGRlZmluaXRpb24sIHBhcmFtcyksXG4gICAgICAgICAgICAgICAgZGVmaW5pdGlvbi5pbnN0YW5jZSA/IG51bGwgOiBsb2FkTW9kdWxlQnVuZGxlKGRlZmluaXRpb24pXG4gICAgICAgICAgICBdO1xuXG4gICAgICAgICAgICByZXR1cm4gYWxsKHByb21pc2VzLCAoW2RlcGVuZGVuY2llc10pID0+IHtcbiAgICAgICAgICAgICAgICBsZXQgX2ZhY3RvcnkgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkZWZpbml0aW9uLmluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGVmaW5pdGlvbi5pbnN0YW5jZTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWN0b3J5KGRlZmluaXRpb24sIGRlcGVuZGVuY2llcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgLy8gSWYgaW5zdGFuY2UgaGFzIHVwZGF0ZURlcGVuZGVuY2llcyBpbnZva2UgaXQgYmVmb3JlIGNvbXBsZXRlIERJIHJlc29sdmVcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhlbihfZmFjdG9yeSgpLCBpbnN0YW5jZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBpc05lZWRVcGRhdGUgPSAhcGFyYW1zLmRpU2Vzc2lvbklkIHx8IGRlZmluaXRpb24uZGlTZXNzaW9uSWQgIT09IHBhcmFtcy5kaVNlc3Npb25JZDtcbiAgICAgICAgICAgICAgICAgICAgZGVmaW5pdGlvbi5kaVNlc3Npb25JZCA9IHBhcmFtcy5kaVNlc3Npb25JZDtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoaXNGdW5jdGlvbihpbnN0YW5jZS51cGRhdGVEZXBlbmRlbmNpZXMpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNOZWVkVXBkYXRlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoZW4oaW5zdGFuY2UudXBkYXRlRGVwZW5kZW5jaWVzKGRlcGVuZGVuY2llcyksIF8gPT4gaW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKGRlZmluaXRpb24uX3Byb2dyZXNzKSB7XG4gICAgICAgICAgICByZXR1cm4gZGVmaW5pdGlvbi5fcHJvZ3Jlc3M7XG4gICAgICAgIH1cblxuICAgICAgICBkZWZpbml0aW9uLl9wcm9ncmVzcyA9IHRoZW4obG9hZCgpLCBpbnN0YW5jZSA9PiB7XG4gICAgICAgICAgICBkZWZpbml0aW9uLmluc3RhbmNlID0gaW5zdGFuY2U7XG5cbiAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHRoZW4oZGVmaW5pdGlvbi5fcHJvZ3Jlc3MsIGluc3RhbmNlID0+IHtcbiAgICAgICAgICAgIGRlZmluaXRpb24uX3Byb2dyZXNzID0gbnVsbDtcblxuICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHt7fX0gZGVwZW5kZW5jaWVzXG4gICAgICogQHBhcmFtIHBhcmFtc1xuICAgICAqXG4gICAgICogQHJldHVybnMge1Byb21pc2U8b2JqZWN0PnxvYmplY3R9XG4gICAgICovXG4gICAgbGV0IGxvYWRNb2R1bGVzID0gKGRlcGVuZGVuY2llcywgcGFyYW1zKSA9PiB7XG4gICAgICAgIGxldCBsb2FkZWQgPSBleHRlbmQoe30sIHBhcmFtcyk7XG5cbiAgICAgICAgaWYgKGRlcGVuZGVuY2llcykge1xuICAgICAgICAgICAgbGV0IHByb21pc2VzID0gbWFwKGRlcGVuZGVuY2llcywgKGRlcGVuZGVuY3lOYW1lLCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhlbihsb2FkTW9kdWxlKGRlcGVuZGVuY3lOYW1lLCBwYXJhbXMpLCBkZXBlbmRlbmN5ID0+IGxvYWRlZFtrZXldID0gZGVwZW5kZW5jeSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIGFsbChwcm9taXNlcywgXyA9PiBsb2FkZWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGxvYWRlZDtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd8RGlEZWZpbml0aW9ufSBkZWZpbml0aW9uXG4gICAgICogQHBhcmFtIHt7fX0gcGFyYW1zXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fG9iamVjdH1cbiAgICAgKi9cbiAgICBsZXQgbG9hZE1vZHVsZURlcGVuZGVuY2llcyA9IChkZWZpbml0aW9uLCBwYXJhbXMpID0+IHtcbiAgICAgICAgcmV0dXJuIGxvYWRNb2R1bGVzKGRlZmluaXRpb24uZGVwZW5kZW5jaWVzLCBwYXJhbXMpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9IG1vZHVsZVxuICAgICAqIEBwYXJhbSB7e319IFtwYXJhbXNdXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fG9iamVjdH1cbiAgICAgKi9cbiAgICBsZXQgZGkgPSAobW9kdWxlLCBwYXJhbXMgPSB7fSkgPT4ge1xuICAgICAgICBsZXQgcHJvbWlzZTtcblxuICAgICAgICBpZiAodHlwZW9mIG1vZHVsZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHByb21pc2UgPSBsb2FkTW9kdWxlKG1vZHVsZSwgcGFyYW1zKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHByb21pc2UgPSBsb2FkTW9kdWxlcyhtb2R1bGUsIHBhcmFtcyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIHNlc3Npb24gb2YgREkgbG9hZGluZy4gV2hlbiBzZXNzaW9uIGNsb3NlIC0gYWxsIHVua25vd24gZGVwZW5kZW5jaWVzIHdpbGwgYmUgdHJ1bmNhdGVkXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7e2xvYWQ6IEZ1bmN0aW9uLCBjbG9zZTogRnVuY3Rpb259fVxuICAgICAqL1xuICAgIGRpLnNlc3Npb24gPSAoKSA9PiB7XG4gICAgICAgIGxldCBpZCA9IHVuaXF1ZUlkKCdkaScpO1xuXG4gICAgICAgIHJldHVybiB7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogV29yayBsaWtlIG9yaWdpbmFsIERJIGZ1bmN0aW9uXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHNlZSBkaVxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfG9iamVjdH0gbW9kdWxlXG4gICAgICAgICAgICAgKiBAcGFyYW0ge3t9fSBbcGFyYW1zXVxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEByZXR1cm5zIHtQcm9taXNlPG9iamVjdD58b2JqZWN0fVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBsb2FkOiAobW9kdWxlLCBwYXJhbXMgPSB7fSkgPT4ge1xuICAgICAgICAgICAgICAgIHBhcmFtcy5kaVNlc3Npb25JZCA9IGlkO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGRpKG1vZHVsZSwgcGFyYW1zKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogUnVuIEdDIHRvIGRlc3Ryb3kgdW5rbm93biBkZXBlbmRlbmNpZXNcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgY2xvc2U6ICgpID0+IHtcbiAgICAgICAgICAgICAgICBmb3JFYWNoKGRlZmluaXRpb25zLCAoZGVmaW5pdGlvbikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsZXQgaW5zdGFuY2UgPSBkZWZpbml0aW9uLmluc3RhbmNlO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICghZGVmaW5pdGlvbi5pc1BlcnNpc3RlbnQgJiYgZGVmaW5pdGlvbi5kaVNlc3Npb25JZCAmJiBkZWZpbml0aW9uLmRpU2Vzc2lvbklkICE9PSBpZCAmJiBpbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGluc3RhbmNlLnRyaWdnZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS50cmlnZ2VyKCdkaTpkZXN0cm95Jyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc0Z1bmN0aW9uKGluc3RhbmNlLmRlc3Ryb3kpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2UuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZpbml0aW9uLmluc3RhbmNlID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gaW5wdXREZWZpbml0aW9uXG4gICAgICogQHBhcmFtIGluc3RhbmNlXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7RGlDb250YWluZXJ9XG4gICAgICovXG4gICAgZGkucHV0ID0gKGlucHV0RGVmaW5pdGlvbiwgaW5zdGFuY2UpID0+IHtcbiAgICAgICAgbGV0IGRlZmluaXRpb24gPSBub3JtYWxpemVNb2R1bGUoaW5wdXREZWZpbml0aW9uKTtcbiAgICAgICAgZGVmaW5pdGlvbi5pbnN0YW5jZSA9IGluc3RhbmNlO1xuICAgICAgICBkZWZpbml0aW9uLmlzUGVyc2lzdGVudCA9IHRydWU7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIHJldHVybiBkaTtcbn07XG5cbmV4cG9ydCB7XG4gICAgY3JlYXRlQ29udGFpbmVyLFxuXG4gICAgd2VicGFja1Jlc29sdmVyLFxuICAgIHN0YXRpY1Jlc29sdmVyLFxuICAgIGFycmF5UmVzb2x2ZXIsXG5cbiAgICB0aGVuLFxuICAgIGFsbCxcbiAgICBxQ2F0Y2gsXG5cbiAgICBub3JtYWxpemVEZWZpbml0aW9uRGVwZW5kZW5jaWVzLFxuICAgIHBhcnNlU3RyaW5nRGVmaW5pdGlvbixcbiAgICBub3JtYWxpemVEZWZpbml0aW9ucyxcbiAgICBub3JtYWxpemVEZWZpbml0aW9uLFxuXG4gICAgZmFjdG9yeVxufTtcbiJdfQ==