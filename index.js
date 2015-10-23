import * as lodash from 'lodash';

// This ugly construction is compile to smaller sized file
let {
    extend,

    defaults,
    uniqueId,
    values,
    omit,

    isArray,
    isObject,
    isFunction,

    forEach,
    filter,
    map
    } = lodash;

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
let then = (promise, callback) => {
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
let all = (values, callback) => {
    let some = values.some(promise => Boolean(promise && promise.then));

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
let qCatch = (promise, callback) => {
    if (promise && promise.catch) {
        promise.catch(callback);
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
let webpackResolver = (requires) => {
    let bundles = {};

    /**
     * @param {function|{keys: function}} require
     * @returns {Function}
     */
    let createLoader = function (require) {
        require.keys().forEach((path) => {
            let name = path.match(/\/([^\/]+)$/)[1];

            // If we already has declared bundle, use it for loading
            // do not override
            if (!bundles[name]) {
                bundles[name] = () => {
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
    return (name) => {
        if (!name.match(/\.js$/)) {
            name += '.js';
        }

        let require = bundles[name],
            bundleLoader;

        if (require) {
            bundleLoader = require();

            if (typeof bundleLoader === 'function' && !bundleLoader.name) {
                if (bundleLoader.length === 1) {
                    return new Promise((resolve) => {
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
let staticResolver = (hash) => {
    return (name) => {
        return hash[name];
    }
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
let arrayResolver = (resolvers) => {
    let bundleCache = {};

    return (name) => {
        let queue = resolvers.slice();

        if (bundleCache[name]) {
            return bundleCache[name];
        }

        var nextLoader = () => {
            if (!queue.length) {
                return;
            }

            let loader = queue.shift();

            return then(loader(name), result => {
                if (result) {
                    return bundleCache[name] = result;
                } else {
                    return nextLoader();
                }
            });
        };

        return bundleCache[name] = nextLoader();
    }
};

/**
 * @param {string} definition
 * @returns {{name: string, factory: string|undefined}}
 */
let parseStringDefinition = (definition) => {
    let matches = definition ?
        definition.match(/^([^.]+)(\.(.+))?$/) :
        null;

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
let normalizeDefinition = (dependencyId, config) => {
    let definition = {
        id: dependencyId
    };

    if (typeof config === 'string') {
        extend(definition, parseStringDefinition(config));
    } else if (isArray(config)) {
        if (config.length === 1) {
            definition.id = uniqueId('di');

            extend(definition, config[0]);
        } else {
            extend(definition, parseStringDefinition(config[0]), {dependencies: config[1]});
        }
    } else if (isObject(config)) {
        extend(definition, parseStringDefinition(dependencyId), {dependencies: config});
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
let normalizeDefinitionDependencies = (definition, definitions) => {
    forEach(definition.dependencies, (dependency, name) => {
        if (typeof dependency === 'object' && !isArray(dependency)) {
            dependency = [name, dependency];
        }

        if (isArray(dependency)) {
            let depDefinition = normalizeDefinition(uniqueId(definition.id + '/' + name), dependency);
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
let normalizeDefinitions = (dependencies) => {
    let definitions = {};

    forEach(dependencies, (config, dependencyId) => {
        definitions[dependencyId] = normalizeDefinition(dependencyId, config);
    });

    forEach(definitions, (definition) => {
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
let extractModule = (Module) => {
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
let factory = ({Module, factory}, dependencies) => {
    Module = extractModule(Module);

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
let createContainer = ({resolvers = [], dependencies = {}} = {}) => {
    let definitions = normalizeDefinitions(dependencies),
        resolve = arrayResolver(resolvers);

    /**
     * @param {DiDefinition} definition
     *
     * @returns {Promise<object>|object}
     */
    let loadModuleBundle = (definition) => {
        if (definition.Module) {
            return definition.Module;
        }

        return then(resolve(definition.bundleName), (Module) => {
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
    let normalizeModule = (module) => {
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
    let loadModule = (moduleName, params) => {
        let definition = normalizeModule(moduleName);

        let load = () => {
            let promises = [
                loadModuleDependencies(definition, params),
                definition.instance ? null : loadModuleBundle(definition)
            ];

            return all(promises, ([dependencies]) => {
                let _factory = () => {
                    if (definition.instance) {
                        return definition.instance;
                    } else {
                        return factory(definition, dependencies);
                    }
                };

                // If instance has updateDependencies invoke it before complete DI resolve
                return then(_factory(), instance => {
                    let isNeedUpdate = !params.diSessionId || definition.diSessionId !== params.diSessionId;
                    definition.diSessionId = params.diSessionId;

                    if (isFunction(instance.updateDependencies)) {
                        if (isNeedUpdate) {
                            return then(instance.updateDependencies(dependencies), _ => instance);
                        }
                    }

                    return instance;
                });
            });
        };

        if (definition._progress) {
            return definition._progress;
        }

        definition._progress = then(load(), instance => {
            definition.instance = instance;

            return instance;
        });

        return then(definition._progress, instance => {
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
    let loadModules = (dependencies, params) => {
        let loaded = extend({}, params);

        if (dependencies) {
            let promises = map(dependencies, (dependencyName, key) => {
                return then(loadModule(dependencyName, params), dependency => loaded[key] = dependency);
            });

            return all(promises, _ => loaded);
        }

        return loaded;
    };

    /**
     * @param {string|DiDefinition} definition
     * @param {{}} params
     *
     * @returns {Promise<object>|object}
     */
    let loadModuleDependencies = (definition, params) => {
        return loadModules(definition.dependencies, params);
    };

    /**
     * @param {string|object} module
     * @param {{}} [params]
     *
     * @returns {Promise<object>|object}
     */
    let di = (module, params = {}) => {
        let promise;

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
    di.session = () => {
        let id = uniqueId('di');

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
            load: (module, params = {}) => {
                params.diSessionId = id;

                return di(module, params);
            },

            /**
             * Run GC to destroy unknown dependencies
             */
            close: () => {
                forEach(definitions, (definition) => {
                    let instance = definition.instance;

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
    di.put = (inputDefinition, instance) => {
        let definition = normalizeModule(inputDefinition);
        definition.instance = instance;
        definition.isPersistent = true;

        return this;
    };

    /**
     * @returns {Promise<object>}
     */
    di.serialize = (...args) => {
        let serialized = {};

        let serializable = filter(definitions, ({instance}) => {
            return instance && isFunction(instance.serialize);
        });

        let serializedPromises = map(serializable, ({id, instance}) => {
            return then(instance.serialize(...args), json => serialized[id] = json);
        });

        return all(serializedPromises, () => serialized);
    };

    /**
     * @param {object} data
     * @param {*} args
     */
    di.restore = (data, ...args) => {
        let results = map(data, (moduleData, id) => di.restoreModule(id, moduleData, ...args));

        return all(results, data => data);
    };

    /**
     * @param {string} id
     * @param {*} args
     *
     * @returns {Promise}
     */
    di.restoreModule = (id, ...args) => {
        let definition = normalizeModule(id);

        return then(loadModuleBundle(definition), Module => {
            Module = extractModule(Module);

            if (!Module.restore) {
                throw new Error('Cannot restore module');
            }

            return then(Module.restore(...args), instance => definition.instance = instance);
        });
    };

    /**
     * @returns {{}}
     */
    di.getDefinitions = () => {
        return definitions;
    };

    /**
     * @param {string} id
     * @returns {DiDefinition}
     */
    di.getDefinition = (id) => {
        return normalizeModule(id);
    };

    return di;
};

export {
    createContainer,

    webpackResolver,
    staticResolver,
    arrayResolver,

    then,
    all,
    qCatch,

    normalizeDefinitionDependencies,
    parseStringDefinition,
    normalizeDefinitions,
    normalizeDefinition,

    factory
};
