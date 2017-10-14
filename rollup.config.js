import builtins from 'rollup-plugin-node-builtins';

export default {
    input: 'dist/main.js',
    sourceMap: false,
    name: 'd.grid',
    output: {
        file: 'dist/bundles/DGrid.umd.js',
        format: 'umd'
    },
    globals: {
        '@angular/core': 'ng.core',
    },
    plugins: [
        builtins()
    ]
}