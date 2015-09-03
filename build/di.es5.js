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

    // This ugly construction is compile to smaller sized file
    var extend = _lodash.extend;
    var defaults = _lodash.defaults;
    var uniqueId = _lodash.uniqueId;
    var values = _lodash.values;
    var isArray = _lodash.isArray;
    var isObject = _lodash.isObject;
    var isFunction = _lodash.isFunction;
    var forEach = _lodash.forEach;
    var map = _lodash.map;

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
            extend(definition, parseStringDefinition(config));
        } else if (isArray(config)) {
            if (config.length === 1) {
                definition.id = uniqueId('di');

                extend(definition, config[0]);
            } else {
                extend(definition, parseStringDefinition(config[0]), { dependencies: config[1] });
            }
        } else if (isObject(config)) {
            extend(definition, parseStringDefinition(dependencyId), { dependencies: config });
        } else {
            throw new Error('Unknown type of dependency definition');
        }

        return defaults(definition, {
            factory: 'factory',
            dependencies: {}
        });
    };

    /**
     * @param {DiDefinition} definition
     * @param {{}} definitions
     */
    var normalizeDefinitionDependencies = function normalizeDefinitionDependencies(definition, definitions) {
        forEach(definition.dependencies, function (dependency, name) {
            if (typeof dependency === 'object' && !isArray(dependency)) {
                dependency = [name, dependency];
            }

            if (isArray(dependency)) {
                var depDefinition = normalizeDefinition(uniqueId(definition.id + '/' + name), dependency);
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

        forEach(dependencies, function (config, dependencyId) {
            definitions[dependencyId] = normalizeDefinition(dependencyId, config);
        });

        forEach(definitions, function (definition) {
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
            Module = values(Module)[0];
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

                        if (isFunction(instance.updateDependencies)) {
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
            var loaded = extend({}, params);

            if (dependencies) {
                var promises = map(dependencies, function (dependencyName, key) {
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
            var id = uniqueId('di');

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
                    forEach(definitions, function (definition) {
                        var instance = definition.instance;

                        if (!definition.isPersistent && definition.diSessionId && definition.diSessionId !== id && instance) {
                            if (instance.trigger) {
                                instance.trigger('di:destroy');
                            }

                            if (isFunction(instance.destroy)) {
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

//# sourceMappingURL=data:application/json;base64,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QUMvQixzQkFBVSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUM7O0FBRS9CLDZCQUFZO1NBQ2YsQ0FBQzs7QUFFRixlQUFPLEVBQUUsQ0FBQztLQUNiLENBQUM7O1lBR0UsZUFBZSxHQUFmLGVBQWU7WUFFZixlQUFlLEdBQWYsZUFBZTtZQUNmLGNBQWMsR0FBZCxjQUFjO1lBQ2QsYUFBYSxHQUFiLGFBQWE7WUFFYixJQUFJLEdBQUosSUFBSTtZQUNKLEdBQUcsR0FBSCxHQUFHO1lBQ0gsTUFBTSxHQUFOLE1BQU07WUFFTiwrQkFBK0IsR0FBL0IsK0JBQStCO1lBQy9CLHFCQUFxQixHQUFyQixxQkFBcUI7WUFDckIsb0JBQW9CLEdBQXBCLG9CQUFvQjtZQUNwQixtQkFBbUIsR0FBbkIsbUJBQW1CO1lBRW5CLE9BQU8sR0FBUCxPQUFPIiwiZmlsZSI6ImRpLmVzNS5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGxvZGFzaCBmcm9tICdsb2Rhc2gnO1xuXG4vLyBUaGlzIHVnbHkgY29uc3RydWN0aW9uIGlzIGNvbXBpbGUgdG8gc21hbGxlciBzaXplZCBmaWxlXG5sZXQge1xuICAgIGV4dGVuZCxcblxuICAgIGRlZmF1bHRzLFxuICAgIHVuaXF1ZUlkLFxuICAgIHZhbHVlcyxcblxuICAgIGlzQXJyYXksXG4gICAgaXNPYmplY3QsXG4gICAgaXNGdW5jdGlvbixcblxuICAgIGZvckVhY2gsXG4gICAgbWFwXG59ID0gbG9kYXNoO1xuXG4vKipcbiAqIEB0eXBlZGVmIHt7YnVuZGxlTmFtZTogc3RyaW5nLCBmYWN0b3J5OiBzdHJpbmcsIE1vZHVsZTogKGZ1bmN0aW9ufHtmYWN0b3J5OiBmdW5jdGlvbn0pLCBpbnN0YW5jZTogb2JqZWN0LCBkZXBlbmRlbmNpZXM6IG9iamVjdH19IERpRGVmaW5pdGlvblxuICovXG5cbi8qKlxuICogQHR5cGVkZWYge3tzZXNzaW9uOiBmdW5jdGlvbiwgcHV0OiBmdW5jdGlvbn19IERpQ29udGFpbmVyXG4gKi9cblxuLyoqXG4gKiBAcGFyYW0ge1Byb21pc2V8Kn0gcHJvbWlzZVxuICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2tcbiAqXG4gKiBAcmV0dXJucyB7UHJvbWlzZXwqfVxuICovXG5sZXQgdGhlbiA9IChwcm9taXNlLCBjYWxsYmFjaykgPT4ge1xuICAgIGlmIChwcm9taXNlICYmIHByb21pc2UudGhlbikge1xuICAgICAgICByZXR1cm4gcHJvbWlzZS50aGVuKGNhbGxiYWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2socHJvbWlzZSk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBAcGFyYW0geyhQcm9taXNlfCopW119IHZhbHVlc1xuICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2tcbiAqXG4gKiBAcmV0dXJucyB7UHJvbWlzZXwqfVxuICovXG5sZXQgYWxsID0gKHZhbHVlcywgY2FsbGJhY2spID0+IHtcbiAgICBsZXQgc29tZSA9IHZhbHVlcy5zb21lKHByb21pc2UgPT4gQm9vbGVhbihwcm9taXNlICYmIHByb21pc2UudGhlbikpO1xuXG4gICAgaWYgKHNvbWUpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKHZhbHVlcykudGhlbihjYWxsYmFjayk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKHZhbHVlcyk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBAcGFyYW0ge1Byb21pc2V8Kn0gcHJvbWlzZVxuICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2tcbiAqXG4gKiBAcmV0dXJucyB7UHJvbWlzZXwqfVxuICovXG5sZXQgcUNhdGNoID0gKHByb21pc2UsIGNhbGxiYWNrKSA9PiB7XG4gICAgaWYgKHByb21pc2UgJiYgcHJvbWlzZS5jYXRjaCkge1xuICAgICAgICBwcm9taXNlLmNhdGNoKGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbi8qKlxuICogQHBhcmFtIHtmdW5jdGlvbnx7a2V5czogZnVuY3Rpb259fSByZXF1aXJlXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259XG4gKi9cbmxldCBjcmVhdGVMb2FkZXIgPSBmdW5jdGlvbiAocmVxdWlyZSkge1xuICAgIGxldCBidW5kbGVzID0ge307XG5cbiAgICByZXF1aXJlLmtleXMoKS5mb3JFYWNoKChwYXRoKSA9PiB7XG4gICAgICAgIGxldCBuYW1lID0gcGF0aC5tYXRjaCgvXFwvKFteXFwvXSspJC8pWzFdO1xuXG4gICAgICAgIGJ1bmRsZXNbbmFtZV0gPSB7cGF0aH07XG4gICAgfSk7XG5cbiAgICByZXR1cm4gKG5hbWUpID0+IHtcbiAgICAgICAgbGV0IGRlc2NyaXB0aW9uID0gYnVuZGxlc1tuYW1lXSxcbiAgICAgICAgICAgIGJ1bmRsZUxvYWRlcjtcblxuICAgICAgICBpZiAoZGVzY3JpcHRpb24pIHtcbiAgICAgICAgICAgIGJ1bmRsZUxvYWRlciA9IHJlcXVpcmUoZGVzY3JpcHRpb24ucGF0aCk7XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgYnVuZGxlTG9hZGVyID09PSAnZnVuY3Rpb24nICYmICFidW5kbGVMb2FkZXIubmFtZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBidW5kbGVMb2FkZXIocmVzb2x2ZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBidW5kbGVMb2FkZXI7XG4gICAgICAgIH1cbiAgICB9O1xufTtcblxuLyoqXG4gKiBVc2FnZTpcbiAqXG4gKiBgYGBcbiAqICByZXNvbHZlcnM6IFtcbiAqICAgICAgd2VicGFja1Jlc29sdmVyKFtcbiAqICAgICAgICAgIHJlcXVpcmUuY29udGV4dCgnLi9zdGF0ZXMvJywgdHJ1ZSwgL1N0YXRlLmpzJC8pLFxuICogICAgICAgICAgcmVxdWlyZS5jb250ZXh0KCcuL21vZGVscy8nLCB0cnVlLCAvLmpzJC8pXG4gKiAgICAgIF0pXG4gKiAgXVxuICogYGBgXG4gKlxuICogQHBhcmFtIHtmdW5jdGlvbltdfHtrZXlzOiBmdW5jdGlvbn1bXX0gcmVxdWlyZXNcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn1cbiAqL1xubGV0IHdlYnBhY2tSZXNvbHZlciA9IChyZXF1aXJlcykgPT4ge1xuICAgIGxldCBidW5kbGVzID0ge307XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufHtrZXlzOiBmdW5jdGlvbn19IHJlcXVpcmVcbiAgICAgKiBAcmV0dXJucyB7RnVuY3Rpb259XG4gICAgICovXG4gICAgbGV0IGNyZWF0ZUxvYWRlciA9IGZ1bmN0aW9uIChyZXF1aXJlKSB7XG4gICAgICAgIHJlcXVpcmUua2V5cygpLmZvckVhY2goKHBhdGgpID0+IHtcbiAgICAgICAgICAgIGxldCBuYW1lID0gcGF0aC5tYXRjaCgvXFwvKFteXFwvXSspJC8pWzFdO1xuXG4gICAgICAgICAgICAvLyBJZiB3ZSBhbHJlYWR5IGhhcyBkZWNsYXJlZCBidW5kbGUsIHVzZSBpdCBmb3IgbG9hZGluZ1xuICAgICAgICAgICAgLy8gZG8gbm90IG92ZXJyaWRlXG4gICAgICAgICAgICBpZiAoIWJ1bmRsZXNbbmFtZV0pIHtcbiAgICAgICAgICAgICAgICBidW5kbGVzW25hbWVdID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVxdWlyZShwYXRoKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgcmVxdWlyZXMuZm9yRWFjaChjcmVhdGVMb2FkZXIpO1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtcyB7c3RyaW5nfSBuYW1lXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fG9iamVjdH1cbiAgICAgKi9cbiAgICByZXR1cm4gKG5hbWUpID0+IHtcbiAgICAgICAgaWYgKCFuYW1lLm1hdGNoKC9cXC5qcyQvKSkge1xuICAgICAgICAgICAgbmFtZSArPSAnLmpzJztcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCByZXF1aXJlID0gYnVuZGxlc1tuYW1lXSxcbiAgICAgICAgICAgIGJ1bmRsZUxvYWRlcjtcblxuICAgICAgICBpZiAocmVxdWlyZSkge1xuICAgICAgICAgICAgYnVuZGxlTG9hZGVyID0gcmVxdWlyZSgpO1xuXG4gICAgICAgICAgICBpZiAodHlwZW9mIGJ1bmRsZUxvYWRlciA9PT0gJ2Z1bmN0aW9uJyAmJiAhYnVuZGxlTG9hZGVyLm5hbWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgYnVuZGxlTG9hZGVyKHJlc29sdmUpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gYnVuZGxlTG9hZGVyO1xuICAgICAgICB9XG4gICAgfTtcbn07XG5cbi8qKlxuICogVXNhZ2U6XG4gKlxuICogYGBgXG4gKiAgcmVzb2x2ZXJzOiBbXG4gKiAgICAgIHN0YXRpY1Jlc29sdmVyKHtcbiAqICAgICAgICAgIGNvbmZpZzogXyA9PiB7Li4ufSxcbiAqICAgICAgICAgIGdsb2JhbEJ1czogXyA9PiBuZXcgQmFja2JvbmUuV3JlcXIuRXZlbnRFbWl0dGVyKClcbiAqICAgICAgfSlcbiAqICBdXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0ge29iamVjdH0gaGFzaFxuICogQHJldHVybnMge0Z1bmN0aW9ufVxuICovXG5sZXQgc3RhdGljUmVzb2x2ZXIgPSAoaGFzaCkgPT4ge1xuICAgIHJldHVybiAobmFtZSkgPT4ge1xuICAgICAgICByZXR1cm4gaGFzaFtuYW1lXTtcbiAgICB9XG59O1xuXG4vKipcbiAqIFVzYWdlOlxuICpcbiAqIGBgYFxuICogIHJlc29sdmVyczogW1xuICogICAgICBhcnJheVJlc29sdmVyKFtcbiAqICAgICAgICAgIHN0YXRpY1Jlc29sdmVyKC4uLiksXG4gKiAgICAgICAgICB3ZWJwYWNrUmVzb2x2ZXIoLi4uKSxcbiAqICAgICAgICAgIC4uLi5cbiAqICAgICAgXSlcbiAqICBdXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0ge2Z1bmN0aW9uKG5hbWU6IHN0cmluZylbXX0gcmVzb2x2ZXJzXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259XG4gKi9cbmxldCBhcnJheVJlc29sdmVyID0gKHJlc29sdmVycykgPT4ge1xuICAgIGxldCBidW5kbGVDYWNoZSA9IHt9O1xuXG4gICAgcmV0dXJuIChuYW1lKSA9PiB7XG4gICAgICAgIGxldCBxdWV1ZSA9IHJlc29sdmVycy5zbGljZSgpO1xuXG4gICAgICAgIGlmIChidW5kbGVDYWNoZVtuYW1lXSkge1xuICAgICAgICAgICAgcmV0dXJuIGJ1bmRsZUNhY2hlW25hbWVdO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG5leHRMb2FkZXIgPSAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoIXF1ZXVlLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IGxvYWRlciA9IHF1ZXVlLnNoaWZ0KCk7XG5cbiAgICAgICAgICAgIHJldHVybiB0aGVuKGxvYWRlcihuYW1lKSwgcmVzdWx0ID0+IHtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBidW5kbGVDYWNoZVtuYW1lXSA9IHJlc3VsdDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV4dExvYWRlcigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBidW5kbGVDYWNoZVtuYW1lXSA9IG5leHRMb2FkZXIoKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7c3RyaW5nfSBkZWZpbml0aW9uXG4gKiBAcmV0dXJucyB7e25hbWU6IHN0cmluZywgZmFjdG9yeTogc3RyaW5nfHVuZGVmaW5lZH19XG4gKi9cbmxldCBwYXJzZVN0cmluZ0RlZmluaXRpb24gPSAoZGVmaW5pdGlvbikgPT4ge1xuICAgIGxldCBtYXRjaGVzID0gZGVmaW5pdGlvbiA/XG4gICAgICAgIGRlZmluaXRpb24ubWF0Y2goL14oW14uXSspKFxcLiguKykpPyQvKSA6XG4gICAgICAgIG51bGw7XG5cbiAgICBpZiAoIW1hdGNoZXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIG1vZHVsZSBmb3JtYXQ6ICcgKyBKU09OLnN0cmluZ2lmeShkZWZpbml0aW9uKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgYnVuZGxlTmFtZTogbWF0Y2hlc1sxXSxcbiAgICAgICAgZmFjdG9yeTogbWF0Y2hlc1szXVxuICAgIH07XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7c3RyaW5nfSBkZXBlbmRlbmN5SWRcbiAqIEBwYXJhbSB7e319IGNvbmZpZ1xuICogQHJldHVybnMgeyp9XG4gKi9cbmxldCBub3JtYWxpemVEZWZpbml0aW9uID0gKGRlcGVuZGVuY3lJZCwgY29uZmlnKSA9PiB7XG4gICAgbGV0IGRlZmluaXRpb24gPSB7XG4gICAgICAgIGlkOiBkZXBlbmRlbmN5SWRcbiAgICB9O1xuXG4gICAgaWYgKHR5cGVvZiBjb25maWcgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGV4dGVuZChkZWZpbml0aW9uLCBwYXJzZVN0cmluZ0RlZmluaXRpb24oY29uZmlnKSk7XG4gICAgfSBlbHNlIGlmIChpc0FycmF5KGNvbmZpZykpIHtcbiAgICAgICAgaWYgKGNvbmZpZy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIGRlZmluaXRpb24uaWQgPSB1bmlxdWVJZCgnZGknKTtcblxuICAgICAgICAgICAgZXh0ZW5kKGRlZmluaXRpb24sIGNvbmZpZ1swXSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBleHRlbmQoZGVmaW5pdGlvbiwgcGFyc2VTdHJpbmdEZWZpbml0aW9uKGNvbmZpZ1swXSksIHtkZXBlbmRlbmNpZXM6IGNvbmZpZ1sxXX0pO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChpc09iamVjdChjb25maWcpKSB7XG4gICAgICAgIGV4dGVuZChkZWZpbml0aW9uLCBwYXJzZVN0cmluZ0RlZmluaXRpb24oZGVwZW5kZW5jeUlkKSwge2RlcGVuZGVuY2llczogY29uZmlnfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIHR5cGUgb2YgZGVwZW5kZW5jeSBkZWZpbml0aW9uJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlZmF1bHRzKGRlZmluaXRpb24sIHtcbiAgICAgICAgZmFjdG9yeTogJ2ZhY3RvcnknLFxuICAgICAgICBkZXBlbmRlbmNpZXM6IHt9XG4gICAgfSk7XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7RGlEZWZpbml0aW9ufSBkZWZpbml0aW9uXG4gKiBAcGFyYW0ge3t9fSBkZWZpbml0aW9uc1xuICovXG5sZXQgbm9ybWFsaXplRGVmaW5pdGlvbkRlcGVuZGVuY2llcyA9IChkZWZpbml0aW9uLCBkZWZpbml0aW9ucykgPT4ge1xuICAgIGZvckVhY2goZGVmaW5pdGlvbi5kZXBlbmRlbmNpZXMsIChkZXBlbmRlbmN5LCBuYW1lKSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgZGVwZW5kZW5jeSA9PT0gJ29iamVjdCcgJiYgIWlzQXJyYXkoZGVwZW5kZW5jeSkpIHtcbiAgICAgICAgICAgIGRlcGVuZGVuY3kgPSBbbmFtZSwgZGVwZW5kZW5jeV07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNBcnJheShkZXBlbmRlbmN5KSkge1xuICAgICAgICAgICAgbGV0IGRlcERlZmluaXRpb24gPSBub3JtYWxpemVEZWZpbml0aW9uKHVuaXF1ZUlkKGRlZmluaXRpb24uaWQgKyAnLycgKyBuYW1lKSwgZGVwZW5kZW5jeSk7XG4gICAgICAgICAgICBkZWZpbml0aW9uc1tkZXBEZWZpbml0aW9uLmlkXSA9IGRlcERlZmluaXRpb247XG4gICAgICAgICAgICBkZWZpbml0aW9uLmRlcGVuZGVuY2llc1tuYW1lXSA9IGRlcERlZmluaXRpb24uaWQ7XG5cbiAgICAgICAgICAgIG5vcm1hbGl6ZURlZmluaXRpb25EZXBlbmRlbmNpZXMoZGVwRGVmaW5pdGlvbiwgZGVmaW5pdGlvbnMpO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7e319IGRlcGVuZGVuY2llc1xuICogQHJldHVybnMge3t9fVxuICovXG5sZXQgbm9ybWFsaXplRGVmaW5pdGlvbnMgPSAoZGVwZW5kZW5jaWVzKSA9PiB7XG4gICAgbGV0IGRlZmluaXRpb25zID0ge307XG5cbiAgICBmb3JFYWNoKGRlcGVuZGVuY2llcywgKGNvbmZpZywgZGVwZW5kZW5jeUlkKSA9PiB7XG4gICAgICAgIGRlZmluaXRpb25zW2RlcGVuZGVuY3lJZF0gPSBub3JtYWxpemVEZWZpbml0aW9uKGRlcGVuZGVuY3lJZCwgY29uZmlnKTtcbiAgICB9KTtcblxuICAgIGZvckVhY2goZGVmaW5pdGlvbnMsIChkZWZpbml0aW9uKSA9PiB7XG4gICAgICAgIG5vcm1hbGl6ZURlZmluaXRpb25EZXBlbmRlbmNpZXMoZGVmaW5pdGlvbiwgZGVmaW5pdGlvbnMpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGRlZmluaXRpb25zO1xufTtcblxuLyoqXG4gKiBAcGFyYW0ge3tfX2VzTW9kdWxlOiBib29sZWFufXxmdW5jdGlvbn0gTW9kdWxlXG4gKiBAcGFyYW0ge3N0cmluZ30gZmFjdG9yeVxuICogQHBhcmFtIHt7fX0gZGVwZW5kZW5jaWVzXG4gKlxuICogQHJldHVybnMge1Byb21pc2U8b2JqZWN0PnxvYmplY3R9XG4gKi9cbmxldCBmYWN0b3J5ID0gKHtNb2R1bGUsIGZhY3Rvcnl9LCBkZXBlbmRlbmNpZXMpID0+IHtcbiAgICBpZiAoTW9kdWxlLl9fZXNNb2R1bGUgPT09IHRydWUpIHtcbiAgICAgICAgTW9kdWxlID0gdmFsdWVzKE1vZHVsZSlbMF07XG4gICAgfVxuXG4gICAgaWYgKE1vZHVsZVtmYWN0b3J5XSkge1xuICAgICAgICByZXR1cm4gTW9kdWxlW2ZhY3RvcnldKGRlcGVuZGVuY2llcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG5ldyBNb2R1bGUoZGVwZW5kZW5jaWVzKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7ZnVuY3Rpb25bXX0gcmVzb2x2ZXJzXG4gKiBAcGFyYW0ge29iamVjdH0gZGVwZW5kZW5jaWVzXG4gKlxuICogQHJldHVybnMge2Z1bmN0aW9ufVxuICovXG5sZXQgY3JlYXRlQ29udGFpbmVyID0gKHtyZXNvbHZlcnMgPSBbXSwgZGVwZW5kZW5jaWVzID0ge319ID0ge30pID0+IHtcbiAgICBsZXQgZGVmaW5pdGlvbnMgPSBub3JtYWxpemVEZWZpbml0aW9ucyhkZXBlbmRlbmNpZXMpLFxuICAgICAgICByZXNvbHZlID0gYXJyYXlSZXNvbHZlcihyZXNvbHZlcnMpO1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtEaURlZmluaXRpb259IGRlZmluaXRpb25cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPG9iamVjdD58b2JqZWN0fVxuICAgICAqL1xuICAgIGxldCBsb2FkTW9kdWxlQnVuZGxlID0gKGRlZmluaXRpb24pID0+IHtcbiAgICAgICAgaWYgKGRlZmluaXRpb24uTW9kdWxlKSB7XG4gICAgICAgICAgICByZXR1cm4gZGVmaW5pdGlvbi5Nb2R1bGU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhlbihyZXNvbHZlKGRlZmluaXRpb24uYnVuZGxlTmFtZSksIChNb2R1bGUpID0+IHtcbiAgICAgICAgICAgIGlmICghTW9kdWxlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignQ2Fubm90IGZpbmQgYnVuZGxlIHdpdGggbmFtZSBcIicgKyBkZWZpbml0aW9uLmJ1bmRsZU5hbWUgKyAnXCInKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGRlZmluaXRpb24uTW9kdWxlID0gTW9kdWxlO1xuXG4gICAgICAgICAgICByZXR1cm4gTW9kdWxlO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtEaURlZmluaXRpb258c3RyaW5nfSBtb2R1bGVcbiAgICAgKiBAcmV0dXJucyB7RGlEZWZpbml0aW9ufVxuICAgICAqL1xuICAgIGxldCBub3JtYWxpemVNb2R1bGUgPSAobW9kdWxlKSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgbW9kdWxlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgaWYgKGRlZmluaXRpb25zW21vZHVsZV0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZGVmaW5pdGlvbnNbbW9kdWxlXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGRlZmluaXRpb25zW21vZHVsZV0gPSBub3JtYWxpemVEZWZpbml0aW9uKG1vZHVsZSwge30pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc29sZS5sb2coJ1VOS05PV04gTU9EVUxFJywgbW9kdWxlKTtcblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gbW9kdWxlJyk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfERpRGVmaW5pdGlvbn0gbW9kdWxlTmFtZVxuICAgICAqIEBwYXJhbSB7e319IHBhcmFtc1xuICAgICAqXG4gICAgICogQHJldHVybnMge1Byb21pc2U8b2JqZWN0Pn1cbiAgICAgKi9cbiAgICBsZXQgbG9hZE1vZHVsZSA9IChtb2R1bGVOYW1lLCBwYXJhbXMpID0+IHtcbiAgICAgICAgbGV0IGRlZmluaXRpb24gPSBub3JtYWxpemVNb2R1bGUobW9kdWxlTmFtZSk7XG5cbiAgICAgICAgbGV0IGxvYWQgPSAoKSA9PiB7XG4gICAgICAgICAgICBsZXQgcHJvbWlzZXMgPSBbXG4gICAgICAgICAgICAgICAgbG9hZE1vZHVsZURlcGVuZGVuY2llcyhkZWZpbml0aW9uLCBwYXJhbXMpLFxuICAgICAgICAgICAgICAgIGRlZmluaXRpb24uaW5zdGFuY2UgPyBudWxsIDogbG9hZE1vZHVsZUJ1bmRsZShkZWZpbml0aW9uKVxuICAgICAgICAgICAgXTtcblxuICAgICAgICAgICAgcmV0dXJuIGFsbChwcm9taXNlcywgKFtkZXBlbmRlbmNpZXNdKSA9PiB7XG4gICAgICAgICAgICAgICAgbGV0IF9mYWN0b3J5ID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZGVmaW5pdGlvbi5pbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRlZmluaXRpb24uaW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFjdG9yeShkZWZpbml0aW9uLCBkZXBlbmRlbmNpZXMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIC8vIElmIGluc3RhbmNlIGhhcyB1cGRhdGVEZXBlbmRlbmNpZXMgaW52b2tlIGl0IGJlZm9yZSBjb21wbGV0ZSBESSByZXNvbHZlXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoZW4oX2ZhY3RvcnkoKSwgaW5zdGFuY2UgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsZXQgaXNOZWVkVXBkYXRlID0gIXBhcmFtcy5kaVNlc3Npb25JZCB8fCBkZWZpbml0aW9uLmRpU2Vzc2lvbklkICE9PSBwYXJhbXMuZGlTZXNzaW9uSWQ7XG4gICAgICAgICAgICAgICAgICAgIGRlZmluaXRpb24uZGlTZXNzaW9uSWQgPSBwYXJhbXMuZGlTZXNzaW9uSWQ7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzRnVuY3Rpb24oaW5zdGFuY2UudXBkYXRlRGVwZW5kZW5jaWVzKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzTmVlZFVwZGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGVuKGluc3RhbmNlLnVwZGF0ZURlcGVuZGVuY2llcyhkZXBlbmRlbmNpZXMpLCBfID0+IGluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChkZWZpbml0aW9uLl9wcm9ncmVzcykge1xuICAgICAgICAgICAgcmV0dXJuIGRlZmluaXRpb24uX3Byb2dyZXNzO1xuICAgICAgICB9XG5cbiAgICAgICAgZGVmaW5pdGlvbi5fcHJvZ3Jlc3MgPSB0aGVuKGxvYWQoKSwgaW5zdGFuY2UgPT4ge1xuICAgICAgICAgICAgZGVmaW5pdGlvbi5pbnN0YW5jZSA9IGluc3RhbmNlO1xuXG4gICAgICAgICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiB0aGVuKGRlZmluaXRpb24uX3Byb2dyZXNzLCBpbnN0YW5jZSA9PiB7XG4gICAgICAgICAgICBkZWZpbml0aW9uLl9wcm9ncmVzcyA9IG51bGw7XG5cbiAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7e319IGRlcGVuZGVuY2llc1xuICAgICAqIEBwYXJhbSBwYXJhbXNcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPG9iamVjdD58b2JqZWN0fVxuICAgICAqL1xuICAgIGxldCBsb2FkTW9kdWxlcyA9IChkZXBlbmRlbmNpZXMsIHBhcmFtcykgPT4ge1xuICAgICAgICBsZXQgbG9hZGVkID0gZXh0ZW5kKHt9LCBwYXJhbXMpO1xuXG4gICAgICAgIGlmIChkZXBlbmRlbmNpZXMpIHtcbiAgICAgICAgICAgIGxldCBwcm9taXNlcyA9IG1hcChkZXBlbmRlbmNpZXMsIChkZXBlbmRlbmN5TmFtZSwga2V5KSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoZW4obG9hZE1vZHVsZShkZXBlbmRlbmN5TmFtZSwgcGFyYW1zKSwgZGVwZW5kZW5jeSA9PiBsb2FkZWRba2V5XSA9IGRlcGVuZGVuY3kpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiBhbGwocHJvbWlzZXMsIF8gPT4gbG9hZGVkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBsb2FkZWQ7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfERpRGVmaW5pdGlvbn0gZGVmaW5pdGlvblxuICAgICAqIEBwYXJhbSB7e319IHBhcmFtc1xuICAgICAqXG4gICAgICogQHJldHVybnMge1Byb21pc2U8b2JqZWN0PnxvYmplY3R9XG4gICAgICovXG4gICAgbGV0IGxvYWRNb2R1bGVEZXBlbmRlbmNpZXMgPSAoZGVmaW5pdGlvbiwgcGFyYW1zKSA9PiB7XG4gICAgICAgIHJldHVybiBsb2FkTW9kdWxlcyhkZWZpbml0aW9uLmRlcGVuZGVuY2llcywgcGFyYW1zKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd8b2JqZWN0fSBtb2R1bGVcbiAgICAgKiBAcGFyYW0ge3t9fSBbcGFyYW1zXVxuICAgICAqXG4gICAgICogQHJldHVybnMge1Byb21pc2U8b2JqZWN0PnxvYmplY3R9XG4gICAgICovXG4gICAgbGV0IGRpID0gKG1vZHVsZSwgcGFyYW1zID0ge30pID0+IHtcbiAgICAgICAgbGV0IHByb21pc2U7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBwcm9taXNlID0gbG9hZE1vZHVsZShtb2R1bGUsIHBhcmFtcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwcm9taXNlID0gbG9hZE1vZHVsZXMobW9kdWxlLCBwYXJhbXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBzZXNzaW9uIG9mIERJIGxvYWRpbmcuIFdoZW4gc2Vzc2lvbiBjbG9zZSAtIGFsbCB1bmtub3duIGRlcGVuZGVuY2llcyB3aWxsIGJlIHRydW5jYXRlZFxuICAgICAqXG4gICAgICogQHJldHVybnMge3tsb2FkOiBGdW5jdGlvbiwgY2xvc2U6IEZ1bmN0aW9ufX1cbiAgICAgKi9cbiAgICBkaS5zZXNzaW9uID0gKCkgPT4ge1xuICAgICAgICBsZXQgaWQgPSB1bmlxdWVJZCgnZGknKTtcblxuICAgICAgICByZXR1cm4ge1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFdvcmsgbGlrZSBvcmlnaW5hbCBESSBmdW5jdGlvblxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEBzZWUgZGlcbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9IG1vZHVsZVxuICAgICAgICAgICAgICogQHBhcmFtIHt7fX0gW3BhcmFtc11cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fG9iamVjdH1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgbG9hZDogKG1vZHVsZSwgcGFyYW1zID0ge30pID0+IHtcbiAgICAgICAgICAgICAgICBwYXJhbXMuZGlTZXNzaW9uSWQgPSBpZDtcblxuICAgICAgICAgICAgICAgIHJldHVybiBkaShtb2R1bGUsIHBhcmFtcyk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFJ1biBHQyB0byBkZXN0cm95IHVua25vd24gZGVwZW5kZW5jaWVzXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGNsb3NlOiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgZm9yRWFjaChkZWZpbml0aW9ucywgKGRlZmluaXRpb24pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGluc3RhbmNlID0gZGVmaW5pdGlvbi5pbnN0YW5jZTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIWRlZmluaXRpb24uaXNQZXJzaXN0ZW50ICYmIGRlZmluaXRpb24uZGlTZXNzaW9uSWQgJiYgZGVmaW5pdGlvbi5kaVNlc3Npb25JZCAhPT0gaWQgJiYgaW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpbnN0YW5jZS50cmlnZ2VyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2UudHJpZ2dlcignZGk6ZGVzdHJveScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNGdW5jdGlvbihpbnN0YW5jZS5kZXN0cm95KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgZGVmaW5pdGlvbi5pbnN0YW5jZSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGlucHV0RGVmaW5pdGlvblxuICAgICAqIEBwYXJhbSBpbnN0YW5jZVxuICAgICAqXG4gICAgICogQHJldHVybnMge0RpQ29udGFpbmVyfVxuICAgICAqL1xuICAgIGRpLnB1dCA9IChpbnB1dERlZmluaXRpb24sIGluc3RhbmNlKSA9PiB7XG4gICAgICAgIGxldCBkZWZpbml0aW9uID0gbm9ybWFsaXplTW9kdWxlKGlucHV0RGVmaW5pdGlvbik7XG4gICAgICAgIGRlZmluaXRpb24uaW5zdGFuY2UgPSBpbnN0YW5jZTtcbiAgICAgICAgZGVmaW5pdGlvbi5pc1BlcnNpc3RlbnQgPSB0cnVlO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICByZXR1cm4gZGk7XG59O1xuXG5leHBvcnQge1xuICAgIGNyZWF0ZUNvbnRhaW5lcixcblxuICAgIHdlYnBhY2tSZXNvbHZlcixcbiAgICBzdGF0aWNSZXNvbHZlcixcbiAgICBhcnJheVJlc29sdmVyLFxuXG4gICAgdGhlbixcbiAgICBhbGwsXG4gICAgcUNhdGNoLFxuXG4gICAgbm9ybWFsaXplRGVmaW5pdGlvbkRlcGVuZGVuY2llcyxcbiAgICBwYXJzZVN0cmluZ0RlZmluaXRpb24sXG4gICAgbm9ybWFsaXplRGVmaW5pdGlvbnMsXG4gICAgbm9ybWFsaXplRGVmaW5pdGlvbixcblxuICAgIGZhY3Rvcnlcbn07XG4iXX0=