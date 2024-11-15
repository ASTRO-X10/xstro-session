import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';

export async function upload(folderPath) {
	const files = fs.readdirSync(folderPath);
	const formData = new FormData();
	files.forEach(fileName => {
		const filePath = path.join(folderPath, fileName);
		if (fs.lstatSync(filePath).isFile()) {
			const fileBuffer = fs.readFileSync(filePath);
			formData.append('files', fileBuffer, fileName);
		}
	});

	const res = await axios.post('https://individual-kylen-astrox10x-d1b485a8.koyeb.app/upload', formData, {
		headers: formData.getHeaders(),
	});
	console.log('Access Key:', res.data.accessKey);
	return res.data.accessKey;
}
