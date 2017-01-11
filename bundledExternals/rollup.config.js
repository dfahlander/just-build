import nodeResolve from 'rollup-plugin-node-resolve';
import buble from 'rollup-plugin-buble';

export default {
    entry: './index.js',
    plugins: [nodeResolve(), buble()],
    targets: [
        { dest: './bundle.js', format: 'cjs'},
    ]
}
