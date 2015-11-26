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
    var omit = _lodash.omit;
    var isArray = _lodash.isArray;
    var isObject = _lodash.isObject;
    var isFunction = _lodash.isFunction;
    var forEach = _lodash.forEach;
    var filter = _lodash.filter;
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

                params.diSessionId = id;

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
    exports.normalizeDefinitionDependencies = normalizeDefinitionDependencies;
    exports.parseStringDefinition = parseStringDefinition;
    exports.normalizeDefinitions = normalizeDefinitions;
    exports.normalizeDefinition = normalizeDefinition;
    exports.factory = factory;
});

//# sourceMappingURL=data:application/json;base64,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QUgsR0FBRztZQUNILE1BQU0sR0FBTixNQUFNO1lBRU4sK0JBQStCLEdBQS9CLCtCQUErQjtZQUMvQixxQkFBcUIsR0FBckIscUJBQXFCO1lBQ3JCLG9CQUFvQixHQUFwQixvQkFBb0I7WUFDcEIsbUJBQW1CLEdBQW5CLG1CQUFtQjtZQUVuQixPQUFPLEdBQVAsT0FBTyIsImZpbGUiOiJkaS5lczUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBsb2Rhc2ggZnJvbSAnbG9kYXNoJztcblxuLy8gVGhpcyB1Z2x5IGNvbnN0cnVjdGlvbiBpcyBjb21waWxlIHRvIHNtYWxsZXIgc2l6ZWQgZmlsZVxubGV0IHtcbiAgICBleHRlbmQsXG5cbiAgICBmdW5jdGlvbnMsXG4gICAgZGVmYXVsdHMsXG4gICAgdW5pcXVlSWQsXG4gICAgdmFsdWVzLFxuICAgIG9taXQsXG5cbiAgICBpc0FycmF5LFxuICAgIGlzT2JqZWN0LFxuICAgIGlzRnVuY3Rpb24sXG5cbiAgICBmb3JFYWNoLFxuICAgIGZpbHRlcixcbiAgICBtYXBcbiAgICB9ID0gbG9kYXNoO1xuXG4vKipcbiAqIEB0eXBlZGVmIHt7YnVuZGxlTmFtZTogc3RyaW5nLCBmYWN0b3J5OiBzdHJpbmcsIE1vZHVsZTogKGZ1bmN0aW9ufHtmYWN0b3J5OiBmdW5jdGlvbn0pLCBpbnN0YW5jZTogb2JqZWN0LCBkZXBlbmRlbmNpZXM6IG9iamVjdH19IERpRGVmaW5pdGlvblxuICovXG5cbi8qKlxuICogQHR5cGVkZWYge3tzZXNzaW9uOiBmdW5jdGlvbiwgcHV0OiBmdW5jdGlvbn19IERpQ29udGFpbmVyXG4gKi9cblxuLyoqXG4gKiBAcGFyYW0ge1Byb21pc2V8Kn0gcHJvbWlzZVxuICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2tcbiAqXG4gKiBAcmV0dXJucyB7UHJvbWlzZXwqfVxuICovXG5sZXQgdGhlbiA9IChwcm9taXNlLCBjYWxsYmFjaykgPT4ge1xuICAgIGlmIChwcm9taXNlICYmIHByb21pc2UudGhlbikge1xuICAgICAgICByZXR1cm4gcHJvbWlzZS50aGVuKGNhbGxiYWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKHByb21pc2UpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuLyoqXG4gKiBAcGFyYW0geyhQcm9taXNlfCopW119IHZhbHVlc1xuICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2tcbiAqXG4gKiBAcmV0dXJucyB7UHJvbWlzZXwqfVxuICovXG5sZXQgYWxsID0gKHZhbHVlcywgY2FsbGJhY2spID0+IHtcbiAgICBsZXQgc29tZSA9IHZhbHVlcy5zb21lKHByb21pc2UgPT4gQm9vbGVhbihwcm9taXNlICYmIHByb21pc2UudGhlbikpO1xuXG4gICAgaWYgKHNvbWUpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKHZhbHVlcykudGhlbihjYWxsYmFjayk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayh2YWx1ZXMpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuLyoqXG4gKiBAcGFyYW0ge1Byb21pc2V8Kn0gcHJvbWlzZVxuICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2tcbiAqXG4gKiBAcmV0dXJucyB7UHJvbWlzZXwqfVxuICovXG5sZXQgcUNhdGNoID0gKHByb21pc2UsIGNhbGxiYWNrKSA9PiB7XG4gICAgaWYgKHByb21pc2UgJiYgcHJvbWlzZS5jYXRjaCkge1xuICAgICAgICBwcm9taXNlLmNhdGNoKGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbi8qKlxuICogVXNhZ2U6XG4gKlxuICogYGBgXG4gKiAgcmVzb2x2ZXJzOiBbXG4gKiAgICAgIHdlYnBhY2tSZXNvbHZlcihbXG4gKiAgICAgICAgICByZXF1aXJlLmNvbnRleHQoJy4vc3RhdGVzLycsIHRydWUsIC9TdGF0ZS5qcyQvKSxcbiAqICAgICAgICAgIHJlcXVpcmUuY29udGV4dCgnLi9tb2RlbHMvJywgdHJ1ZSwgLy5qcyQvKVxuICogICAgICBdKVxuICogIF1cbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB7ZnVuY3Rpb25bXXx7a2V5czogZnVuY3Rpb259W119IHJlcXVpcmVzXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259XG4gKi9cbmxldCB3ZWJwYWNrUmVzb2x2ZXIgPSAocmVxdWlyZXMpID0+IHtcbiAgICBsZXQgYnVuZGxlcyA9IHt9O1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtmdW5jdGlvbnx7a2V5czogZnVuY3Rpb259fSByZXF1aXJlXG4gICAgICogQHJldHVybnMge0Z1bmN0aW9ufVxuICAgICAqL1xuICAgIGxldCBjcmVhdGVMb2FkZXIgPSBmdW5jdGlvbiAocmVxdWlyZSkge1xuICAgICAgICByZXF1aXJlLmtleXMoKS5mb3JFYWNoKChwYXRoKSA9PiB7XG4gICAgICAgICAgICBsZXQgbmFtZSA9IHBhdGgubWF0Y2goL1xcLyhbXlxcL10rKSQvKVsxXTtcblxuICAgICAgICAgICAgLy8gSWYgd2UgYWxyZWFkeSBoYXMgZGVjbGFyZWQgYnVuZGxlLCB1c2UgaXQgZm9yIGxvYWRpbmdcbiAgICAgICAgICAgIC8vIGRvIG5vdCBvdmVycmlkZVxuICAgICAgICAgICAgaWYgKCFidW5kbGVzW25hbWVdKSB7XG4gICAgICAgICAgICAgICAgYnVuZGxlc1tuYW1lXSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlcXVpcmUocGF0aCk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIHJlcXVpcmVzLmZvckVhY2goY3JlYXRlTG9hZGVyKTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbXMge3N0cmluZ30gbmFtZVxuICAgICAqXG4gICAgICogQHJldHVybnMge1Byb21pc2U8b2JqZWN0PnxvYmplY3R9XG4gICAgICovXG4gICAgcmV0dXJuIChuYW1lKSA9PiB7XG4gICAgICAgIGlmICghbmFtZS5tYXRjaCgvXFwuanMkLykpIHtcbiAgICAgICAgICAgIG5hbWUgKz0gJy5qcyc7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgcmVxdWlyZSA9IGJ1bmRsZXNbbmFtZV0sXG4gICAgICAgICAgICBidW5kbGVMb2FkZXI7XG5cbiAgICAgICAgaWYgKHJlcXVpcmUpIHtcbiAgICAgICAgICAgIGJ1bmRsZUxvYWRlciA9IHJlcXVpcmUoKTtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBidW5kbGVMb2FkZXIgPT09ICdmdW5jdGlvbicgJiYgIWJ1bmRsZUxvYWRlci5uYW1lKSB7XG4gICAgICAgICAgICAgICAgaWYgKGJ1bmRsZUxvYWRlci5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBidW5kbGVMb2FkZXIocmVzb2x2ZSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoYnVuZGxlTG9hZGVyLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYnVuZGxlTG9hZGVyKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gYnVuZGxlTG9hZGVyO1xuICAgICAgICB9XG4gICAgfTtcbn07XG5cbi8qKlxuICogVXNhZ2U6XG4gKlxuICogYGBgXG4gKiAgcmVzb2x2ZXJzOiBbXG4gKiAgICAgIHN0YXRpY1Jlc29sdmVyKHtcbiAqICAgICAgICAgIGNvbmZpZzogXyA9PiB7Li4ufSxcbiAqICAgICAgICAgIGdsb2JhbEJ1czogXyA9PiBuZXcgQmFja2JvbmUuV3JlcXIuRXZlbnRFbWl0dGVyKClcbiAqICAgICAgfSlcbiAqICBdXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0ge29iamVjdH0gaGFzaFxuICogQHJldHVybnMge0Z1bmN0aW9ufVxuICovXG5sZXQgc3RhdGljUmVzb2x2ZXIgPSAoaGFzaCkgPT4ge1xuICAgIHJldHVybiAobmFtZSkgPT4ge1xuICAgICAgICByZXR1cm4gaGFzaFtuYW1lXTtcbiAgICB9XG59O1xuXG4vKipcbiAqIFVzYWdlOlxuICpcbiAqIGBgYFxuICogIHJlc29sdmVyczogW1xuICogICAgICBhcnJheVJlc29sdmVyKFtcbiAqICAgICAgICAgIHN0YXRpY1Jlc29sdmVyKC4uLiksXG4gKiAgICAgICAgICB3ZWJwYWNrUmVzb2x2ZXIoLi4uKSxcbiAqICAgICAgICAgIC4uLi5cbiAqICAgICAgXSlcbiAqICBdXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0ge2Z1bmN0aW9uKG5hbWU6IHN0cmluZylbXX0gcmVzb2x2ZXJzXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259XG4gKi9cbmxldCBhcnJheVJlc29sdmVyID0gKHJlc29sdmVycykgPT4ge1xuICAgIGxldCBidW5kbGVDYWNoZSA9IHt9O1xuXG4gICAgcmV0dXJuIChuYW1lKSA9PiB7XG4gICAgICAgIGxldCBxdWV1ZSA9IHJlc29sdmVycy5zbGljZSgpO1xuXG4gICAgICAgIGlmIChidW5kbGVDYWNoZVtuYW1lXSkge1xuICAgICAgICAgICAgcmV0dXJuIGJ1bmRsZUNhY2hlW25hbWVdO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG5leHRMb2FkZXIgPSAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoIXF1ZXVlLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IGxvYWRlciA9IHF1ZXVlLnNoaWZ0KCk7XG5cbiAgICAgICAgICAgIHJldHVybiB0aGVuKGxvYWRlcihuYW1lKSwgcmVzdWx0ID0+IHtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBidW5kbGVDYWNoZVtuYW1lXSA9IHJlc3VsdDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV4dExvYWRlcigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBidW5kbGVDYWNoZVtuYW1lXSA9IG5leHRMb2FkZXIoKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7c3RyaW5nfSBkZWZpbml0aW9uXG4gKiBAcmV0dXJucyB7e25hbWU6IHN0cmluZywgZmFjdG9yeTogc3RyaW5nfHVuZGVmaW5lZH19XG4gKi9cbmxldCBwYXJzZVN0cmluZ0RlZmluaXRpb24gPSAoZGVmaW5pdGlvbikgPT4ge1xuICAgIGxldCBtYXRjaGVzID0gZGVmaW5pdGlvbiA/XG4gICAgICAgIGRlZmluaXRpb24ubWF0Y2goL14oW14uXSspKFxcLiguKykpPyQvKSA6XG4gICAgICAgIG51bGw7XG5cbiAgICBpZiAoIW1hdGNoZXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIG1vZHVsZSBmb3JtYXQ6ICcgKyBKU09OLnN0cmluZ2lmeShkZWZpbml0aW9uKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgYnVuZGxlTmFtZTogbWF0Y2hlc1sxXSxcbiAgICAgICAgZmFjdG9yeTogbWF0Y2hlc1szXVxuICAgIH07XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7c3RyaW5nfSBkZXBlbmRlbmN5SWRcbiAqIEBwYXJhbSB7e319IGNvbmZpZ1xuICogQHJldHVybnMgeyp9XG4gKi9cbmxldCBub3JtYWxpemVEZWZpbml0aW9uID0gKGRlcGVuZGVuY3lJZCwgY29uZmlnKSA9PiB7XG4gICAgbGV0IGRlZmluaXRpb24gPSB7XG4gICAgICAgIGlkOiBkZXBlbmRlbmN5SWRcbiAgICB9O1xuXG4gICAgaWYgKHR5cGVvZiBjb25maWcgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGV4dGVuZChkZWZpbml0aW9uLCBwYXJzZVN0cmluZ0RlZmluaXRpb24oY29uZmlnKSk7XG4gICAgfSBlbHNlIGlmIChpc0FycmF5KGNvbmZpZykpIHtcbiAgICAgICAgaWYgKGNvbmZpZy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIGRlZmluaXRpb24uaWQgPSB1bmlxdWVJZCgnZGknKTtcblxuICAgICAgICAgICAgZXh0ZW5kKGRlZmluaXRpb24sIGNvbmZpZ1swXSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBleHRlbmQoZGVmaW5pdGlvbiwgcGFyc2VTdHJpbmdEZWZpbml0aW9uKGNvbmZpZ1swXSksIHtkZXBlbmRlbmNpZXM6IGNvbmZpZ1sxXX0pO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChpc09iamVjdChjb25maWcpKSB7XG4gICAgICAgIGV4dGVuZChkZWZpbml0aW9uLCBwYXJzZVN0cmluZ0RlZmluaXRpb24oZGVwZW5kZW5jeUlkKSwge2RlcGVuZGVuY2llczogY29uZmlnfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIHR5cGUgb2YgZGVwZW5kZW5jeSBkZWZpbml0aW9uJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlZmF1bHRzKGRlZmluaXRpb24sIHtcbiAgICAgICAgZmFjdG9yeTogJ2ZhY3RvcnknLFxuICAgICAgICBkZXBlbmRlbmNpZXM6IHt9XG4gICAgfSk7XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7RGlEZWZpbml0aW9ufSBkZWZpbml0aW9uXG4gKiBAcGFyYW0ge3t9fSBkZWZpbml0aW9uc1xuICovXG5sZXQgbm9ybWFsaXplRGVmaW5pdGlvbkRlcGVuZGVuY2llcyA9IChkZWZpbml0aW9uLCBkZWZpbml0aW9ucykgPT4ge1xuICAgIGZvckVhY2goZGVmaW5pdGlvbi5kZXBlbmRlbmNpZXMsIChkZXBlbmRlbmN5LCBuYW1lKSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgZGVwZW5kZW5jeSA9PT0gJ29iamVjdCcgJiYgIWlzQXJyYXkoZGVwZW5kZW5jeSkpIHtcbiAgICAgICAgICAgIGRlcGVuZGVuY3kgPSBbbmFtZSwgZGVwZW5kZW5jeV07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNBcnJheShkZXBlbmRlbmN5KSkge1xuICAgICAgICAgICAgbGV0IGRlcERlZmluaXRpb24gPSBub3JtYWxpemVEZWZpbml0aW9uKHVuaXF1ZUlkKGRlZmluaXRpb24uaWQgKyAnLycgKyBuYW1lKSwgZGVwZW5kZW5jeSk7XG4gICAgICAgICAgICBkZWZpbml0aW9uc1tkZXBEZWZpbml0aW9uLmlkXSA9IGRlcERlZmluaXRpb247XG4gICAgICAgICAgICBkZWZpbml0aW9uLmRlcGVuZGVuY2llc1tuYW1lXSA9IGRlcERlZmluaXRpb24uaWQ7XG5cbiAgICAgICAgICAgIG5vcm1hbGl6ZURlZmluaXRpb25EZXBlbmRlbmNpZXMoZGVwRGVmaW5pdGlvbiwgZGVmaW5pdGlvbnMpO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7e319IGRlcGVuZGVuY2llc1xuICogQHJldHVybnMge3t9fVxuICovXG5sZXQgbm9ybWFsaXplRGVmaW5pdGlvbnMgPSAoZGVwZW5kZW5jaWVzKSA9PiB7XG4gICAgbGV0IGRlZmluaXRpb25zID0ge307XG5cbiAgICBmb3JFYWNoKGRlcGVuZGVuY2llcywgKGNvbmZpZywgZGVwZW5kZW5jeUlkKSA9PiB7XG4gICAgICAgIGRlZmluaXRpb25zW2RlcGVuZGVuY3lJZF0gPSBub3JtYWxpemVEZWZpbml0aW9uKGRlcGVuZGVuY3lJZCwgY29uZmlnKTtcbiAgICB9KTtcblxuICAgIGZvckVhY2goZGVmaW5pdGlvbnMsIChkZWZpbml0aW9uKSA9PiB7XG4gICAgICAgIG5vcm1hbGl6ZURlZmluaXRpb25EZXBlbmRlbmNpZXMoZGVmaW5pdGlvbiwgZGVmaW5pdGlvbnMpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGRlZmluaXRpb25zO1xufTtcblxuLyoqXG4gKiBFeHRyYWN0IG1vZHVsZSBmcm9tIEVTNiBkZWZpbml0aW9uXG4gKlxuICogQHBhcmFtIHt7X19lc01vZHVsZTogYm9vbGVhbn18ZnVuY3Rpb259IE1vZHVsZVxuICogQHJldHVybnMgeyp9XG4gKi9cbmxldCBleHRyYWN0TW9kdWxlID0gKE1vZHVsZSkgPT4ge1xuICAgIGlmIChNb2R1bGUuX19lc01vZHVsZSA9PT0gdHJ1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWVzKG9taXQoTW9kdWxlLCAnX19lc01vZHVsZScpKVswXTtcbiAgICB9XG5cbiAgICByZXR1cm4gTW9kdWxlO1xufTtcblxuLyoqXG4gKiBAcGFyYW0ge3tfX2VzTW9kdWxlOiBib29sZWFufXxmdW5jdGlvbn0gTW9kdWxlXG4gKiBAcGFyYW0ge3N0cmluZ30gZmFjdG9yeVxuICogQHBhcmFtIHt7fX0gZGVwZW5kZW5jaWVzXG4gKlxuICogQHJldHVybnMge1Byb21pc2U8b2JqZWN0PnxvYmplY3R9XG4gKi9cbmxldCBmYWN0b3J5ID0gKHtNb2R1bGUsIGZhY3Rvcnl9LCBkZXBlbmRlbmNpZXMpID0+IHtcbiAgICBNb2R1bGUgPSBleHRyYWN0TW9kdWxlKE1vZHVsZSk7XG5cbiAgICBpZiAoTW9kdWxlW2ZhY3RvcnldKSB7XG4gICAgICAgIHJldHVybiBNb2R1bGVbZmFjdG9yeV0oZGVwZW5kZW5jaWVzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbmV3IE1vZHVsZShkZXBlbmRlbmNpZXMpO1xuICAgIH1cbn07XG5cbi8qKlxuICogQHBhcmFtIHtmdW5jdGlvbltdfSByZXNvbHZlcnNcbiAqIEBwYXJhbSB7b2JqZWN0fSBkZXBlbmRlbmNpZXNcbiAqXG4gKiBAcmV0dXJucyB7ZnVuY3Rpb259XG4gKi9cbmxldCBjcmVhdGVDb250YWluZXIgPSAoe3Jlc29sdmVycyA9IFtdLCBkZXBlbmRlbmNpZXMgPSB7fX0gPSB7fSkgPT4ge1xuICAgIGxldCBkZWZpbml0aW9ucyA9IG5vcm1hbGl6ZURlZmluaXRpb25zKGRlcGVuZGVuY2llcyksXG4gICAgICAgIHJlc29sdmUgPSBhcnJheVJlc29sdmVyKHJlc29sdmVycyk7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0RpRGVmaW5pdGlvbn0gZGVmaW5pdGlvblxuICAgICAqXG4gICAgICogQHJldHVybnMge1Byb21pc2U8b2JqZWN0PnxvYmplY3R9XG4gICAgICovXG4gICAgbGV0IGxvYWRNb2R1bGVCdW5kbGUgPSAoZGVmaW5pdGlvbikgPT4ge1xuICAgICAgICBpZiAoZGVmaW5pdGlvbi5Nb2R1bGUpIHtcbiAgICAgICAgICAgIHJldHVybiBkZWZpbml0aW9uLk1vZHVsZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGVuKHJlc29sdmUoZGVmaW5pdGlvbi5idW5kbGVOYW1lKSwgKE1vZHVsZSkgPT4ge1xuICAgICAgICAgICAgaWYgKCFNb2R1bGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKCdDYW5ub3QgZmluZCBidW5kbGUgd2l0aCBuYW1lIFwiJyArIGRlZmluaXRpb24uYnVuZGxlTmFtZSArICdcIicpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZGVmaW5pdGlvbi5Nb2R1bGUgPSBNb2R1bGU7XG5cbiAgICAgICAgICAgIHJldHVybiBNb2R1bGU7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0RpRGVmaW5pdGlvbnxzdHJpbmd9IG1vZHVsZVxuICAgICAqIEByZXR1cm5zIHtEaURlZmluaXRpb259XG4gICAgICovXG4gICAgbGV0IG5vcm1hbGl6ZU1vZHVsZSA9IChtb2R1bGUpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBpZiAoZGVmaW5pdGlvbnNbbW9kdWxlXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBkZWZpbml0aW9uc1ttb2R1bGVdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZGVmaW5pdGlvbnNbbW9kdWxlXSA9IG5vcm1hbGl6ZURlZmluaXRpb24obW9kdWxlLCB7fSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zb2xlLmxvZygnVU5LTk9XTiBNT0RVTEUnLCBtb2R1bGUpO1xuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBtb2R1bGUnKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd8RGlEZWZpbml0aW9ufSBtb2R1bGVOYW1lXG4gICAgICogQHBhcmFtIHt7fX0gcGFyYW1zXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fVxuICAgICAqL1xuICAgIGxldCBsb2FkTW9kdWxlID0gKG1vZHVsZU5hbWUsIHBhcmFtcykgPT4ge1xuICAgICAgICBsZXQgZGVmaW5pdGlvbiA9IG5vcm1hbGl6ZU1vZHVsZShtb2R1bGVOYW1lKTtcblxuICAgICAgICBsZXQgbG9hZCA9ICgpID0+IHtcbiAgICAgICAgICAgIGxldCBwcm9taXNlcyA9IFtcbiAgICAgICAgICAgICAgICBsb2FkTW9kdWxlRGVwZW5kZW5jaWVzKGRlZmluaXRpb24sIHBhcmFtcyksXG4gICAgICAgICAgICAgICAgZGVmaW5pdGlvbi5pbnN0YW5jZSA/IG51bGwgOiBsb2FkTW9kdWxlQnVuZGxlKGRlZmluaXRpb24pXG4gICAgICAgICAgICBdO1xuXG4gICAgICAgICAgICByZXR1cm4gYWxsKHByb21pc2VzLCAoW2RlcGVuZGVuY2llc10pID0+IHtcbiAgICAgICAgICAgICAgICBsZXQgX2ZhY3RvcnkgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkZWZpbml0aW9uLmluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGVmaW5pdGlvbi5pbnN0YW5jZTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWN0b3J5KGRlZmluaXRpb24sIGRlcGVuZGVuY2llcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgLy8gSWYgaW5zdGFuY2UgaGFzIHVwZGF0ZURlcGVuZGVuY2llcyBpbnZva2UgaXQgYmVmb3JlIGNvbXBsZXRlIERJIHJlc29sdmVcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhlbihfZmFjdG9yeSgpLCBpbnN0YW5jZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBpc05lZWRVcGRhdGUgPSAhcGFyYW1zLmRpU2Vzc2lvbklkIHx8IGRlZmluaXRpb24uZGlTZXNzaW9uSWQgIT09IHBhcmFtcy5kaVNlc3Npb25JZDtcbiAgICAgICAgICAgICAgICAgICAgZGVmaW5pdGlvbi5kaVNlc3Npb25JZCA9IHBhcmFtcy5kaVNlc3Npb25JZDtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoaXNGdW5jdGlvbihpbnN0YW5jZS51cGRhdGVEZXBlbmRlbmNpZXMpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNOZWVkVXBkYXRlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoZW4oaW5zdGFuY2UudXBkYXRlRGVwZW5kZW5jaWVzKGRlcGVuZGVuY2llcyksIF8gPT4gaW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKGRlZmluaXRpb24uX3Byb2dyZXNzKSB7XG4gICAgICAgICAgICByZXR1cm4gZGVmaW5pdGlvbi5fcHJvZ3Jlc3M7XG4gICAgICAgIH1cblxuICAgICAgICBkZWZpbml0aW9uLl9wcm9ncmVzcyA9IHRoZW4obG9hZCgpLCBpbnN0YW5jZSA9PiB7XG4gICAgICAgICAgICBkZWZpbml0aW9uLmluc3RhbmNlID0gaW5zdGFuY2U7XG5cbiAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHRoZW4oZGVmaW5pdGlvbi5fcHJvZ3Jlc3MsIGluc3RhbmNlID0+IHtcbiAgICAgICAgICAgIGRlZmluaXRpb24uX3Byb2dyZXNzID0gbnVsbDtcblxuICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHt7fX0gZGVwZW5kZW5jaWVzXG4gICAgICogQHBhcmFtIHBhcmFtc1xuICAgICAqXG4gICAgICogQHJldHVybnMge1Byb21pc2U8b2JqZWN0PnxvYmplY3R9XG4gICAgICovXG4gICAgbGV0IGxvYWRNb2R1bGVzID0gKGRlcGVuZGVuY2llcywgcGFyYW1zKSA9PiB7XG4gICAgICAgIGxldCBsb2FkZWQgPSBleHRlbmQoe30sIHBhcmFtcyk7XG5cbiAgICAgICAgaWYgKGRlcGVuZGVuY2llcykge1xuICAgICAgICAgICAgbGV0IHByb21pc2VzID0gbWFwKGRlcGVuZGVuY2llcywgKGRlcGVuZGVuY3lOYW1lLCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhlbihsb2FkTW9kdWxlKGRlcGVuZGVuY3lOYW1lLCBwYXJhbXMpLCBkZXBlbmRlbmN5ID0+IGxvYWRlZFtrZXldID0gZGVwZW5kZW5jeSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIGFsbChwcm9taXNlcywgXyA9PiBsb2FkZWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGxvYWRlZDtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd8RGlEZWZpbml0aW9ufSBkZWZpbml0aW9uXG4gICAgICogQHBhcmFtIHt7fX0gcGFyYW1zXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fG9iamVjdH1cbiAgICAgKi9cbiAgICBsZXQgbG9hZE1vZHVsZURlcGVuZGVuY2llcyA9IChkZWZpbml0aW9uLCBwYXJhbXMpID0+IHtcbiAgICAgICAgcmV0dXJuIGxvYWRNb2R1bGVzKGRlZmluaXRpb24uZGVwZW5kZW5jaWVzLCBwYXJhbXMpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9IG1vZHVsZVxuICAgICAqIEBwYXJhbSB7e319IFtwYXJhbXNdXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fG9iamVjdH1cbiAgICAgKi9cbiAgICBsZXQgZGkgPSAobW9kdWxlLCBwYXJhbXMgPSB7fSkgPT4ge1xuICAgICAgICBsZXQgcHJvbWlzZTtcblxuICAgICAgICBpZiAodHlwZW9mIG1vZHVsZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHByb21pc2UgPSBsb2FkTW9kdWxlKG1vZHVsZSwgcGFyYW1zKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHByb21pc2UgPSBsb2FkTW9kdWxlcyhtb2R1bGUsIHBhcmFtcyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIHNlc3Npb24gb2YgREkgbG9hZGluZy4gV2hlbiBzZXNzaW9uIGNsb3NlIC0gYWxsIHVua25vd24gZGVwZW5kZW5jaWVzIHdpbGwgYmUgdHJ1bmNhdGVkXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7e2xvYWQ6IEZ1bmN0aW9uLCBjbG9zZTogRnVuY3Rpb259fVxuICAgICAqL1xuICAgIGRpLnNlc3Npb24gPSAoKSA9PiB7XG4gICAgICAgIGxldCBpZCA9IHVuaXF1ZUlkKCdkaScpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBXb3JrIGxpa2Ugb3JpZ2luYWwgREkgZnVuY3Rpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQHNlZSBkaVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9IG1vZHVsZVxuICAgICAgICAgKiBAcGFyYW0ge3t9fSBbcGFyYW1zXVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fG9iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGxldCBkaVNlc3Npb24gPSAobW9kdWxlLCBwYXJhbXMgPSB7fSkgPT4ge1xuICAgICAgICAgICAgcGFyYW1zLmRpU2Vzc2lvbklkID0gaWQ7XG5cbiAgICAgICAgICAgIHJldHVybiBkaShtb2R1bGUsIHBhcmFtcyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgZGlTZXNzaW9uLmxvYWQgPSBkaVNlc3Npb247XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJ1biBHQyB0byBkZXN0cm95IHVua25vd24gZGVwZW5kZW5jaWVzXG4gICAgICAgICAqL1xuICAgICAgICBkaVNlc3Npb24uY2xvc2UgPSAoKSA9PiB7XG4gICAgICAgICAgICBmb3JFYWNoKGRlZmluaXRpb25zLCAoZGVmaW5pdGlvbikgPT4ge1xuICAgICAgICAgICAgICAgIGxldCBpbnN0YW5jZSA9IGRlZmluaXRpb24uaW5zdGFuY2U7XG5cbiAgICAgICAgICAgICAgICBpZiAoIWRlZmluaXRpb24uaXNQZXJzaXN0ZW50ICYmIGRlZmluaXRpb24uZGlTZXNzaW9uSWQgJiYgZGVmaW5pdGlvbi5kaVNlc3Npb25JZCAhPT0gaWQgJiYgaW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGluc3RhbmNlLnRyaWdnZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLnRyaWdnZXIoJ2RpOmRlc3Ryb3knKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0Z1bmN0aW9uKGluc3RhbmNlLmRlc3Ryb3kpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBkZWZpbml0aW9uLmluc3RhbmNlID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICBmdW5jdGlvbnMoZGkpLmZvckVhY2goZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgICAgIGRpU2Vzc2lvbltuYW1lXSA9IGRpW25hbWVdO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gZGlTZXNzaW9uO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gaW5wdXREZWZpbml0aW9uXG4gICAgICogQHBhcmFtIHsqfSBpbnN0YW5jZVxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7RGlDb250YWluZXJ9XG4gICAgICovXG4gICAgZGkucHV0ID0gKGlucHV0RGVmaW5pdGlvbiwgaW5zdGFuY2UsIG9wdGlvbnMpID0+IHtcbiAgICAgICAgbGV0IGRlZmluaXRpb24gPSBub3JtYWxpemVNb2R1bGUoaW5wdXREZWZpbml0aW9uKTtcbiAgICAgICAgZXh0ZW5kKGRlZmluaXRpb24sIHtpbnN0YW5jZSwgaXNQZXJzaXN0ZW50OiB0cnVlfSwgb3B0aW9ucyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxvYmplY3Q+fVxuICAgICAqL1xuICAgIGRpLnNlcmlhbGl6ZSA9ICguLi5hcmdzKSA9PiB7XG4gICAgICAgIGxldCBzZXJpYWxpemVkID0ge307XG5cbiAgICAgICAgbGV0IHNlcmlhbGl6YWJsZSA9IGZpbHRlcihkZWZpbml0aW9ucywgKHtpbnN0YW5jZX0pID0+IHtcbiAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZSAmJiBpc0Z1bmN0aW9uKGluc3RhbmNlLnNlcmlhbGl6ZSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGxldCBzZXJpYWxpemVkUHJvbWlzZXMgPSBtYXAoc2VyaWFsaXphYmxlLCAoe2lkLCBpbnN0YW5jZX0pID0+IHtcbiAgICAgICAgICAgIHJldHVybiB0aGVuKGluc3RhbmNlLnNlcmlhbGl6ZSguLi5hcmdzKSwganNvbiA9PiBzZXJpYWxpemVkW2lkXSA9IGpzb24pO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gYWxsKHNlcmlhbGl6ZWRQcm9taXNlcywgKCkgPT4gc2VyaWFsaXplZCk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBkYXRhXG4gICAgICogQHBhcmFtIHsqfSBhcmdzXG4gICAgICovXG4gICAgZGkucmVzdG9yZSA9IChkYXRhLCAuLi5hcmdzKSA9PiB7XG4gICAgICAgIGxldCByZXN1bHRzID0gbWFwKGRhdGEsIChtb2R1bGVEYXRhLCBpZCkgPT4gZGkucmVzdG9yZU1vZHVsZShpZCwgbW9kdWxlRGF0YSwgLi4uYXJncykpO1xuXG4gICAgICAgIHJldHVybiBhbGwocmVzdWx0cywgZGF0YSA9PiBkYXRhKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGlkXG4gICAgICogQHBhcmFtIHsqfSBhcmdzXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICAgKi9cbiAgICBkaS5yZXN0b3JlTW9kdWxlID0gKGlkLCAuLi5hcmdzKSA9PiB7XG4gICAgICAgIGxldCBkZWZpbml0aW9uID0gbm9ybWFsaXplTW9kdWxlKGlkKTtcblxuICAgICAgICByZXR1cm4gdGhlbihsb2FkTW9kdWxlQnVuZGxlKGRlZmluaXRpb24pLCBNb2R1bGUgPT4ge1xuICAgICAgICAgICAgTW9kdWxlID0gZXh0cmFjdE1vZHVsZShNb2R1bGUpO1xuXG4gICAgICAgICAgICBpZiAoIU1vZHVsZS5yZXN0b3JlKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgcmVzdG9yZSBtb2R1bGUnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHRoZW4oTW9kdWxlLnJlc3RvcmUoLi4uYXJncyksIGluc3RhbmNlID0+IGRlZmluaXRpb24uaW5zdGFuY2UgPSBpbnN0YW5jZSk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyB7e319XG4gICAgICovXG4gICAgZGkuZ2V0RGVmaW5pdGlvbnMgPSAoKSA9PiB7XG4gICAgICAgIHJldHVybiBkZWZpbml0aW9ucztcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGlkXG4gICAgICogQHJldHVybnMge0RpRGVmaW5pdGlvbn1cbiAgICAgKi9cbiAgICBkaS5nZXREZWZpbml0aW9uID0gKGlkKSA9PiB7XG4gICAgICAgIHJldHVybiBub3JtYWxpemVNb2R1bGUoaWQpO1xuICAgIH07XG5cbiAgICByZXR1cm4gZGk7XG59O1xuXG5leHBvcnQge1xuICAgIGNyZWF0ZUNvbnRhaW5lcixcblxuICAgIHdlYnBhY2tSZXNvbHZlcixcbiAgICBzdGF0aWNSZXNvbHZlcixcbiAgICBhcnJheVJlc29sdmVyLFxuXG4gICAgdGhlbixcbiAgICBhbGwsXG4gICAgcUNhdGNoLFxuXG4gICAgbm9ybWFsaXplRGVmaW5pdGlvbkRlcGVuZGVuY2llcyxcbiAgICBwYXJzZVN0cmluZ0RlZmluaXRpb24sXG4gICAgbm9ybWFsaXplRGVmaW5pdGlvbnMsXG4gICAgbm9ybWFsaXplRGVmaW5pdGlvbixcblxuICAgIGZhY3Rvcnlcbn07XG4iXX0=