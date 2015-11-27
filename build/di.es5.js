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
    var functions = _lodash.functions;
    var defaults = _lodash.defaults;
    var uniqueId = _lodash.uniqueId;
    var values = _lodash.values;
    var keys = _lodash.keys;
    var omit = _lodash.omit;
    var isArray = _lodash.isArray;
    var isObject = _lodash.isObject;
    var isFunction = _lodash.isFunction;
    var forEach = _lodash.forEach;
    var filter = _lodash.filter;
    var map = _lodash.map;

    /**
     * @typedef {{bundleName: string, factory: string, Module: (function|{factory: function}), instance: object, dependencies: object, update: string}} DiDefinition
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
            try {
                return callback(promise);
            } catch (err) {
                return Promise.reject(err);
            }
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
            try {
                return callback(values);
            } catch (err) {
                return Promise.reject(err);
            }
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
                    if (bundleLoader.length === 1) {
                        return new Promise(function (resolve) {
                            bundleLoader(resolve);
                        });
                    } else if (bundleLoader.length === 0) {
                        return bundleLoader();
                    }
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
        var matches = definition ? definition.match(/^([^.#]+)(\.([^#]+))?(#(.+))?$/) : null;

        if (!matches) {
            throw new Error('Unknown module format: ' + JSON.stringify(definition));
        }

        return {
            parentId: definition,
            bundleName: matches[1],
            factory: matches[3],
            update: matches[5]
        };
    };

    /**
     * @param {string} dependencyId
     * @param {{}} config
     *
     * @returns {DiDefinition}
     */
    var normalizeDefinitionView = function normalizeDefinitionView(dependencyId, config) {
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
        } else if (typeof dependencyId === 'string' && !config) {
            extend(definition, parseStringDefinition(dependencyId));
        } else {
            throw new Error('Unknown type of dependency definition');
        }

        return definition;
    };

    /**
     * @param {DiDefinition} definition
     *
     * @returns {DiDefinition}
     */
    var normalizeDefinitionWithDefaults = function normalizeDefinitionWithDefaults(definition) {
        return defaults(definition, {
            update: 'updateDependencies',
            factory: 'factory',
            dependencies: {}
        });
    };

    /**
     * @param {string} dependencyId
     * @param {{}} config
     *
     * @returns {DiDefinition}
     */
    var normalizeDefinition = function normalizeDefinition(dependencyId, config) {
        return normalizeDefinitionWithDefaults(normalizeDefinitionView(dependencyId, config));
    };

    /**
     * @param {{}} dependencies
     * @returns {{}}
     */
    var normalizeDefinitions = function normalizeDefinitions(dependencies) {
        var definitions = {};

        /**
         * @param {DiDefinition} definition
         */
        var normalizeDefinitionDependencies = function normalizeDefinitionDependencies(definition) {
            forEach(definition.dependencies, function (dependency, name) {
                if (typeof dependency === 'object' && !isArray(dependency)) {
                    dependency = [name, dependency];
                }

                if (isArray(dependency)) {
                    var depId = uniqueId(definition.id + '/' + name);
                    dependencies[depId] = dependency;

                    var depDefinition = process(depId);

                    definitions[depDefinition.id] = depDefinition;
                    definition.dependencies[name] = depDefinition.id;

                    normalizeDefinitionDependencies(depDefinition);
                }
            });
        };

        var process = function process(dependencyId) {
            if (definitions[dependencyId]) {
                return definitions[dependencyId];
            }

            var definition = normalizeDefinitionView(dependencyId, dependencies[dependencyId]);

            if (definition.id !== definition.parentId) {
                definition = defaults(definition, process(definition.parentId));
            } else {
                definition = normalizeDefinitionWithDefaults(definition);
            }

            normalizeDefinitionDependencies(definition);

            return definitions[dependencyId] = definition;
        };

        keys(dependencies).forEach(process);

        return definitions;
    };

    /**
     * Extract module from ES6 definition
     *
     * @param {{__esModule: boolean}|function} Module
     * @returns {*}
     */
    var extractModule = function extractModule(Module) {
        if (Module.__esModule === true) {
            return values(omit(Module, '__esModule'))[0];
        }

        return Module;
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

        Module = extractModule(Module);

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

                        if (isFunction(instance[definition.update])) {
                            if (isNeedUpdate) {
                                return then(instance[definition.update](dependencies), function (_) {
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
         * @param {{}} [defaults]
         *
         * @returns {{load: Function, close: Function}}
         */
        di.session = function () {
            var defaults = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

            var id = uniqueId('di');

            defaults.diSessionId = id;

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
            var diSession = function diSession(module) {
                var params = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

                extend(params, defaults);

                return di(module, params);
            };

            diSession.load = diSession;

            /**
             * Run GC to destroy unknown dependencies
             */
            diSession.close = function () {
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
            };

            functions(di).forEach(function (name) {
                diSession[name] = di[name];
            });

            return diSession;
        };

        /**
         * @param {string} inputDefinition
         * @param {*} instance
         * @param {object} options
         *
         * @returns {DiContainer}
         */
        di.put = function (inputDefinition, instance, options) {
            var definition = normalizeModule(inputDefinition);
            extend(definition, { instance: instance, isPersistent: true }, options);
            return undefined;
        };

        /**
         * @returns {Promise<object>}
         */
        di.serialize = function () {
            for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                args[_key] = arguments[_key];
            }

            var serialized = {};

            var serializable = filter(definitions, function (_ref4) {
                var instance = _ref4.instance;

                return instance && isFunction(instance.serialize);
            });

            var serializedPromises = map(serializable, function (_ref5) {
                var id = _ref5.id;
                var instance = _ref5.instance;

                return then(instance.serialize.apply(instance, args), function (json) {
                    return serialized[id] = json;
                });
            });

            return all(serializedPromises, function () {
                return serialized;
            });
        };

        /**
         * @param {object} data
         * @param {*} args
         */
        di.restore = function (data) {
            for (var _len2 = arguments.length, args = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
                args[_key2 - 1] = arguments[_key2];
            }

            var results = map(data, function (moduleData, id) {
                return di.restoreModule.apply(di, [id, moduleData].concat(args));
            });

            return all(results, function (data) {
                return data;
            });
        };

        /**
         * @param {string} id
         * @param {*} args
         *
         * @returns {Promise}
         */
        di.restoreModule = function (id) {
            for (var _len3 = arguments.length, args = Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
                args[_key3 - 1] = arguments[_key3];
            }

            var definition = normalizeModule(id);

            return then(loadModuleBundle(definition), function (Module) {
                var _Module;

                Module = extractModule(Module);

                if (!Module.restore) {
                    throw new Error('Cannot restore module');
                }

                return then((_Module = Module).restore.apply(_Module, args), function (instance) {
                    return definition.instance = instance;
                });
            });
        };

        /**
         * @returns {{}}
         */
        di.getDefinitions = function () {
            return definitions;
        };

        /**
         * @param {string} id
         * @returns {DiDefinition}
         */
        di.getDefinition = function (id) {
            return normalizeModule(id);
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

//# sourceMappingURL=data:application/json;base64,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QUFHO1lBQ0gsTUFBTSxHQUFOLE1BQU07WUFFTixxQkFBcUIsR0FBckIscUJBQXFCO1lBQ3JCLG9CQUFvQixHQUFwQixvQkFBb0I7WUFDcEIsbUJBQW1CLEdBQW5CLG1CQUFtQjtZQUVuQixPQUFPLEdBQVAsT0FBTyIsImZpbGUiOiJkaS5lczUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBsb2Rhc2ggZnJvbSAnbG9kYXNoJztcblxuLy8gVGhpcyB1Z2x5IGNvbnN0cnVjdGlvbiBpcyBjb21waWxlIHRvIHNtYWxsZXIgc2l6ZWQgZmlsZVxubGV0IHtcbiAgICBleHRlbmQsXG5cbiAgICBmdW5jdGlvbnMsXG4gICAgZGVmYXVsdHMsXG4gICAgdW5pcXVlSWQsXG4gICAgdmFsdWVzLFxuICAgIGtleXMsXG4gICAgb21pdCxcblxuICAgIGlzQXJyYXksXG4gICAgaXNPYmplY3QsXG4gICAgaXNGdW5jdGlvbixcblxuICAgIGZvckVhY2gsXG4gICAgZmlsdGVyLFxuICAgIG1hcFxuICAgIH0gPSBsb2Rhc2g7XG5cbi8qKlxuICogQHR5cGVkZWYge3tidW5kbGVOYW1lOiBzdHJpbmcsIGZhY3Rvcnk6IHN0cmluZywgTW9kdWxlOiAoZnVuY3Rpb258e2ZhY3Rvcnk6IGZ1bmN0aW9ufSksIGluc3RhbmNlOiBvYmplY3QsIGRlcGVuZGVuY2llczogb2JqZWN0LCB1cGRhdGU6IHN0cmluZ319IERpRGVmaW5pdGlvblxuICovXG5cbi8qKlxuICogQHR5cGVkZWYge3tzZXNzaW9uOiBmdW5jdGlvbiwgcHV0OiBmdW5jdGlvbn19IERpQ29udGFpbmVyXG4gKi9cblxuLyoqXG4gKiBAcGFyYW0ge1Byb21pc2V8Kn0gcHJvbWlzZVxuICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2tcbiAqXG4gKiBAcmV0dXJucyB7UHJvbWlzZXwqfVxuICovXG5sZXQgdGhlbiA9IChwcm9taXNlLCBjYWxsYmFjaykgPT4ge1xuICAgIGlmIChwcm9taXNlICYmIHByb21pc2UudGhlbikge1xuICAgICAgICByZXR1cm4gcHJvbWlzZS50aGVuKGNhbGxiYWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKHByb21pc2UpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuLyoqXG4gKiBAcGFyYW0geyhQcm9taXNlfCopW119IHZhbHVlc1xuICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2tcbiAqXG4gKiBAcmV0dXJucyB7UHJvbWlzZXwqfVxuICovXG5sZXQgYWxsID0gKHZhbHVlcywgY2FsbGJhY2spID0+IHtcbiAgICBsZXQgc29tZSA9IHZhbHVlcy5zb21lKHByb21pc2UgPT4gQm9vbGVhbihwcm9taXNlICYmIHByb21pc2UudGhlbikpO1xuXG4gICAgaWYgKHNvbWUpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKHZhbHVlcykudGhlbihjYWxsYmFjayk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayh2YWx1ZXMpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuLyoqXG4gKiBAcGFyYW0ge1Byb21pc2V8Kn0gcHJvbWlzZVxuICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2tcbiAqXG4gKiBAcmV0dXJucyB7UHJvbWlzZXwqfVxuICovXG5sZXQgcUNhdGNoID0gKHByb21pc2UsIGNhbGxiYWNrKSA9PiB7XG4gICAgaWYgKHByb21pc2UgJiYgcHJvbWlzZS5jYXRjaCkge1xuICAgICAgICBwcm9taXNlLmNhdGNoKGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbi8qKlxuICogVXNhZ2U6XG4gKlxuICogYGBgXG4gKiAgcmVzb2x2ZXJzOiBbXG4gKiAgICAgIHdlYnBhY2tSZXNvbHZlcihbXG4gKiAgICAgICAgICByZXF1aXJlLmNvbnRleHQoJy4vc3RhdGVzLycsIHRydWUsIC9TdGF0ZS5qcyQvKSxcbiAqICAgICAgICAgIHJlcXVpcmUuY29udGV4dCgnLi9tb2RlbHMvJywgdHJ1ZSwgLy5qcyQvKVxuICogICAgICBdKVxuICogIF1cbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB7ZnVuY3Rpb25bXXx7a2V5czogZnVuY3Rpb259W119IHJlcXVpcmVzXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259XG4gKi9cbmxldCB3ZWJwYWNrUmVzb2x2ZXIgPSAocmVxdWlyZXMpID0+IHtcbiAgICBsZXQgYnVuZGxlcyA9IHt9O1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtmdW5jdGlvbnx7a2V5czogZnVuY3Rpb259fSByZXF1aXJlXG4gICAgICogQHJldHVybnMge0Z1bmN0aW9ufVxuICAgICAqL1xuICAgIGxldCBjcmVhdGVMb2FkZXIgPSBmdW5jdGlvbiAocmVxdWlyZSkge1xuICAgICAgICByZXF1aXJlLmtleXMoKS5mb3JFYWNoKChwYXRoKSA9PiB7XG4gICAgICAgICAgICBsZXQgbmFtZSA9IHBhdGgubWF0Y2goL1xcLyhbXlxcL10rKSQvKVsxXTtcblxuICAgICAgICAgICAgLy8gSWYgd2UgYWxyZWFkeSBoYXMgZGVjbGFyZWQgYnVuZGxlLCB1c2UgaXQgZm9yIGxvYWRpbmdcbiAgICAgICAgICAgIC8vIGRvIG5vdCBvdmVycmlkZVxuICAgICAgICAgICAgaWYgKCFidW5kbGVzW25hbWVdKSB7XG4gICAgICAgICAgICAgICAgYnVuZGxlc1tuYW1lXSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlcXVpcmUocGF0aCk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIHJlcXVpcmVzLmZvckVhY2goY3JlYXRlTG9hZGVyKTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbXMge3N0cmluZ30gbmFtZVxuICAgICAqXG4gICAgICogQHJldHVybnMge1Byb21pc2U8b2JqZWN0PnxvYmplY3R9XG4gICAgICovXG4gICAgcmV0dXJuIChuYW1lKSA9PiB7XG4gICAgICAgIGlmICghbmFtZS5tYXRjaCgvXFwuanMkLykpIHtcbiAgICAgICAgICAgIG5hbWUgKz0gJy5qcyc7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgcmVxdWlyZSA9IGJ1bmRsZXNbbmFtZV0sXG4gICAgICAgICAgICBidW5kbGVMb2FkZXI7XG5cbiAgICAgICAgaWYgKHJlcXVpcmUpIHtcbiAgICAgICAgICAgIGJ1bmRsZUxvYWRlciA9IHJlcXVpcmUoKTtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBidW5kbGVMb2FkZXIgPT09ICdmdW5jdGlvbicgJiYgIWJ1bmRsZUxvYWRlci5uYW1lKSB7XG4gICAgICAgICAgICAgICAgaWYgKGJ1bmRsZUxvYWRlci5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBidW5kbGVMb2FkZXIocmVzb2x2ZSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoYnVuZGxlTG9hZGVyLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYnVuZGxlTG9hZGVyKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gYnVuZGxlTG9hZGVyO1xuICAgICAgICB9XG4gICAgfTtcbn07XG5cbi8qKlxuICogVXNhZ2U6XG4gKlxuICogYGBgXG4gKiAgcmVzb2x2ZXJzOiBbXG4gKiAgICAgIHN0YXRpY1Jlc29sdmVyKHtcbiAqICAgICAgICAgIGNvbmZpZzogXyA9PiB7Li4ufSxcbiAqICAgICAgICAgIGdsb2JhbEJ1czogXyA9PiBuZXcgQmFja2JvbmUuV3JlcXIuRXZlbnRFbWl0dGVyKClcbiAqICAgICAgfSlcbiAqICBdXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0ge29iamVjdH0gaGFzaFxuICogQHJldHVybnMge0Z1bmN0aW9ufVxuICovXG5sZXQgc3RhdGljUmVzb2x2ZXIgPSAoaGFzaCkgPT4ge1xuICAgIHJldHVybiAobmFtZSkgPT4ge1xuICAgICAgICByZXR1cm4gaGFzaFtuYW1lXTtcbiAgICB9XG59O1xuXG4vKipcbiAqIFVzYWdlOlxuICpcbiAqIGBgYFxuICogIHJlc29sdmVyczogW1xuICogICAgICBhcnJheVJlc29sdmVyKFtcbiAqICAgICAgICAgIHN0YXRpY1Jlc29sdmVyKC4uLiksXG4gKiAgICAgICAgICB3ZWJwYWNrUmVzb2x2ZXIoLi4uKSxcbiAqICAgICAgICAgIC4uLi5cbiAqICAgICAgXSlcbiAqICBdXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0ge2Z1bmN0aW9uKG5hbWU6IHN0cmluZylbXX0gcmVzb2x2ZXJzXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259XG4gKi9cbmxldCBhcnJheVJlc29sdmVyID0gKHJlc29sdmVycykgPT4ge1xuICAgIGxldCBidW5kbGVDYWNoZSA9IHt9O1xuXG4gICAgcmV0dXJuIChuYW1lKSA9PiB7XG4gICAgICAgIGxldCBxdWV1ZSA9IHJlc29sdmVycy5zbGljZSgpO1xuXG4gICAgICAgIGlmIChidW5kbGVDYWNoZVtuYW1lXSkge1xuICAgICAgICAgICAgcmV0dXJuIGJ1bmRsZUNhY2hlW25hbWVdO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG5leHRMb2FkZXIgPSAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoIXF1ZXVlLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IGxvYWRlciA9IHF1ZXVlLnNoaWZ0KCk7XG5cbiAgICAgICAgICAgIHJldHVybiB0aGVuKGxvYWRlcihuYW1lKSwgcmVzdWx0ID0+IHtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBidW5kbGVDYWNoZVtuYW1lXSA9IHJlc3VsdDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV4dExvYWRlcigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBidW5kbGVDYWNoZVtuYW1lXSA9IG5leHRMb2FkZXIoKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7c3RyaW5nfSBkZWZpbml0aW9uXG4gKiBAcmV0dXJucyB7e25hbWU6IHN0cmluZywgZmFjdG9yeTogc3RyaW5nfHVuZGVmaW5lZH19XG4gKi9cbmxldCBwYXJzZVN0cmluZ0RlZmluaXRpb24gPSAoZGVmaW5pdGlvbikgPT4ge1xuICAgIGxldCBtYXRjaGVzID0gZGVmaW5pdGlvbiA/XG4gICAgICAgIGRlZmluaXRpb24ubWF0Y2goL14oW14uI10rKShcXC4oW14jXSspKT8oIyguKykpPyQvKSA6XG4gICAgICAgIG51bGw7XG5cbiAgICBpZiAoIW1hdGNoZXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIG1vZHVsZSBmb3JtYXQ6ICcgKyBKU09OLnN0cmluZ2lmeShkZWZpbml0aW9uKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgcGFyZW50SWQ6IGRlZmluaXRpb24sXG4gICAgICAgIGJ1bmRsZU5hbWU6IG1hdGNoZXNbMV0sXG4gICAgICAgIGZhY3Rvcnk6IG1hdGNoZXNbM10sXG4gICAgICAgIHVwZGF0ZTogbWF0Y2hlc1s1XVxuICAgIH07XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7c3RyaW5nfSBkZXBlbmRlbmN5SWRcbiAqIEBwYXJhbSB7e319IGNvbmZpZ1xuICpcbiAqIEByZXR1cm5zIHtEaURlZmluaXRpb259XG4gKi9cbmxldCBub3JtYWxpemVEZWZpbml0aW9uVmlldyA9IChkZXBlbmRlbmN5SWQsIGNvbmZpZykgPT4ge1xuICAgIGxldCBkZWZpbml0aW9uID0ge1xuICAgICAgICBpZDogZGVwZW5kZW5jeUlkXG4gICAgfTtcblxuICAgIGlmICh0eXBlb2YgY29uZmlnID09PSAnc3RyaW5nJykge1xuICAgICAgICBleHRlbmQoZGVmaW5pdGlvbiwgcGFyc2VTdHJpbmdEZWZpbml0aW9uKGNvbmZpZykpO1xuICAgIH0gZWxzZSBpZiAoaXNBcnJheShjb25maWcpKSB7XG4gICAgICAgIGlmIChjb25maWcubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICBkZWZpbml0aW9uLmlkID0gdW5pcXVlSWQoJ2RpJyk7XG5cbiAgICAgICAgICAgIGV4dGVuZChkZWZpbml0aW9uLCBjb25maWdbMF0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZXh0ZW5kKGRlZmluaXRpb24sIHBhcnNlU3RyaW5nRGVmaW5pdGlvbihjb25maWdbMF0pLCB7ZGVwZW5kZW5jaWVzOiBjb25maWdbMV19KTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNPYmplY3QoY29uZmlnKSkge1xuICAgICAgICBleHRlbmQoZGVmaW5pdGlvbiwgcGFyc2VTdHJpbmdEZWZpbml0aW9uKGRlcGVuZGVuY3lJZCksIHtkZXBlbmRlbmNpZXM6IGNvbmZpZ30pO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGRlcGVuZGVuY3lJZCA9PT0gJ3N0cmluZycgJiYgIWNvbmZpZykge1xuICAgICAgICBleHRlbmQoZGVmaW5pdGlvbiwgcGFyc2VTdHJpbmdEZWZpbml0aW9uKGRlcGVuZGVuY3lJZCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biB0eXBlIG9mIGRlcGVuZGVuY3kgZGVmaW5pdGlvbicpO1xuICAgIH1cblxuICAgIHJldHVybiBkZWZpbml0aW9uO1xufTtcblxuLyoqXG4gKiBAcGFyYW0ge0RpRGVmaW5pdGlvbn0gZGVmaW5pdGlvblxuICpcbiAqIEByZXR1cm5zIHtEaURlZmluaXRpb259XG4gKi9cbmxldCBub3JtYWxpemVEZWZpbml0aW9uV2l0aERlZmF1bHRzID0gKGRlZmluaXRpb24pID0+IHtcbiAgICByZXR1cm4gZGVmYXVsdHMoZGVmaW5pdGlvbiwge1xuICAgICAgICB1cGRhdGU6ICd1cGRhdGVEZXBlbmRlbmNpZXMnLFxuICAgICAgICBmYWN0b3J5OiAnZmFjdG9yeScsXG4gICAgICAgIGRlcGVuZGVuY2llczoge31cbiAgICB9KTtcbn07XG5cbi8qKlxuICogQHBhcmFtIHtzdHJpbmd9IGRlcGVuZGVuY3lJZFxuICogQHBhcmFtIHt7fX0gY29uZmlnXG4gKlxuICogQHJldHVybnMge0RpRGVmaW5pdGlvbn1cbiAqL1xubGV0IG5vcm1hbGl6ZURlZmluaXRpb24gPSAoZGVwZW5kZW5jeUlkLCBjb25maWcpID0+IHtcbiAgICByZXR1cm4gbm9ybWFsaXplRGVmaW5pdGlvbldpdGhEZWZhdWx0cyhub3JtYWxpemVEZWZpbml0aW9uVmlldyhkZXBlbmRlbmN5SWQsIGNvbmZpZykpO1xufTtcblxuLyoqXG4gKiBAcGFyYW0ge3t9fSBkZXBlbmRlbmNpZXNcbiAqIEByZXR1cm5zIHt7fX1cbiAqL1xubGV0IG5vcm1hbGl6ZURlZmluaXRpb25zID0gKGRlcGVuZGVuY2llcykgPT4ge1xuICAgIGxldCBkZWZpbml0aW9ucyA9IHt9O1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtEaURlZmluaXRpb259IGRlZmluaXRpb25cbiAgICAgKi9cbiAgICBsZXQgbm9ybWFsaXplRGVmaW5pdGlvbkRlcGVuZGVuY2llcyA9IChkZWZpbml0aW9uKSA9PiB7XG4gICAgICAgIGZvckVhY2goZGVmaW5pdGlvbi5kZXBlbmRlbmNpZXMsIChkZXBlbmRlbmN5LCBuYW1lKSA9PiB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGRlcGVuZGVuY3kgPT09ICdvYmplY3QnICYmICFpc0FycmF5KGRlcGVuZGVuY3kpKSB7XG4gICAgICAgICAgICAgICAgZGVwZW5kZW5jeSA9IFtuYW1lLCBkZXBlbmRlbmN5XTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGlzQXJyYXkoZGVwZW5kZW5jeSkpIHtcbiAgICAgICAgICAgICAgICB2YXIgZGVwSWQgPSB1bmlxdWVJZChkZWZpbml0aW9uLmlkICsgJy8nICsgbmFtZSk7XG4gICAgICAgICAgICAgICAgZGVwZW5kZW5jaWVzW2RlcElkXSA9IGRlcGVuZGVuY3k7XG5cbiAgICAgICAgICAgICAgICBsZXQgZGVwRGVmaW5pdGlvbiA9IHByb2Nlc3MoZGVwSWQpO1xuXG4gICAgICAgICAgICAgICAgZGVmaW5pdGlvbnNbZGVwRGVmaW5pdGlvbi5pZF0gPSBkZXBEZWZpbml0aW9uO1xuICAgICAgICAgICAgICAgIGRlZmluaXRpb24uZGVwZW5kZW5jaWVzW25hbWVdID0gZGVwRGVmaW5pdGlvbi5pZDtcblxuICAgICAgICAgICAgICAgIG5vcm1hbGl6ZURlZmluaXRpb25EZXBlbmRlbmNpZXMoZGVwRGVmaW5pdGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBsZXQgcHJvY2VzcyA9IChkZXBlbmRlbmN5SWQpID0+IHtcbiAgICAgICAgaWYgKGRlZmluaXRpb25zW2RlcGVuZGVuY3lJZF0pIHtcbiAgICAgICAgICAgIHJldHVybiBkZWZpbml0aW9uc1tkZXBlbmRlbmN5SWRdO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGRlZmluaXRpb24gPSBub3JtYWxpemVEZWZpbml0aW9uVmlldyhkZXBlbmRlbmN5SWQsIGRlcGVuZGVuY2llc1tkZXBlbmRlbmN5SWRdKTtcblxuICAgICAgICBpZiAoZGVmaW5pdGlvbi5pZCAhPT0gZGVmaW5pdGlvbi5wYXJlbnRJZCkge1xuICAgICAgICAgICAgZGVmaW5pdGlvbiA9IGRlZmF1bHRzKGRlZmluaXRpb24sIHByb2Nlc3MoZGVmaW5pdGlvbi5wYXJlbnRJZCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGVmaW5pdGlvbiA9IG5vcm1hbGl6ZURlZmluaXRpb25XaXRoRGVmYXVsdHMoZGVmaW5pdGlvbik7XG4gICAgICAgIH1cblxuICAgICAgICBub3JtYWxpemVEZWZpbml0aW9uRGVwZW5kZW5jaWVzKGRlZmluaXRpb24pO1xuXG4gICAgICAgIHJldHVybiBkZWZpbml0aW9uc1tkZXBlbmRlbmN5SWRdID0gZGVmaW5pdGlvbjtcbiAgICB9O1xuXG4gICAga2V5cyhkZXBlbmRlbmNpZXMpLmZvckVhY2gocHJvY2Vzcyk7XG5cbiAgICByZXR1cm4gZGVmaW5pdGlvbnM7XG59O1xuXG4vKipcbiAqIEV4dHJhY3QgbW9kdWxlIGZyb20gRVM2IGRlZmluaXRpb25cbiAqXG4gKiBAcGFyYW0ge3tfX2VzTW9kdWxlOiBib29sZWFufXxmdW5jdGlvbn0gTW9kdWxlXG4gKiBAcmV0dXJucyB7Kn1cbiAqL1xubGV0IGV4dHJhY3RNb2R1bGUgPSAoTW9kdWxlKSA9PiB7XG4gICAgaWYgKE1vZHVsZS5fX2VzTW9kdWxlID09PSB0cnVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZXMob21pdChNb2R1bGUsICdfX2VzTW9kdWxlJykpWzBdO1xuICAgIH1cblxuICAgIHJldHVybiBNb2R1bGU7XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7e19fZXNNb2R1bGU6IGJvb2xlYW59fGZ1bmN0aW9ufSBNb2R1bGVcbiAqIEBwYXJhbSB7c3RyaW5nfSBmYWN0b3J5XG4gKiBAcGFyYW0ge3t9fSBkZXBlbmRlbmNpZXNcbiAqXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fG9iamVjdH1cbiAqL1xubGV0IGZhY3RvcnkgPSAoe01vZHVsZSwgZmFjdG9yeX0sIGRlcGVuZGVuY2llcykgPT4ge1xuICAgIE1vZHVsZSA9IGV4dHJhY3RNb2R1bGUoTW9kdWxlKTtcblxuICAgIGlmIChNb2R1bGVbZmFjdG9yeV0pIHtcbiAgICAgICAgcmV0dXJuIE1vZHVsZVtmYWN0b3J5XShkZXBlbmRlbmNpZXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBuZXcgTW9kdWxlKGRlcGVuZGVuY2llcyk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBAcGFyYW0ge2Z1bmN0aW9uW119IHJlc29sdmVyc1xuICogQHBhcmFtIHtvYmplY3R9IGRlcGVuZGVuY2llc1xuICpcbiAqIEByZXR1cm5zIHtmdW5jdGlvbn1cbiAqL1xubGV0IGNyZWF0ZUNvbnRhaW5lciA9ICh7cmVzb2x2ZXJzID0gW10sIGRlcGVuZGVuY2llcyA9IHt9fSA9IHt9KSA9PiB7XG4gICAgbGV0IGRlZmluaXRpb25zID0gbm9ybWFsaXplRGVmaW5pdGlvbnMoZGVwZW5kZW5jaWVzKSxcbiAgICAgICAgcmVzb2x2ZSA9IGFycmF5UmVzb2x2ZXIocmVzb2x2ZXJzKTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7RGlEZWZpbml0aW9ufSBkZWZpbml0aW9uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fG9iamVjdH1cbiAgICAgKi9cbiAgICBsZXQgbG9hZE1vZHVsZUJ1bmRsZSA9IChkZWZpbml0aW9uKSA9PiB7XG4gICAgICAgIGlmIChkZWZpbml0aW9uLk1vZHVsZSkge1xuICAgICAgICAgICAgcmV0dXJuIGRlZmluaXRpb24uTW9kdWxlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoZW4ocmVzb2x2ZShkZWZpbml0aW9uLmJ1bmRsZU5hbWUpLCAoTW9kdWxlKSA9PiB7XG4gICAgICAgICAgICBpZiAoIU1vZHVsZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ0Nhbm5vdCBmaW5kIGJ1bmRsZSB3aXRoIG5hbWUgXCInICsgZGVmaW5pdGlvbi5idW5kbGVOYW1lICsgJ1wiJykpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBkZWZpbml0aW9uLk1vZHVsZSA9IE1vZHVsZTtcblxuICAgICAgICAgICAgcmV0dXJuIE1vZHVsZTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7RGlEZWZpbml0aW9ufHN0cmluZ30gbW9kdWxlXG4gICAgICogQHJldHVybnMge0RpRGVmaW5pdGlvbn1cbiAgICAgKi9cbiAgICBsZXQgbm9ybWFsaXplTW9kdWxlID0gKG1vZHVsZSkgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIG1vZHVsZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGlmIChkZWZpbml0aW9uc1ttb2R1bGVdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRlZmluaXRpb25zW21vZHVsZV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBkZWZpbml0aW9uc1ttb2R1bGVdID0gbm9ybWFsaXplRGVmaW5pdGlvbihtb2R1bGUsIHt9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnNvbGUubG9nKCdVTktOT1dOIE1PRFVMRScsIG1vZHVsZSk7XG5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIG1vZHVsZScpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xEaURlZmluaXRpb259IG1vZHVsZU5hbWVcbiAgICAgKiBAcGFyYW0ge3t9fSBwYXJhbXNcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPG9iamVjdD59XG4gICAgICovXG4gICAgbGV0IGxvYWRNb2R1bGUgPSAobW9kdWxlTmFtZSwgcGFyYW1zKSA9PiB7XG4gICAgICAgIGxldCBkZWZpbml0aW9uID0gbm9ybWFsaXplTW9kdWxlKG1vZHVsZU5hbWUpO1xuXG4gICAgICAgIGxldCBsb2FkID0gKCkgPT4ge1xuICAgICAgICAgICAgbGV0IHByb21pc2VzID0gW1xuICAgICAgICAgICAgICAgIGxvYWRNb2R1bGVEZXBlbmRlbmNpZXMoZGVmaW5pdGlvbiwgcGFyYW1zKSxcbiAgICAgICAgICAgICAgICBkZWZpbml0aW9uLmluc3RhbmNlID8gbnVsbCA6IGxvYWRNb2R1bGVCdW5kbGUoZGVmaW5pdGlvbilcbiAgICAgICAgICAgIF07XG5cbiAgICAgICAgICAgIHJldHVybiBhbGwocHJvbWlzZXMsIChbZGVwZW5kZW5jaWVzXSkgPT4ge1xuICAgICAgICAgICAgICAgIGxldCBfZmFjdG9yeSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRlZmluaXRpb24uaW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkZWZpbml0aW9uLmluc3RhbmNlO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhY3RvcnkoZGVmaW5pdGlvbiwgZGVwZW5kZW5jaWVzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAvLyBJZiBpbnN0YW5jZSBoYXMgdXBkYXRlRGVwZW5kZW5jaWVzIGludm9rZSBpdCBiZWZvcmUgY29tcGxldGUgREkgcmVzb2x2ZVxuICAgICAgICAgICAgICAgIHJldHVybiB0aGVuKF9mYWN0b3J5KCksIGluc3RhbmNlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGlzTmVlZFVwZGF0ZSA9ICFwYXJhbXMuZGlTZXNzaW9uSWQgfHwgZGVmaW5pdGlvbi5kaVNlc3Npb25JZCAhPT0gcGFyYW1zLmRpU2Vzc2lvbklkO1xuICAgICAgICAgICAgICAgICAgICBkZWZpbml0aW9uLmRpU2Vzc2lvbklkID0gcGFyYW1zLmRpU2Vzc2lvbklkO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0Z1bmN0aW9uKGluc3RhbmNlW2RlZmluaXRpb24udXBkYXRlXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc05lZWRVcGRhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhlbihpbnN0YW5jZVtkZWZpbml0aW9uLnVwZGF0ZV0oZGVwZW5kZW5jaWVzKSwgXyA9PiBpbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAoZGVmaW5pdGlvbi5fcHJvZ3Jlc3MpIHtcbiAgICAgICAgICAgIHJldHVybiBkZWZpbml0aW9uLl9wcm9ncmVzcztcbiAgICAgICAgfVxuXG4gICAgICAgIGRlZmluaXRpb24uX3Byb2dyZXNzID0gdGhlbihsb2FkKCksIGluc3RhbmNlID0+IHtcbiAgICAgICAgICAgIGRlZmluaXRpb24uaW5zdGFuY2UgPSBpbnN0YW5jZTtcblxuICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gdGhlbihkZWZpbml0aW9uLl9wcm9ncmVzcywgaW5zdGFuY2UgPT4ge1xuICAgICAgICAgICAgZGVmaW5pdGlvbi5fcHJvZ3Jlc3MgPSBudWxsO1xuXG4gICAgICAgICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3t9fSBkZXBlbmRlbmNpZXNcbiAgICAgKiBAcGFyYW0gcGFyYW1zXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fG9iamVjdH1cbiAgICAgKi9cbiAgICBsZXQgbG9hZE1vZHVsZXMgPSAoZGVwZW5kZW5jaWVzLCBwYXJhbXMpID0+IHtcbiAgICAgICAgbGV0IGxvYWRlZCA9IGV4dGVuZCh7fSwgcGFyYW1zKTtcblxuICAgICAgICBpZiAoZGVwZW5kZW5jaWVzKSB7XG4gICAgICAgICAgICBsZXQgcHJvbWlzZXMgPSBtYXAoZGVwZW5kZW5jaWVzLCAoZGVwZW5kZW5jeU5hbWUsIGtleSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGVuKGxvYWRNb2R1bGUoZGVwZW5kZW5jeU5hbWUsIHBhcmFtcyksIGRlcGVuZGVuY3kgPT4gbG9hZGVkW2tleV0gPSBkZXBlbmRlbmN5KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gYWxsKHByb21pc2VzLCBfID0+IGxvYWRlZCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbG9hZGVkO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xEaURlZmluaXRpb259IGRlZmluaXRpb25cbiAgICAgKiBAcGFyYW0ge3t9fSBwYXJhbXNcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPG9iamVjdD58b2JqZWN0fVxuICAgICAqL1xuICAgIGxldCBsb2FkTW9kdWxlRGVwZW5kZW5jaWVzID0gKGRlZmluaXRpb24sIHBhcmFtcykgPT4ge1xuICAgICAgICByZXR1cm4gbG9hZE1vZHVsZXMoZGVmaW5pdGlvbi5kZXBlbmRlbmNpZXMsIHBhcmFtcyk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfG9iamVjdH0gbW9kdWxlXG4gICAgICogQHBhcmFtIHt7fX0gW3BhcmFtc11cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPG9iamVjdD58b2JqZWN0fVxuICAgICAqL1xuICAgIGxldCBkaSA9IChtb2R1bGUsIHBhcmFtcyA9IHt9KSA9PiB7XG4gICAgICAgIGxldCBwcm9taXNlO1xuXG4gICAgICAgIGlmICh0eXBlb2YgbW9kdWxlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgcHJvbWlzZSA9IGxvYWRNb2R1bGUobW9kdWxlLCBwYXJhbXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJvbWlzZSA9IGxvYWRNb2R1bGVzKG1vZHVsZSwgcGFyYW1zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgc2Vzc2lvbiBvZiBESSBsb2FkaW5nLiBXaGVuIHNlc3Npb24gY2xvc2UgLSBhbGwgdW5rbm93biBkZXBlbmRlbmNpZXMgd2lsbCBiZSB0cnVuY2F0ZWRcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7e319IFtkZWZhdWx0c11cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHt7bG9hZDogRnVuY3Rpb24sIGNsb3NlOiBGdW5jdGlvbn19XG4gICAgICovXG4gICAgZGkuc2Vzc2lvbiA9IChkZWZhdWx0cyA9IHt9KSA9PiB7XG4gICAgICAgIGxldCBpZCA9IHVuaXF1ZUlkKCdkaScpO1xuXG4gICAgICAgIGRlZmF1bHRzLmRpU2Vzc2lvbklkID0gaWQ7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFdvcmsgbGlrZSBvcmlnaW5hbCBESSBmdW5jdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBAc2VlIGRpXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfG9iamVjdH0gbW9kdWxlXG4gICAgICAgICAqIEBwYXJhbSB7e319IFtwYXJhbXNdXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtQcm9taXNlPG9iamVjdD58b2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgbGV0IGRpU2Vzc2lvbiA9IChtb2R1bGUsIHBhcmFtcyA9IHt9KSA9PiB7XG4gICAgICAgICAgICBleHRlbmQocGFyYW1zLCBkZWZhdWx0cyk7XG5cbiAgICAgICAgICAgIHJldHVybiBkaShtb2R1bGUsIHBhcmFtcyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgZGlTZXNzaW9uLmxvYWQgPSBkaVNlc3Npb247XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJ1biBHQyB0byBkZXN0cm95IHVua25vd24gZGVwZW5kZW5jaWVzXG4gICAgICAgICAqL1xuICAgICAgICBkaVNlc3Npb24uY2xvc2UgPSAoKSA9PiB7XG4gICAgICAgICAgICBmb3JFYWNoKGRlZmluaXRpb25zLCAoZGVmaW5pdGlvbikgPT4ge1xuICAgICAgICAgICAgICAgIGxldCBpbnN0YW5jZSA9IGRlZmluaXRpb24uaW5zdGFuY2U7XG5cbiAgICAgICAgICAgICAgICBpZiAoIWRlZmluaXRpb24uaXNQZXJzaXN0ZW50ICYmIGRlZmluaXRpb24uZGlTZXNzaW9uSWQgJiYgZGVmaW5pdGlvbi5kaVNlc3Npb25JZCAhPT0gaWQgJiYgaW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGluc3RhbmNlLnRyaWdnZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLnRyaWdnZXIoJ2RpOmRlc3Ryb3knKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0Z1bmN0aW9uKGluc3RhbmNlLmRlc3Ryb3kpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBkZWZpbml0aW9uLmluc3RhbmNlID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICBmdW5jdGlvbnMoZGkpLmZvckVhY2goZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgICAgIGRpU2Vzc2lvbltuYW1lXSA9IGRpW25hbWVdO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gZGlTZXNzaW9uO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gaW5wdXREZWZpbml0aW9uXG4gICAgICogQHBhcmFtIHsqfSBpbnN0YW5jZVxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7RGlDb250YWluZXJ9XG4gICAgICovXG4gICAgZGkucHV0ID0gKGlucHV0RGVmaW5pdGlvbiwgaW5zdGFuY2UsIG9wdGlvbnMpID0+IHtcbiAgICAgICAgbGV0IGRlZmluaXRpb24gPSBub3JtYWxpemVNb2R1bGUoaW5wdXREZWZpbml0aW9uKTtcbiAgICAgICAgZXh0ZW5kKGRlZmluaXRpb24sIHtpbnN0YW5jZSwgaXNQZXJzaXN0ZW50OiB0cnVlfSwgb3B0aW9ucyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fVxuICAgICAqL1xuICAgIGRpLnNlcmlhbGl6ZSA9ICguLi5hcmdzKSA9PiB7XG4gICAgICAgIGxldCBzZXJpYWxpemVkID0ge307XG5cbiAgICAgICAgbGV0IHNlcmlhbGl6YWJsZSA9IGZpbHRlcihkZWZpbml0aW9ucywgKHtpbnN0YW5jZX0pID0+IHtcbiAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZSAmJiBpc0Z1bmN0aW9uKGluc3RhbmNlLnNlcmlhbGl6ZSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGxldCBzZXJpYWxpemVkUHJvbWlzZXMgPSBtYXAoc2VyaWFsaXphYmxlLCAoe2lkLCBpbnN0YW5jZX0pID0+IHtcbiAgICAgICAgICAgIHJldHVybiB0aGVuKGluc3RhbmNlLnNlcmlhbGl6ZSguLi5hcmdzKSwganNvbiA9PiBzZXJpYWxpemVkW2lkXSA9IGpzb24pO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gYWxsKHNlcmlhbGl6ZWRQcm9taXNlcywgKCkgPT4gc2VyaWFsaXplZCk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBkYXRhXG4gICAgICogQHBhcmFtIHsqfSBhcmdzXG4gICAgICovXG4gICAgZGkucmVzdG9yZSA9IChkYXRhLCAuLi5hcmdzKSA9PiB7XG4gICAgICAgIGxldCByZXN1bHRzID0gbWFwKGRhdGEsIChtb2R1bGVEYXRhLCBpZCkgPT4gZGkucmVzdG9yZU1vZHVsZShpZCwgbW9kdWxlRGF0YSwgLi4uYXJncykpO1xuXG4gICAgICAgIHJldHVybiBhbGwocmVzdWx0cywgZGF0YSA9PiBkYXRhKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGlkXG4gICAgICogQHBhcmFtIHsqfSBhcmdzXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICAgKi9cbiAgICBkaS5yZXN0b3JlTW9kdWxlID0gKGlkLCAuLi5hcmdzKSA9PiB7XG4gICAgICAgIGxldCBkZWZpbml0aW9uID0gbm9ybWFsaXplTW9kdWxlKGlkKTtcblxuICAgICAgICByZXR1cm4gdGhlbihsb2FkTW9kdWxlQnVuZGxlKGRlZmluaXRpb24pLCBNb2R1bGUgPT4ge1xuICAgICAgICAgICAgTW9kdWxlID0gZXh0cmFjdE1vZHVsZShNb2R1bGUpO1xuXG4gICAgICAgICAgICBpZiAoIU1vZHVsZS5yZXN0b3JlKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgcmVzdG9yZSBtb2R1bGUnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHRoZW4oTW9kdWxlLnJlc3RvcmUoLi4uYXJncyksIGluc3RhbmNlID0+IGRlZmluaXRpb24uaW5zdGFuY2UgPSBpbnN0YW5jZSk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyB7e319XG4gICAgICovXG4gICAgZGkuZ2V0RGVmaW5pdGlvbnMgPSAoKSA9PiB7XG4gICAgICAgIHJldHVybiBkZWZpbml0aW9ucztcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGlkXG4gICAgICogQHJldHVybnMge0RpRGVmaW5pdGlvbn1cbiAgICAgKi9cbiAgICBkaS5nZXREZWZpbml0aW9uID0gKGlkKSA9PiB7XG4gICAgICAgIHJldHVybiBub3JtYWxpemVNb2R1bGUoaWQpO1xuICAgIH07XG5cbiAgICByZXR1cm4gZGk7XG59O1xuXG5leHBvcnQge1xuICAgIGNyZWF0ZUNvbnRhaW5lcixcblxuICAgIHdlYnBhY2tSZXNvbHZlcixcbiAgICBzdGF0aWNSZXNvbHZlcixcbiAgICBhcnJheVJlc29sdmVyLFxuXG4gICAgdGhlbixcbiAgICBhbGwsXG4gICAgcUNhdGNoLFxuXG4gICAgcGFyc2VTdHJpbmdEZWZpbml0aW9uLFxuICAgIG5vcm1hbGl6ZURlZmluaXRpb25zLFxuICAgIG5vcm1hbGl6ZURlZmluaXRpb24sXG5cbiAgICBmYWN0b3J5XG59O1xuIl19