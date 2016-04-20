import {expect} from 'chai';

import {generateDot} from '../graphviz';
import {createContainer} from '../index.js';

describe('graphviz', function () {
    it('work with simple container', function () {
        let di = createContainer({
            dependencies: {
                A: {
                    b: 'B'
                }
            }
        });

        expect(generateDot(di)).to.equal('digraph G {\n  A -> B [label="b"]\n}');
    });

    it('work with nestings', function () {
        let di = createContainer({
            dependencies: {
                A: {
                    b: ['B', {
                        c: 'C'
                    }]
                }
            }
        });

        expect(generateDot(di)).to.equal('digraph G {\n  A__b -> C [label="c"]\n  A -> A__b [label="b"]\n}');
    });
});