import * as lodash from 'lodash';

// This ugly construction is compile to smaller sized file
let {
    extend,

    functions,
    defaults,
    uniqueId,
    clone,
    keys,
    omit,

    isArray,
    isObject,
    isFunction,

    forEach,
    filter,
    find,
    map
    } = lodash;

const DEFAULT_FACTORY = 'factory';
const DEFAULT_UPDATE = 'updateDependencies';

const INSTANCE_ID = typeof Symbol === 'function' ? Symbol('DI.js instance id') : '___di.js';

/**
 * @typedef {{bundleName: string, factory: string, Module: (function|{factory: function}), instance: object, dependencies: object, update: string}} DiDefinition
 */

/**
 * @typedef {{session: function, put: function}} DiContainer
 */

/**
 * @param {Promise|*} promise
 * @param {function} success
 * @param {function} [error]
 *
 * @returns {Promise|*}
 */
let then = (promise, success, error) => {
    if (promise && promise.then) {
        return promise.then(success, error);
    } else {
        try {
            return success(promise);
        } catch (err) {
            if (error) {
                return error(err);
            } else {
                return Promise.reject(err);
            }
        }
    }
};

/**
 * @param {(Promise|*)[]} values
 * @param {function} callback
 * @param {function} [error]
 *
 * @returns {Promise|*}
 */
let all = (values, callback, error) => {
    let some = values.some(promise => Boolean(promise && promise.then));

    if (some) {
        return Promise.all(values).then(callback, error);
    } else {
        try {
            return callback(values);
        } catch (err) {
            if (error) {
                return error(err);
            } else {
                return Promise.reject(err);
            }
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
        definition.match(/^([^.#]+)(\.([^#]+))?(#(.+))?$/) :
        null;

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
let normalizeDefinitionView = (dependencyId, config) => {
    let definition = {
        id: dependencyId
    };

    if (typeof config === 'string') {
        extend(definition, parseStringDefinition(config));
    } else if (isArray(config)) {
        if (typeof config[0] === 'object') {
            extend(definition, config[0]);
        } else {
            extend(definition, parseStringDefinition(config[0]), {dependencies: config[1]});
        }
    } else if (isObject(config)) {
        extend(definition, parseStringDefinition(dependencyId), {dependencies: config});
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
let normalizeDefinitionWithDefaults = (definition) => {
    return defaults(definition, {
        factory: DEFAULT_FACTORY,
        update: DEFAULT_UPDATE,
        dependencies: {}
    });
};

/**
 * @param {string} dependencyId
 * @param {{}} config
 *
 * @returns {DiDefinition}
 */
let normalizeDefinition = (dependencyId, config) => {
    return normalizeDefinitionWithDefaults(normalizeDefinitionView(dependencyId, config));
};

/**
 * @param {{}} dependencies
 * @returns {{}}
 */
let normalizeDefinitions = (dependencies) => {
    let definitions = {};

    /**
     * @param {DiDefinition} definition
     */
    let normalizeDefinitionDependencies = (definition) => {
        forEach(definition.dependencies, (dependency, name) => {
            if (typeof dependency === 'object' && !isArray(dependency)) {
                dependency = [name, dependency];
            }

            if (typeof dependency === 'string' && !dependencies[dependency]) {
                let stringDefinition = parseStringDefinition(dependency);

                // If we use bundleName as dependency, and bundle is not defined in global definitions, we need to create it
                // elsewhere create dynamic definition
                if (stringDefinition.bundleName === dependency) {
                    dependencies[dependency] = process(dependency).id;
                } else {
                    dependency = [dependency, {}];
                }
            }

            if (isArray(dependency)) {
                var depId = definition.id + '/' + name;
                dependencies[depId] = dependency;

                let depDefinition = process(depId);

                definitions[depDefinition.id] = depDefinition;
                definition.dependencies[name] = depDefinition.id;

                normalizeDefinitionDependencies(depDefinition);
            }
        });
    };

    let process = (dependencyId) => {
        if (definitions[dependencyId]) {
            return definitions[dependencyId];
        }

        let definition = normalizeDefinitionView(dependencyId, dependencies[dependencyId]);

        if (definition.id !== definition.parentId) {
            let parentId;

            if (dependencies[definition.parentId]) {
                parentId = definition.parentId;
            } else {
                parentId = definition.bundleName;
            }

            if (parentId === dependencyId) {
                definition.parentId = definition.bundleName;
                definition = normalizeDefinitionWithDefaults(definition);
            } else {
                let parent = process(parentId);

                definition = defaults(definition, parent);
                definition.parentId = parentId;
                definition.bundleName = parent.bundleName;
            }
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
let extractModule = (Module) => {
    if (Module.__esModule === true) {
        return find(Module, value => isFunction(value) || isObject(value));
    }

    return Module;
};

/**
 * @returns {function}
 */
let createMethodFactory = () => {
    return ({Module, factory, id}, dependencies) => {
        if (Module[factory]) {
            return then(Module[factory](dependencies), (instance) => {
                if (!instance) {
                    throw new Error('Factory "' + id + '.' + factory + '" return instance of ' + typeof instance + ' type');
                }

                return instance;
            });
        }

        if (factory && factory !== DEFAULT_FACTORY) {
            throw new Error('Module "' + id + '" has no factory with name "' + factory + '"');
        }
    };
};

/**
 * @returns {function}
 */
let createInstanceFactory = () => {
    return ({Module, id}, dependencies) => {
        var moduleType = typeof Module;

        if (moduleType !== 'function') {
            throw new Error('Module "' + id + '" cannot be constructed, because has ' + moduleType + ' type');
        }

        return new Module(dependencies);
    };
};

/**
 * @param {[]} factories Array of factories
 * @returns {Function}
 */
let createArrayFactory = (factories) => {
    return (definition, dependencies) => {
        let factoriesQueue = factories.slice();

        let nextFactory = () => {
            let factory = factoriesQueue.shift();

            return then(factory(definition, dependencies), instance => {
                if (instance) {
                    return instance;
                } else {
                    if (factoriesQueue.length) {
                        return nextFactory();
                    }
                }
            });
        };

        return nextFactory();
    };
};

/**
 * @param {function[]} resolvers
 * @param {object} dependencies
 *
 * @param {function} [factory]
 * @param {function} [resolve]
 * @param {function[]} [factories]
 * @param {object} [definitions]
 *
 * @returns {function}
 */
let createContainer = ({resolvers = [], dependencies = {}, factories, definitions, resolve, factory} = {}) => {
    if (!definitions) {
        definitions = normalizeDefinitions(dependencies);
    }

    if (!resolve) {
        resolve = arrayResolver(resolvers);
    }

    if (!factory) {
        if (!factories) {
            factories = [createMethodFactory(), createInstanceFactory()];
        }

        factory = createArrayFactory(factories);
    }

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
                throw new Error('Cannot find bundle with name "' + definition.bundleName + '"');
            }

            definition.Module = extractModule(Module);

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

        throw new Error('Unknown module: ' + JSON.stringify(module));
    };

    /**
     * @param {DiDefinition} definition
     * @param {string} diSessionId
     * @returns {boolean}
     */
    let isModuleNeedUpdate = (definition, diSessionId) => {
        var isNeedUpdate = !diSessionId || definition.diSessionId !== diSessionId;

        if (isNeedUpdate && definition.instance) {
            return isFunction(definition.instance[definition.update]);
        }

        return isNeedUpdate;
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
                dependencies.definition = definition;

                let _factory = () => {
                    if (definition.instance) {
                        return definition.instance;
                    } else {
                        return factory(definition, dependencies);
                    }
                };

                // If instance has updateDependencies invoke it before complete DI resolve
                return then(_factory(), instance => {
                    if (!instance) {
                        throw new Error('Factory of "' + definition.id + '" return instance of ' + (typeof instance) + ' type');
                    }

                    instance[INSTANCE_ID] = definition.id;

                    var isNeedUpdate = isModuleNeedUpdate(definition, params.diSessionId);
                    definition.diSessionId = params.diSessionId;

                    if (isFunction(instance[definition.update])) {
                        if (isNeedUpdate) {
                            // If updateDependencies return instance with same type use it instead of instance
                            return then(instance[definition.update](dependencies), updateResult => {
                                if (updateResult && updateResult instanceof instance.constructor) {
                                    return updateResult;
                                }

                                return instance;
                            });
                        }
                    } else if (definition.update && definition.update !== DEFAULT_UPDATE) {
                        throw new Error('Module "' + definition.id + '" has no instance method with name "' + definition.update + '"');
                    }

                    return instance;
                });
            });
        };

        if (definition._progress) {
            return definition._progress;
        }

        if (definition.instance && !isModuleNeedUpdate(definition, params.diSessionId)) {
            return definition.instance;
        }

        definition._progress = then(load(), instance => {
            definition.instance = instance;

            return instance;
        });

        return then(definition._progress, instance => {
            definition._progress = null;

            return instance;
        }, error => {
            definition._progress = null;

            throw error;
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
     * @param {DiDefinition} definition
     * @param {boolean} trigger
     * @param {boolean} destroy
     */
    let destroyInstance = (definition, {trigger = true, destroy = true} = {}) => {
        let instance = definition.instance;

        if (!instance) {
            return;
        }

        if (trigger && isFunction(instance.trigger)) {
            instance.trigger('di:destroy');
        }

        if (destroy && isFunction(instance.destroy)) {
            instance.destroy();
        }

        definition.instance = null;
        delete instance[INSTANCE_ID];
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
     * @param {{}} [defaults]
     *
     * @returns {{load: Function, close: Function}}
     */
    di.session = (defaults = {}) => {
        let id = uniqueId('di');

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
        let diSession = (module, params = {}) => {
            extend(params, defaults);

            return di(module, params);
        };

        diSession.load = diSession;

        /**
         * Run GC to destroy unknown dependencies
         *
         * @param {{trigger: boolean, destroy: boolean}} options
         */
        diSession.close = (options) => {
            forEach(definitions, (definition) => {
                let instance = definition.instance;

                if (!definition.isPersistent && definition.diSessionId && definition.diSessionId !== id && instance) {
                    destroyInstance(definition, options);
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
    di.put = (inputDefinition, instance, options) => {
        let definition = normalizeModule(inputDefinition);
        extend(definition, {instance, isPersistent: true}, options);

        instance[INSTANCE_ID] = definition.id;

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

    /**
     * @param {object} instance
     * @returns {DiDefinition}
     */
    di.getInstanceDefinition = (instance) => {
        if (instance) {
            var instanceId = instance[INSTANCE_ID];

            if (instanceId) {
                return definitions[instanceId];
            } else {
                let defKeys = keys(definitions);

                for (var index = 0; index < defKeys.length; index++) {
                    var key = defKeys[index];

                    if (definitions[key].instance === instance) {
                        return definitions[key];
                    }
                }
            }
        }
    };

    /**
     * Destroy all definitions and clean up container
     *
     * @param {{trigger: boolean, destroy: boolean}} options
     */
    di.destroy = (options) => {
        forEach(definitions, definition => destroyInstance(definition, options));
    };

    /**
     * Clone container with definitions and resolvers
     *
     * @property {boolean} cloneInstances
     *
     * @returns {function}
     */
    di.clone = ({cloneInstances = false} = {}) => {
        let newDefinitions = {};

        forEach(definitions, (definition, id) => {
            var newDefinition = cloneInstances ? clone(definition) : omit(definition, 'instance');
            newDefinition.dependencies = clone(newDefinition.dependencies);

            newDefinitions[id] = newDefinition;
        });

        return createContainer({
            resolve: resolve,
            definitions: newDefinitions,
            factory: factory
        })
    };

    return di;
};

export {
    createContainer,

    webpackResolver,
    staticResolver,
    arrayResolver,

    createMethodFactory,
    createInstanceFactory,
    createArrayFactory,

    then,
    all,
    qCatch,

    parseStringDefinition,
    normalizeDefinitions,
    normalizeDefinition,

    extractModule
};
