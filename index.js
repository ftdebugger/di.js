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
 *          config: {...},
 *          globalBus: new Backbone.Wreqr.EventEmitter()
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
 * @param {string} definition
 * @returns {{name: string, factory: string|undefined}}
 */
let parseStringDefinition = (definition) => {
    let matches = definition.match(/^([^.]+)(\.(.+))?$/);

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
let normalizeDependencyDefinition = (dependencyId, config) => {
    let definition = {
        id: dependencyId
    };

    if (typeof config === 'string') {
        _.extend(definition, parseStringDefinition(config));
    } else if (_.isArray(config)) {
        if (config.length === 1) {
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
        factory: 'factory'
    });
};

/**
 * @param {{}} dependencies
 * @returns {{}}
 */
let normalizeDependencyDefinitions = (dependencies) => {
    let definitions = {};

    _.forEach(dependencies, (config, dependencyId) => {
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
let createContainer = ({resolvers = [], dependencies = {}} = {}) => {
    let bundleCache = {};

    let definitions = normalizeDependencyDefinitions(dependencies);

    /**
     * @param {DiDefinition} definition
     * @param {{}} dependencies
     *
     * @returns {Promise<object>|object}
     */
    let factory = (definition, dependencies) => {
        let Module = definition.Module,
            factory = definition.factory;

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
     * @param {DiDefinition} definition
     *
     * @returns {Promise<object>|object}
     */
    let loadModuleBundle = (definition) => {
        if (definition.Module) {
            return definition.Module;
        }

        let queue = resolvers.slice(),
            name = definition.bundleName;

        let loadBundle = () => {
            if (bundleCache[name]) {
                return bundleCache[name];
            }

            var nextLoader = () => {
                if (!queue.length) {
                    return Promise.reject(new Error('Cannot find bundle with name "' + definition.bundleName + '"'));
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
        };

        return then(loadBundle(), (Module) => {
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
    let loadModule = (moduleName, params) => {
        let definition = normalizeModule(moduleName);

        let load = () => {
            let promises = [
                definition.instance ? null : loadModuleBundle(definition),
                loadModuleDependencies(definition, params)
            ];

            return all(promises, ([Module, dependencies]) => {
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
    let di = (module, params) => {
        let promise;

        params = params || {};

        if (typeof module === 'string') {
            promise = loadModule(module, params);
        } else {
            promise = loadModules(module, params);
        }

        qCatch(promise, err => {
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
            load: (module, params) => {
                params = params || {};
                params.diSessionId = id;

                return di(module, params);
            },

            /**
             * Run GC to destroy unknown dependencies
             */
            close: () => {
                _.forEach(definitions, (module) => {
                    let instance = module.instance;

                    if (module.diSessionId && module.diSessionId !== id && instance) {
                        if (instance.trigger) {
                            instance.trigger('di:destroy');
                        }

                        if (_.isFunction(instance.destroy)) {
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
    di.put = (inputDefinition, instance) => {
        let definition = normalizeModule(inputDefinition);
        definition.instance = instance;

        return this;
    };

    return di;
};

export {createContainer, webpackResolver, staticResolver, then, all, qCatch};
