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
        // In this case, we create resolver from webpack require context. It can load all bundled modules
        webpackResolver([
            require.context('./ingredients', true, /\.js$/)
        ])
    ],
    dependencies: {
        // This is most simple usage, we define key "Salad" and specify dependencies
        // When dependencies will be resolved, hash with their instances will be passed into Salad constructor
        Salad: {
            pea: 'Pea',
            pickles: 'Pickles',
            Mayonnaise: 'Mayonnaise',
            chicken: 'boiledChicken',
            eggs: 'boiledEggs',
            potato: 'boiledPotato'
        },

        // boiledChicken will be created from Chicken module with boilFactory method. It must return chicken instance or
        // Promise, that will return instance. This is kind of Aliases. It can be very useful, to produce
        // the same class instances with different dependencies
        boiledChicken: 'Chicken.boilFactory',

        // You can specify dependencies for each factory
        'Chicken.boilFactory': {
            water: 'Water'
        },

        // Another aliasing. This syntax is to override dependencies. It will create Eggs instance with water dependency
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
di('Salad').then(asyncSalad => {
    
});

// If you don't want care about this you can use default way

Promise.resolve(di('Salad')).then(salad => {...});

// or helper from di.js package

then(di('Salad'), salad => {...});


```
