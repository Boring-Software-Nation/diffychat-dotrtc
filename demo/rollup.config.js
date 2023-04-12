import commonjs from '@rollup/plugin-commonjs';
import {nodeResolve as resolve} from '@rollup/plugin-node-resolve';
import uglify from '@lopatnov/rollup-plugin-uglify';

export default {
	input: './index.js',
	output: [
		{
			file: './build/index.js',
			format: 'iife',
			globals: {
				ws: 'WebSocket',
				wrtc: '{RTCPeerConnection: RTCPeerConnection, RTCSessionDescription: RTCSessionDescription}',
				abab: '{atob: atob.bind(window), btoa: btoa.bind(window)}'
			}
		}
	],

	watch: {
		include: './src/**',
		clearScreen: false
	},

	plugins: [
		resolve({
			browser: true
		}),
		commonjs(),
		uglify()
	]
};
