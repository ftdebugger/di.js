import _ from 'lodash';


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
        return callback(promise);
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
        return callback(values);
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
 * @param {function|{keys: function}} require
 * @returns {Function}
 */
let createLoader = function (require) {
    let bundles = {};

    require.keys().forEach((path) => {
        let name = path.match(/\/([^\/]+)$/)[1];

        bundles[name] = {path};
    });

    return (name) => {
        let description = bundles[name],
            bundleLoader;

        if (description) {
            bundleLoader = require(description.path);

            if (typeof bundleLoader === 'function' && !bundleLoader.name) {
                return new Promise((resolve) => {
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
                return new Promise((resolve) => {
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
        _.extend(definition, parseStringDefinition(config));
    } else if (_.isArray(config)) {
        if (config.length === 1) {
            definition.id = _.uniqueId('di');

            _.extend(definition, config[0]);
        } else {
            _.extend(definition, parseStringDefinition(config[0]), {dependencies: config[1]});
        }
    } else if (_.isObject(config)) {
        _.extend(definition, parseStringDefinition(dependencyId), {dependencies: config});
    } else {
        throw new Error('Unknown type of dependency definition');
    }

    return _.defaults(definition, {
        factory: 'factory',
        dependencies: {}
    });
};

/**
 * @param {DiDefinition} definition
 * @param {{}} definitions
 */
let normalizeDefinitionDependencies = (definition, definitions) => {
    _.forEach(definition.dependencies, (dependency, name) => {
        if (typeof dependency === 'object' && !_.isArray(dependency)) {
            dependency = [name, dependency];
        }

        if (_.isArray(dependency)) {
            let depDefinition = normalizeDefinition(_.uniqueId(definition.id + '/' + name), dependency);
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

    _.forEach(dependencies, (config, dependencyId) => {
        definitions[dependencyId] = normalizeDefinition(dependencyId, config);
    });

    _.forEach(definitions, (definition) => {
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
let factory = ({Module, factory}, dependencies) => {
    if (Module.__esModule === true) {
        Module = _.values(Module)[0];
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

                    if (_.isFunction(instance.updateDependencies)) {
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
        let loaded = _.extend({}, params);

        if (dependencies) {
            let promises = _.map(dependencies, (dependencyName, key) => {
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
        let id = _.uniqueId('di');

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
                _.forEach(definitions, (definition) => {
                    let instance = definition.instance;

                    if (!definition.isPersistent && definition.diSessionId && definition.diSessionId !== id && instance) {
                        if (instance.trigger) {
                            instance.trigger('di:destroy');
                        }

                        if (_.isFunction(instance.destroy)) {
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
