/**
 * @typedef {{bundleName: string, factory: string, Module: (function|{factory: function}), instance: object, dependencies: object, update: string}} DiDefinition
 */

/**
 * @typedef {{session: function, put: function}} DiContainer
 */

const DEFAULT_FACTORY = 'factory';
const DEFAULT_UPDATE = 'updateDependencies';
const DEFAULT_VALIDATE = 'isInstanceValid';
const STATIC_FIELD = 'static';

const INSTANCE_ID = typeof Symbol === 'function' ? Symbol('DI.js instance id') : '___di.js';

/**
 * Return object keys
 */
let keys = Object.keys;

/**
 * Simple version of object map
 *
 * @param object
 * @param callback
 * @returns {Array}
 */
let map = (object, callback) => {
    let objectKeys = keys(object),
        arr = new Array(objectKeys.length);

    for (let index = 0; index < objectKeys.length; index++) {
        arr[index] = callback(object[objectKeys[index]], objectKeys[index]);
    }

    return arr;
};

/**
 * Simple version of object forEach
 *
 * @param object
 * @param callback
 * @returns {Array}
 */
let forEach = (object, callback) => {
    let objKeys = keys(object);

    for (let index = 0; index < objKeys.length; index++) {
        callback(object[objKeys[index]], objKeys[index]);
    }
};

/**
 * Simple version of object filter
 *
 * @param object
 * @param callback
 * @returns {Array}
 */
let filter = (object, callback) => {
    let objKeys = keys(object),
        result = [];

    for (let index = 0; index < objKeys.length; index++) {
        let key = objKeys[index];

        if (callback(object[key], key)) {
            result.push(object[key]);
        }
    }

    return result;
};

/**
 * @param {{}} object
 * @param {function} callback
 *
 * @returns {*}
 */
let find = (object, callback) => {
    let objKeys = keys(object);

    for (let index = 0; index < objKeys.length; index++) {
        let value = object[objKeys[index]];

        if (callback(value)) {
            return value;
        }
    }
};

/**
 * Omit values from object by callback
 *
 * @param {{}} object
 * @param {function} callback
 *
 * @returns {{}}
 */
let omitBy = (object, callback) => {
    let result = {};

    forEach(object, (value, key) => {
        if (!callback(value, key)) {
            result[key] = value;
        }
    });

    return result;
};

/**
 * Omit values from object by key
 *
 * @param {{}} object
 * @param {string} key
 *
 * @returns {{}}
 */
let omit = (object, key) => {
    return omitBy(object, (_, _key) => _key === key);
};

/**
 * @param {{}} object
 *
 * @returns {string[]}
 */
let functions = (object) => {
    return keys(object).filter(key => isFunction(object[key]));
};

/**
 * @param {function} func
 *
 * @returns {boolean}
 */
let isFunction = (func) => {
    return isObject(func) && Object.prototype.toString.call(func) === '[object Function]';
};

/**
 * Extend variables
 *
 * @param {{}} object
 * @param {{}[]} args
 *
 * @returns {{}}
 */
let extend = Object.assign ? Object.assign : (object, ...args) => {
    for (let i = 0; i < args.length; i++) {
        let obj = args[i];

        if (obj != null) {
            let objKeys = keys(obj);

            for (var j = 0; j < objKeys.length; j++) {
                let key = objKeys[j];

                object[key] = obj[key];
            }
        }
    }

    return object;
};

/**
 * @param {{}} object
 * @param {{}[]} args
 *
 * @returns {{}}
 */
let defaults = (object, ...args) => {
    for (let i = 0; i < args.length; i++) {
        let obj = args[i];

        if (obj != null) {
            let objKeys = keys(obj);

            for (var j = 0; j < objKeys.length; j++) {
                let key = objKeys[j];

                if (object[key] === undefined) {
                    object[key] = obj[key];
                }
            }
        }
    }

    return object;
};

/**
 * @type {number}
 */
let uniqueIndex = 0;

/**
 * @returns {string}
 */
let uniqueId = () => {
    return 'di' + uniqueIndex++;
};

/**
 * @param {{}} object
 *
 * @returns {{}}
 */
let clone = (object) => {
    return extend({}, object);
};

/**
 * @type {function(arr: *): boolean}
 */
let isArray = Array.isArray ? Array.isArray : arr => arr instanceof Array;

/**
 * @param {{}} obj
 *
 * @returns {boolean}
 */
let isObject = obj => {
    let type = typeof obj;
    return !!obj && (type == 'object' || type == 'function');
};

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

        let nextLoader = () => {
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
 * @returns {{}}
 */
let parseStringDefinition = (definition) => {
    let matches = definition ?
        definition.match(/^!?([^.#]+)(\.([^#]+))?(#(.+))?$/) :
        null;

    if (!matches) {
        throw new Error('Unknown module format: ' + JSON.stringify(definition));
    }

    let bundleName = matches[1],
        factory = matches[3],
        update = matches[5];

    if (definition[0] === '!') {
        let reuseDefinition = {
            reuse: bundleName
        };

        if (factory) {
            reuseDefinition.factory = factory;
        }

        if (update) {
            reuseDefinition.update = update;
        }

        return reuseDefinition;
    } else {
        return {
            parentId: definition,
            bundleName,
            factory,
            update
        };
    }
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

    let dependencies = definition.dependencies;

    if (dependencies && dependencies[STATIC_FIELD]) {
        definition.static = dependencies[STATIC_FIELD];
        definition.dependencies = omit(dependencies, STATIC_FIELD);
    }

    return definition;
};

/**
 * @param {DiDefinition} definition
 *
 * @returns {DiDefinition}
 */
let normalizeDefinitionWithDefaults = (definition) => {
    if (definition.reuse) {
        return defaults(definition, {dependencies: {}})
    }

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
                    dependencies[dependency] = processDependency(dependency).id;
                } else {
                    dependency = [dependency, {}];
                }
            }

            if (isArray(dependency)) {
                let depId = definition.id + '/' + name;
                dependencies[depId] = dependency;

                let depDefinition = processDependency(depId);

                definitions[depDefinition.id] = depDefinition;
                definition.dependencies[name] = depDefinition.id;

                normalizeDefinitionDependencies(depDefinition);
            }
        });
    };

    let processDependency = (dependencyId) => {
        if (definitions[dependencyId]) {
            return definitions[dependencyId];
        }

        let definition = normalizeDefinitionView(dependencyId, dependencies[dependencyId]);

        if (definition.reuse) {
            let reuse = processDependency(definition.reuse);

            definition = extend(Object.create(reuse), definition);
            definition.parentId = definition.id;
            definition.dependencies = extend({}, reuse.dependencies, definition.dependencies);
        }

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
                let parent = processDependency(parentId);

                if (parent.reuse) {
                    let reuse = processDependency(parent.reuse);
                    definition = extend(Object.create(reuse), definition);
                }

                definition = defaults(definition, parent);
                definition.parentId = parentId;
                definition.bundleName = parent.bundleName;

                if (definition.dependencies !== parent.dependencies) {
                    definition.dependencies = extend({}, parent.dependencies, definition.dependencies);
                    definition.dependencies = omitBy(definition.dependencies, value => value == null);
                }

                if (parent.static) {
                    definition.static = extend({}, parent.static, definition.static);
                }
            }
        } else {
            definition = normalizeDefinitionWithDefaults(definition);
        }

        normalizeDefinitionDependencies(definition);

        return definitions[dependencyId] = definition;
    };

    keys(dependencies).forEach(processDependency);

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
        if (Module.default) {
            return Module.default;
        }

        return find(Module, value => isFunction(value) || isObject(value));
    }

    // Webpack 2 module
    if (typeof Module === 'object') {
        let descriptor = Object.getOwnPropertyNames(Module)
            .map(name => Object.getOwnPropertyDescriptor(Module, name))
            .find(descriptor => descriptor.get);

        if (descriptor) {
            return descriptor.get();
        }
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
        let moduleType = typeof Module;

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
let createContainer = ({
        resolvers = [],
        dependencies = {},
        factories = [createMethodFactory(), createInstanceFactory()],
        definitions = normalizeDefinitions(dependencies),
        resolve = arrayResolver(resolvers),
        factory = createArrayFactory(factories)} = {}) => {

    let destroyQueue = [];

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
        return !diSessionId || (definition.diSessionId !== diSessionId);
    };

    /**
     * @param {DiDefinition} definition
     * @param {{}} params
     * @returns {boolean}
     */
    let isModuleInstanceValid = (definition, params) => {
        let instance = definition.instance;

        if (instance && instance[DEFAULT_VALIDATE]) {
            return instance[DEFAULT_VALIDATE](params);
        }

        return Boolean(instance);
    };

    /**
     * @param {string|DiDefinition} moduleName
     * @param {{}} params
     *
     * @returns {Promise<object>}
     */
    let loadModule = (moduleName, params) => {
        let definition = normalizeModule(moduleName);
        let isInstanceValid = isModuleInstanceValid(definition, params);
        let isNeedUpdate = isModuleNeedUpdate(definition, params.diSessionId) || !isInstanceValid;

        let load = () => {
            let promises = [
                loadModuleDependencies(definition, params),
                definition.instance ? null : loadModuleBundle(definition)
            ];

            return all(promises, ([dependencies]) => {
                let _factory = () => {
                    if (definition.instance && isInstanceValid) {
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

                    definition.diSessionId = params.diSessionId;

                    if (isFunction(instance[definition.update])) {
                        if (isNeedUpdate) {
                            // If updateDependencies return instance with same type use it instead of instance
                            return then(instance[definition.update](dependencies), updateResult => {
                                if (updateResult && instance !== updateResult && updateResult instanceof instance.constructor) {
                                    destroyQueue.push(instance);

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

        if (definition.hasOwnProperty('instance') && definition.instance && !isNeedUpdate) {
            return definition.instance;
        }

        definition._progress = then(load(), instance => {
            definition.instance = instance;

            if (definition.reuse) {
                let reuse = normalizeModule(definition.reuse);
                reuse.instance = instance;
                reuse.diSessionId = params.diSessionId;
            }

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
        return then(loadModules(definition.dependencies, params), dependencies => {
            if (definition.static) {
                return extend(dependencies, definition.static);
            }

            return dependencies;
        });
    };

    /**
     * @param {DiDefinition} definition
     * @param {{trigger: boolean, destroy: boolean}} options
     */
    let destroyInstance = (definition, options) => {
        let instance = definition.instance;

        if (!instance) {
            return;
        }

        if (!definition.reuse) {
            destroyObject(instance, options);
            definition.instance = null;
        } else {
            delete definition.instance;
        }
    };

    /**
     * @param {*} instance
     * @param {boolean} trigger
     * @param {boolean} destroy
     */
    let destroyObject = (instance, {trigger = true, destroy = true} = {}) => {
        try {
            if (instance[INSTANCE_ID]) {
                if (trigger && isFunction(instance.trigger)) {
                    instance.trigger('di:destroy');
                }

                if (destroy && isFunction(instance.destroy)) {
                    instance.destroy();
                }

                instance[INSTANCE_ID] = undefined;
            }
        } catch (err) {
            console.error(err);
        }
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
        let id = uniqueId();

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

            while (destroyQueue.length) {
                let instance = destroyQueue.shift(),
                    definition = di.getInstanceDefinition(instance);

                if (!definition || instance !== definition.instance) {
                    destroyObject(instance, options);
                }
            }
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

        let serializable = filter(definitions, (definition) => {
            if (definition.hasOwnProperty('instance')) {
                let {instance} = definition;

                return instance && isFunction(instance.serialize);
            }
        });

        let serializedPromises = serializable.map(({id, instance}) => {
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
            let instanceId = instance[INSTANCE_ID];

            if (instanceId) {
                return definitions[instanceId];
            } else {
                let defKeys = keys(definitions);

                for (let index = 0; index < defKeys.length; index++) {
                    let key = defKeys[index];

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
        let reuseDefinitions = [];

        let cloneDefinition = (definition, proto = {}) => {
            let newDefinition = Object.create(proto);
            extend(newDefinition, cloneInstances ? definition : omit(definition, 'instance'));
            newDefinition.dependencies = clone(newDefinition.dependencies);
            return newDefinition;
        };

        forEach(definitions, (definition, id) => {
            if (definition.reuse) {
                reuseDefinitions.push({definition, id});
            } else {
                newDefinitions[id] = cloneDefinition(definition);
            }
        });

        reuseDefinitions.forEach(({definition, id}) => {
            newDefinitions[id] = cloneDefinition(definition, newDefinitions[definition.reuse]);
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
