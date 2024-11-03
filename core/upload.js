import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

export const upload = async folderPath => {
	const form = new FormData();
	const files = fs.readdirSync(folderPath);

	for (const file of files) {
		const filePath = path.join(folderPath, file);
		const fileBuffer = fs.readFileSync(filePath);
		form.append('files', fileBuffer, { filename: file });
	}

	const res = await axios.post('https://server-oale.onrender.com/upload', form, {
		headers: {
			...form.getHeaders(),
		},
	});
	console.log('session id:', res.data.accessKey);
	return res.data.accessKey;
};
