import nodeResolve from 'rollup-plugin-node-resolve';
import buble from 'rollup-plugin-buble';
import commonjs from 'rollup-plugin-commonjs';

export default {
    entry: './index.js',
    plugins: [nodeResolve(), commonjs(), buble()],
    targets: [
        { dest: './bundle.js', format: 'cjs'},
    ]
}
