import { mkdir } from 'node:fs/promises';

export async function mkauthdir() {
	try {
		const projectFolder = new URL('../auth/', import.meta.url);
		const createDir = await mkdir(projectFolder, { recursive: true });
		console.log(`session dir created!`);
		return createDir;
	} catch (err) {
		console.error(err.message);
	}
}
