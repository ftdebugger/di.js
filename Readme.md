DI [![Build Status](https://travis-ci.org/ftdebugger/di.js.svg)](https://travis-ci.org/ftdebugger/di.js)
========================================================================================================

Install
-------

    npm install --save di.js
    
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
            
            // same behavior with promise-loader
            require.context('promise?global!./views/', true, /(Content).js$/),
        })
    ],
    dependencies: {}
});
```

Webpack tell, where modules are placed and resolver create map with name => path. As module name it will be use filename without
extension. This means, if your file has name `./states/SidebarState.js` you can get it with `di('SidebarState')`. Unique names required!

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

### Direct dependency declaration

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

### Parenting

All dependencies, factories and other properties will be copied from User to currentUser

```js
dependencies: {
    Dep1: "Dep2" // definitionId => parentDefinitionId
}

// convert to definition

{
    "id": "Dep1",
    "parentId": "Dep2",
    "bundleName": "Dep2", // Dep2 is not declared, so we use it as class name
    "factory": "factory", // Default factory is 'factory'
    "dependencies": {}
}

```

### Deep parenting with factory overriding

```js
dependencies: {
    User: {
        test: 'test'
    },
    currentUser: "User.factoryCurrentUser"
}

// convert to definition

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

// convert to definition

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

Update function call during sessions, for more information read sessions section

```js
{
    user: 'User.newFactory#newUpdate'
}

// convert to definition

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

// convert to definition

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

### Instance reuse, update only dependencies

It is usefull, when dependencies change, but instance must be the same. For example Layouts can accept different
views as dependencies, but must be the same to prevent re-render.

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

// convert to definition

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

Every definition will be create once and it instance will be used for all dependencies. It allow to create dependency graph.
If session mechanism is used, dependency can be destroyed via garbage collector. In this case it will be created when it needed again.

Sessions
--------

Session is mechanism to simplify dependency lifecycle. This DI container is designed to cover scenario, when application 
has only one entry point to dependency loading. It's sounds strange, but if we place this container into router and will fetch 
root dependency only in this place we can get very light and powerful garbage collection mechanism.
 
First of all API:

```js
import {createContainer} from 'di.js';

let di = createContainer(...);
let session = di.session(); // create new session

// During Dep1 loading instances from previous loading will be reused
// load dependency. Same signature as di()
session.load('Dep1'); 

// All not reused instances will be destroyed
// close session, run GC. 
session.close(); 
```

Well, some synthetic example of this point:

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

        profile: ['BaseLayout', {
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

When route change: fire event and new session opened. We load all dependencies and reuse existent. When render complete 
we destroy all instances, which was not used in this session. In this example if first home router was we create in container
`BaseLayout`, `BaseHeader`, `HomeContent` and `UserAuth`. When router change to 'profile' we additionally create `ProfileContent`
and pass it to existent `BaseLayout` which was created on previous route. When GC fired it clean `HomeContent`, because nobody
load it in this session.

Additionally you can pass `defaults` dependencies to session, which will be passed into every instance, which would be created
via container.

```
let session = di.session({someKey: 'some value'});
let user = session('User'); // To User factory will be passed {someKey: 'some value'} as dependency
```

For instances that live between session will be invoked `updateDependencies` method with updated dependencies of this module.
It call for each instances once in session.

Serialization
-------------

You could serialize current DI state to restore it in another place. It is no magic here. If you want to use this feature
you need to implement `serialize` instance method and `restore` static module method.

```js
let data = di.serialize();

let newDi = createContainer(...);
newDi.restore(data);
```

Module can be looks like

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
