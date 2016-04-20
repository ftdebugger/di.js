import {forEach} from 'lodash';

export function generateDot(di) {
    let lines = [];

    forEach(di.getDefinitions(), ({id, dependencies}) => {
        forEach(dependencies, (value, key) => {
            lines.push(`  ${id} -> ${value} [label="${key}"]`.replace(/\//g, '__'));
        });
    });

    return 'digraph G {\n' + lines.join('\n') + '\n}';
}