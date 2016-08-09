DI [![Build Status](https://travis-ci.org/ftdebugger/di.js.svg)](https://travis-ci.org/ftdebugger/di.js)
========================================================================================================

Install
-------

    npm install --save di.js
    
Usage
-----

Lets imagine we want to cook russian salad.

All ingredients are in `ingredients` directory:

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
        // Each dependency is resolved via resolvers.
        // You can write you own resolver: it just a function which takes one argument - name
        // and returns module or Promise.<module>.
        //
        // Here we are creating resolver from webpack's require.context. 
        // It will resolve all bundled modules
        webpackResolver([
            require.context('./ingredients', true, /\.js$/)
        ])
    ],
    dependencies: {
        // This is the most simple usage: we are defining key `Salad` and specify dependencies.
        // When all dependencies will be resolved, a map with their instances will be passed 
        // into `Salad` constructor.
        Salad: {
            pea: 'Pea',
            pickles: 'Pickles',
            Mayonnaise: 'Mayonnaise',
            chicken: 'boiledChicken',
            eggs: 'boiledEggs',
            potato: 'boiledPotato'
        },

        // `boiledChicken` will be created from the Chicken module by `boilFactory` method. 
        // This method should return chicken instance or Promise.<instance>. 
        // This is a sort of Aliases. Aliasing can be very useful for constructing
        // same class instances with different dependencies.
        boiledChicken: 'Chicken.boilFactory',

        // This is one more way of aliasing. The definition means that `boiledEggs` 
        // is instance of `Eggs` which depends on all of `Eggs` dependencies as well 
        // as on `water` dependency.
        boiledEggs: ['Eggs', {
            water: 'Water'
        }],

        // This is a full definition syntax. In fact it is too verbose and you 
        // unlikely will need it.
        boiledPotato: [{
            bundleName: 'MyFavoritePotato',
            dependencies: {
                water: 'Water'
            }
        }]
    }
});

// If all dependencies can be resolved synchronously, then we will 
// get the instance synchronously too.
let syncSalad = di('Salad');

// If there are some asynchronous dependencies, we will get promise instead
di('Salad').then(asyncSalad => {...});

// If you don't want to care about it, you could use Promise
Promise.resolve(di('Salad')).then(salad => {...});

// or `then` helper from di.js package (more effective than Promise)
then(di('Salad'), salad => {...});

```

Modules
-------

Module stands for a CommonJS, AMD or ES6 module. Modules themselves cannot be used as dependencies, but module's instances can do.
After Module is resolved via resolver, it should be instantiated. The process looks like step by step algorithm:

1. If module is ES6 (`__esModule` is defined) and there is no `default` object export then container will extract first exported class (see examples below).
2. If module has factory method (`factory` by default), it will be invoked with dependencies as first argument.
3. If module is a function and doesn't have factory method it will be invoked with `new` keyword with dependencies as first argument. In other words an instance will be created.
4. If previous two steps will result into `thenable` (e.g. Promise), it will wait for this Promise to resolve. Notice, that you can't use promise as a dependency.
5. When instance is being resolved, di tries to invoke update method if it exists(`updateDependencies` by default) with dependencies as first argument.

```js
// A.js
export default class MyClass() {} // good

// B.js
export class MyClass() {} // nice

// C.js
class A {}
class B {}

export {A, B}; // bad! DI will extract only `class A`

// D.js
class A {}
class B {}

export default { // awesome!
    factoryA: deps => new A(deps),
    factoryB: deps => new B(deps),
};

```

Resolvers
---------

Resolver is simply a function, which takes name as its argument and returns Module (or Promise.&lt;Module&gt;) if it can resolve given name, or null (or Promise.&lt;null&gt;) if it doesn't.
All resolvers which are passed to `di.createContainer` method are invoked consequentially. First resolver which returns Module wins.

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

There are some useful resolvers out of the box.

### staticResolver

`staticResolver` is constructed with `key`-`value` pairs of your Modules and will then resolve Modules by `key`. 

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

`webpackResolver` is constructed with webpack's require.context objects and then will resolve all bundled Modules. It is very useful, when you are lazy enough to specify Modules manually or you want to split your application into bundles.

```js
import {createContainer, staticResolver} from 'di.js';

var di = createContainer({
    resolvers: [
        webpackResolver({
            // recursively finds all files in `states` directory with a name 
            // matched by regular expression
            require.context('./states/', true, /(State).js$/),
            
            // with bundle-loader you can activate AMD require style, which means 
            // automatic bundle splitting with webpack
            require.context('bundle!./views/', true, /(Layout).js$/),
            
            // same behavior with promise-loader
            require.context('promise?global!./views/', true, /(Content).js$/),
        })
    ],
    dependencies: {}
});
```

Webpack gives us information about where modules are placed and webpackResolver creates map with `name` - `path` pairs. Filename without extension will be used as a Module name. It means that file `./states/SidebarState.js` can be required from di as `di('SidebarState')`. But keep your eyes open: unique names are required!

Dependency definition
---------------------

You can specify dependencies in `dependencies` key of the `createContainer` configuration. If your module has no dependencies, there is no need to declare them. 
Each item in the `dependencies` map will be converted to the `Definition`. It looks like this:

```js
{
    "id": "uniqueModuleId",
    "bundleName": "myFavoriteBundle", // this property will be passed to resolvers
    "factory": "factory", // factory method name
    "update": "updateDependencies", // update method name
    "dependencies": {
        "dependencyName": "dependencyDefinitionId"
    }
}

```

As you can see it's not so simple and too verbose, but you can use some sugar:

### Direct dependency declaration

```js
dependencies: {
    Dep1: {
        a: 'Dep2', // dependencyName => dependencyDefinitionId
        b: 'Dep3.factory' // dependencyName => dependencyDefinitionId.factory
    }
}

// converts to definition

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

### Parenting

```js
dependencies: {
    Dep1: "Dep2" // definitionId => parentDefinitionId
}

// converts to definition

{
    "id": "Dep1",
    "parentId": "Dep2",
    "bundleName": "Dep2", // Dep2 is not declared, so we use it as class name
    "factory": "factory", // Default factory is 'factory'
    "dependencies": {}
}

```

### Deep parenting with factory overriding

All dependencies, factories and other properties will be copied from the User to the currentUser

```js
dependencies: {
    User: {
        test: 'test'
    },
    currentUser: "User.factoryCurrentUser"
}

// converts to definition

{
    User: {
        "id": "User",
        "parentId": "User",
        "bundleName": "User",
        "factory": "factory", // Default factory is 'factory'
        "dependencies": {
            "test": "test"
        }
    },
    currentUser: {
        "id": "currentUser",
        "parentId": "User",
        "bundleName": "User",
        "factory": "factoryCurrentUser", // Factory was overriden
        "dependencies": {
            "test": "test"
        }
    },
    //..
}

```

### Deep parenting with dependency overriding

```js
dependencies: {
    User: {
        test: 'test'
    },
    currentUser: ['User.factoryCurrentUser', {
        test2: 'test2'
    }]
}

// converts to definition

{
    User: {
        "id": "User",
        "parentId": "User",
        "bundleName": "User",
        "factory": "factory", // Default factory is 'factory'
        "dependencies": {
            "test": "test"
        }
    },
    currentUser: {
        "id": "currentUser",
        "parentId": "User",
        "bundleName": "User",
        "factory": "factoryCurrentUser", // Factory was overriden
        "dependencies": {
            "test": "test",  // parent dependency
            "test2": "test2" // new dependency
        }
    },
    //..
}
```

### Update function declaration

Update function are invoked during sessions. For more information refer to the sessions section

```js
{
    user: 'User.newFactory#newUpdate'
}

// converts to definition

{
    User: {
        "id": "User",
        "parentId": "User",
        "bundleName": "User",
        "factory": "factory", // Default factory is 'factory'
        "update": "updateDependencies", // Default update function
        "dependencies": {}
    },
    currentUser: {
        "id": "currentUser",
        "parentId": "User",
        "bundleName": "User",
        "factory": "newFactory", // Factory was overriden
        "update": "newUpdate",   // Update function was overriden
        "dependencies": {}
    },
    //..
}
```

### Complete manual definition

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

### Unnamed dependencies on the fly

```js
dependencies: {
    Dep1: {
        a: ["b", {
            c: "c" 
        }]
    }
}

// converts to definition

{
    Dep1: {
        "id": "Dep1",
        "bundleName": "Dep1",
        "factory": "factory",
        "dependencies": {
            "a": "Dep1/a"
        }
    },
    'Dep1/a': {
        "id": "Dep1/a",
        "bundleName": "b",
        "factory": "factory",
        "dependencies": {
            "c": "c"
        }
    }
}
```

### Instance reuse

Instance reusing is useful, when dependencies are changing, but the instance should stay the same. For example Layouts can accept different views as dependencies, but should always stay the same to prevent rerendering.
With instance reusing di will use created instance of reused Module if it exists and will update only dependencies.

```js
dependencies: {
    basePage: ['BasePage', {
        header: 'BaseHeader'
    }],

    homePage: ['!basePage', {
        section: 'BaseSection'
    }],

    profilePage: ['!basePage', {
        section: 'ProfileSection'
    }]
}

// converts to definition

{
    basePage: {
        id: 'basePage',
        bundleName: 'BasePage',
        dependencies: {
            header: 'BaseHeader'
        }
    },

    homePage: {
        id: 'homePage',
        dependencies: {
            header: 'BaseHeader',
            section: 'BaseSection'
        },
        reuse: 'basePage'
    },

    profilePage: {
        id: 'profilePage',
        dependencies: {
            header: 'BaseHeader',
            section: 'ProfileSection'
        },
        reuse: 'basePage'
    }
}

```

Dependency lifecycle
--------------------

Every definition is created once and its instance will be used for all dependencies. Definition allows to create dependencies graph.
If session mechanism is used, dependency can be destroyed via garbage collector. In this case it will be created when it will be needed again.

Sessions
--------

Session is a mechanism to simplify dependency lifecycle. This DI container is designed to cover scenario, when application 
has only one entry point for dependency loading. It could soundd strange, but if we place such a DI container into a router and will fetch the root dependency only in this place we can get a very pure and powerful garbage collection mechanism.
 
Let's have look at API:

```js
import {createContainer} from 'di.js';

let di = createContainer(...);
let session = di.session(); // creates new session

// During `Dep1` loading instances from previous loading will be reused.
// Loads `Dep 1`. Same signature as di()
session.load('Dep1'); 

// All not reused instances will be destroyed.
// Closes session, runs GC. 
session.close(); 
```

Well, some syntactic example of this point:

```js
import {createContainer, webpackResolver, then} from 'di.js';
import {router} from './router'; // some router

let di = createContainer({
    resolvers: [...],
    dependencies: {
        home: ['BaseLayout', {
            header: 'BaseHeader',
            content: 'HomeContent'
        }],

        profile: ['!home', {
            header: 'BaseHeader',
            content: 'ProfileContent'
        }],
        
        BaseHeader: {
            model: 'UserAuth'
        }
    }
});

router.on(routeName => {
    let session = di.session();

    then(session(routeName), (layout) => {
        // Backbone.View for example
        layout.render();
        
        layout.$el.appendTo('body');
        
        session.close(); // run GC
    });
});
```

When route changes it fires an event and new session is opened. We load all dependencies and reuse existent. When all dependencies are loaded and layouts are rendered we close the session and thus destroy all instances, which were not used in the new session.
Take for example there was `home` route initially on the page. It depends on `BaseLayout`, `BaseHeader`, `HomeContent` and `UserAuth`. Once route becomes `profile` route, we load all of its dependencies and by closing session we destroy outdated dependencies. Hereby we load `ProfileContent` Module and pass it to the existing `BaseLayout` Module and also destroy `HomeContent` Module since nobody requires it in the new session. Notice, that `BaseLayout` Module remains the same through sessions since it is reused by `profile` route.

Additionally you can pass `default` dependencies to the session, which will be passed into every instance, which would be created or updated via the DI container.

```
let session = di.session({someKey: 'some value'});
let user = session('User'); // User module will be instantiated with {someKey: 'some value'} as dependencies
```

When instances are created for the first time or they were created in the previous session and someone requires them in the new session then update method will be invoked with new dependencies of the module.
It call for each instances once in session.

Serialization
-------------

You could serialize current DI state to restore it later. There is no magic: if you want to use this feature
you need to implement `serialize` instance method and `restore` static module method.

```js
let data = di.serialize();

let newDi = createContainer(...);
newDi.restore(data);
```

Module can look like this:

```js
export class User {

    constructor(data) {
        this.data = data;
    }

    serialize() {
        return this.data; // Promise are supported too
    }
    
    static restore(data) {
        return new this(data);
    }

}
```
