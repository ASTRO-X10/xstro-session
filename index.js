console.log('✅ Server Started...');

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { setupMaster, fork } from 'cluster';
import { watchFile, unwatchFile } from 'fs';
import { createInterface } from 'readline';
import yargs from 'yargs';
import { mkauthdir } from './client/utils.js';
mkauthdir();

const __dirname = dirname(fileURLToPath(import.meta.url));
const rl = createInterface(process.stdin, process.stdout);
let isRunning = false;

function start(file) {
	if (isRunning) return;
	isRunning = true;
	const args = [join(__dirname, file), ...process.argv.slice(2)];
	console.log(`Starting: ${args.join(' ')}`);

	setupMaster({ exec: args[0], args: args.slice(1) });
	const worker = fork();

	worker.on('message', data => {
		console.log('[RECEIVED]', data);
		if (data === 'reset') {
			worker.process.kill();
			isRunning = false;
			start(file);
		} else if (data === 'uptime') {
			worker.send(process.uptime());
		}
	});

	worker.on('exit', (_, code) => {
		isRunning = false;
		console.error('❎ An Error occurred:', code);
		if (code !== 0) {
			watchFile(args[0], () => {
				unwatchFile(args[0]);
				start(file);
			});
		}
	});

	const opts = yargs(process.argv.slice(2)).exitProcess(false).parse();
	if (!opts['test'] && !rl.listenerCount()) {
		rl.on('line', line => {
			worker.emit('message', line.trim());
		});
	}
}

start('pair.js');
