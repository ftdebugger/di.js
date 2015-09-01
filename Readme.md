DI
==

Install
-------

    npm install --save ftdebugger/di.js
    
Usage
-----

For example we want to cook russian salad. We have all ingredients at `ingredients` directory:

```
ingredients
├──Salad.js
├──Pea.js
├──Pickles.js
├──Chicken.js
├──Mayonnaise.js
├──Eggs.js
└──Potato.js
```

```js

import {createContainer, webpackResolver, then} from 'di.js';

var di = createContainer({
    resolvers: [
        // Each dependency we will be automatically search via resolvers
        // You can write you own resolver, it just a function with one argument - name,
        // which will return module or Promise
        // In this case, we create resolver from webpack require context. It can load 
        // all bundled modules
        webpackResolver([
            require.context('./ingredients', true, /\.js$/)
        ])
    ],
    dependencies: {
        // This is most simple usage, we define key "Salad" and specify dependencies
        // When dependencies will be resolved, hash with their instances will be passed 
        // into Salad constructor
        Salad: {
            pea: 'Pea',
            pickles: 'Pickles',
            Mayonnaise: 'Mayonnaise',
            chicken: 'boiledChicken',
            eggs: 'boiledEggs',
            potato: 'boiledPotato'
        },

        // boiledChicken will be created from Chicken module with boilFactory method. 
        // It must return chicken instance or Promise, that will return instance. 
        // This is some kind of Aliases. It can be very useful, to produce
        // the same class instances with different dependencies
        boiledChicken: 'Chicken.boilFactory',

        // You can specify dependencies for each factory
        'Chicken.boilFactory': {
            water: 'Water'
        },

        // Another aliasing. This syntax is to override dependencies. It will create 
        // Eggs instance with water dependency
        boiledEggs: ['Eggs', {
            water: 'Water'
        }],

        // this syntax is to full module definition override. In fact you don't need it
        boiledPotato: [{
            bundleName: 'MyFavoritePotato',
            dependencies: {
                water: 'Water'
            }
        }]
    }
});

// If all dependencies is Sync, we get instance immediately 
let syncSalad = di('Salad');

// If we have some async dependencies, we get promise instead
di('Salad').then(asyncSalad => {...});

// If you don't want care about this you can use default way

Promise.resolve(di('Salad')).then(salad => {...});

// or helper from di.js package

then(di('Salad'), salad => {...});

```

Modules
-------

Module is CommonJS, AMD or ES6 module. Module themselves is not using as dependencies. Module instances are using.
When Module is loaded via resolver, we need to create instance. The process looks like step by step algorithm:

1. If module is ES6 (`_esModule` is defined) and class was exported as not default, container will extract first exported class (see examples below)
2. If module has factory method (`factory` by default), it will be invoked with dependencies as first arguments
3. If module has no factory method and it is function - invoke with `new` keyword. Create instance in other words.
4. If result of previous two steps looks like Promise, wait until it will be resolved. You can't use promise as dependency.
5. When instance is resolved, di try to invoke `updateDependencies` method with dependencies as arguments. If it not exists - ignore.

```js
// A.js
export default class MyClass() {} // good

// B.js
export class MyClass() {} // good too

// C.js
class A {}
class B {}

export {A, B}; // Bad! DI will fetch only A class

// D.js
class A {}
class B {}

export default { // Good!
    factoryA: deps => new A(deps),
    factoryB: deps => new B(deps),
};

```

Resolvers
---------

Resolver return module by it name or null if cannot find it. Resolver can be sync or async. All resolvers
will be invoked one-by-one. First resolver, which return module will win.

Resolver is just a function with one argument: module name. As result container want to get module or Promise

```js

let myFirstSyncResolver = (name) => {
    if (name === 'MyCommonJSModule') {
        return require('./MyCommonJSModule');
    }
};

let myFirstAsyncResolver = (name) => {
    if (name === 'MyAMDModule') {
        return new Promise(resolve => require(['./MyAMDModule'], resolve));
    }
};

```

We can use some resolver from the box

### staticResolver

with `staticResolver` you can specify key-value pairs of your modules. 

```js
import {createContainer, staticResolver} from 'di.js';

var di = createContainer({
    resolvers: [
        staticResolver({
            User: require('./model/User'),
            config: _ => require('./config.json') 
        })
    ],
    dependencies: {}
});
```

### webpackResolver

with `webpackResolver` you can resolve webpack context requires. It is very useful, when you lazy enough to specify it manually or 
want to split you application to bundles.


```js
import {createContainer, staticResolver} from 'di.js';

var di = createContainer({
    resolvers: [
        webpackResolver({
            // recursive find all files in `states` directory with name matched by regular expression
            require.context('./states/', true, /(State).js$/),
            
            // with bundle-loader you can activate AMD style require, which means auto bundle splitting in webpack
            require.context('bundle!./views/', true, /(Layout).js$/),
        })
    ],
    dependencies: {}
});
```

Webpack tell, where modules are placed and resolver create map with name => path. As module name it will be use filename without
extension. This means, if you file has name `./states/SidebarState.js` you can get it with `di('SidebarState')`. Unique names required!

Dependency definition
---------------------

You can specify dependencies in `dependencies` key of `createContainer` configuration. If your module has no dependencies, you don't need to declare it. 
Every item in `dependencies` key will be convert to `Definition`. It's looks like

```js
{
    "id": "uniqueModuleId",
    "bundleName": "myFavoriteBundle", // this property will be passed to resolvers
    "factory": "factory", // factory method
    "dependencies": {
        "dependencyName": "dependencyDefinitionId"
    }
}

```

As you can see it is not very simple. So I suggest to use some sugar:

1. Direct dependency declaration

```js
dependencies: {
    Dep1: {
        a: 'Dep2', // dependencyName => dependencyDefinitionId
        b: 'Dep3.factory' // dependencyName => dependencyDefinitionId.factory
    }
}

// convert to definition

{
    "id": "Dep1",
    "bundleName": "Dep1",
    "factory": "factory",
    "dependencies": {
        "a": "Dep2",
        "b": "Dep3.factory"
    }
}

```

2. Aliasing

```js
dependencies: {
    Dep1: "Dep2.produce" // dependencyName => dependencyDefinitionId.factory
}

// convert to definition

{
    "id": "Dep1",
    "bundleName": "Dep2", // <----
    "factory": "produce", // <----
    "dependencies": {}
}

```

3. Aliasing with dependency overriding

```js
dependencies: {
    Dep1: ["Dep2.produce", {
        "a": "Dep3.factory"
    }]
}

// convert to definition

{
    "id": "Dep1",
    "bundleName": "Dep2", // <----
    "factory": "produce", // <----
    "dependencies": {
        "a": "Dep3.factory" // <----
    }
}

```

4. Complete manual definition

```js
dependencies: {
    Dep1: [{
       "bundleName": "Dep2",
       "factory": "produce",
       "dependencies": {
           "a": "Dep3.factory"
       }
   }]
}
```

5. Unnamed dependencies on the fly

```js
dependencies: {
    Dep1: {
        a: ["b", {
            c: "c" 
        }]
    }
}

// convert to definition

{
    Dep1: {
        "id": "Dep1",
        "bundleName": "Dep1",
        "factory": "factory",
        "dependencies": {
            "a": "Dep1/a####"
        }
    },
    'Dep1/a####': {
        "id": "Dep1/a####",
        "bundleName": "b",
        "factory": "factory",
        "dependencies": {
            "c": "c"
        }
    }
}
```

Dependency lifecycle
--------------------

Every definition will be create once and it instance will be used for all dependencies. It allow to create dependency graph.
If session mechanism is used, dependency can be destroyed via garbage collector. In this case it will be created when it needed again.
