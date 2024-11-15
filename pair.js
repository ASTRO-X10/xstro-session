import { Boom } from '@hapi/boom';
import Baileys, { DisconnectReason, delay, Browsers, makeCacheableSignalKeyStore, useMultiFileAuthState } from 'baileys';
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path, { dirname } from 'path';
import pino from 'pino';
import { fileURLToPath } from 'url';
import { upload } from './upload.js';

const app = express();

const deleteFolder = folderPath =>
	fs.existsSync(folderPath) &&
	fs.readdirSync(folderPath).forEach(file => {
		const currentPath = path.join(folderPath, file);
		fs.lstatSync(currentPath).isDirectory() ? deleteFolder(currentPath) : fs.unlinkSync(currentPath);
	}) &&
	fs.rmdirSync(folderPath);

app.use((req, res, next) => {
	res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

	res.setHeader('Pragma', 'no-cache');

	res.setHeader('Expires', '0');
	next();
});

app.use(cors());

let PORT = process.env.PORT || 8000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let sessionFolder = `./auth/`;

let clearState = () => {
	fs.rmdirSync(sessionFolder, { recursive: true });
};

app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

app.get('/pair', async (req, res) => {
	let phone = req.query.phone;

	if (!phone) return res.json({ error: 'Please Provide Phone Number' });

	try {
		const code = await startAuth(phone);
		res.json({ code: code });
	} catch (error) {
		console.error('Error in WhatsApp authentication:', error);
		res.status(500).json({ error: 'Internal Server Error' });
	}
});

async function startAuth(phone) {
	return new Promise(async (resolve, reject) => {
		try {
			if (!fs.existsSync(sessionFolder)) {
				await fs.mkdirSync(sessionFolder);
			}

			const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);

			const sock = Baileys.makeWASocket({
				version: [2, 3000, 1015901307],
				printQRInTerminal: false,
				logger: pino({
					level: 'silent',
				}),
				browser: Browsers.ubuntu('Chrome'),
				auth: {
					creds: state.creds,
					keys: makeCacheableSignalKeyStore(
						state.keys,
						pino().child({
							level: 'fatal',
							stream: 'store',
						}),
					),
				},
			});

			if (!sock.authState.creds.registered) {
				let phoneNumber = phone ? phone.replace(/[^0-9]/g, '') : '';
				if (phoneNumber.length < 11) {
					return reject(new Error(' Enter Your Number'));
				}
				setTimeout(async () => {
					try {
						let code = await sock.requestPairingCode(phoneNumber);
						console.log(`Your Pairing Code : ${code}`);
						resolve(code);
					} catch (requestPairingCodeError) {
						const errorMessage = 'Error requesting pairing code from WhatsApp';
						console.error(errorMessage, requestPairingCodeError);
						return reject(new Error(errorMessage));
					}
				}, 3000);
			}

			sock.ev.on('creds.update', saveCreds);

			sock.ev.on('connection.update', async update => {
				const { connection, lastDisconnect } = update;

				if (connection === 'open') {
					await delay(10000);
					const sessionId = await upload(sessionFolder);
					let msg = await sock.sendMessage(sock.user.id, { text: sessionId });
					await delay(2000);
					await sock.sendMessage(
						sock.user.id,
						{
							text: 'ᴘᴀɪʀ sᴜᴄᴄᴇss\nxsᴛʀᴏ ᴍᴅ ɪs ᴀ sɪᴍᴘʟᴇ ᴡʜᴀᴛsᴀᴘᴘ ʙᴏᴛ ᴀʙʏ ᴀsᴛʀᴏ-x𝟷𝟶\n*ᴄʟɪᴄᴋ ᴛʜᴇ ʙᴜᴛᴛᴏɴ ʙᴇʟᴏᴡ ᴛᴏ ᴊᴏɪɴ ᴏᴜʀ ᴄʜᴀɴɴᴇʟ ғᴏʀ ʟᴀᴛᴇsᴛ ᴜᴘᴅᴀᴛᴇ ᴀɴᴅ sᴜᴘᴘᴏʀᴛ*\n*ᴛʜɪs ɪs ᴛʜᴇ ʙᴇɢɪɴɴɪɴɢ ᴏғ ʏᴏᴜʀ ʟᴇɢᴇɴᴅᴀʀʏ xsᴛʀᴏ ᴅᴇᴘʟᴏʏᴍᴇɴᴛ*',
							contextInfo: { forwardingScore: 999, isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: '120363347500446894@newsletter', newsletterName: `sᴇssɪᴏɴ ɪᴅ` } },
						},
						{ quoted: msg },
					);
					console.log('Connected to WhatsApp Servers');
					await deleteFolder('./auth');
					process.send('reset');
				}

				if (connection === 'close') {
					let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
					console.log('Connection Closed:', reason);
					if (reason === DisconnectReason.connectionClosed) {
						console.log('[Connection closed, reconnecting....!]');
						process.send('reset');
					} else if (reason === DisconnectReason.connectionLost) {
						console.log('[Connection Lost from Server, reconnecting....!]');
						process.send('reset');
					} else if (reason === DisconnectReason.loggedOut) {
						clearState();
						console.log('[Device Logged Out, Please Try to Login Again....!]');
						process.send('reset');
					} else if (reason === DisconnectReason.restartRequired) {
						console.log('[Server Restarting....!]');
						startAuth();
					} else if (reason === DisconnectReason.timedOut) {
						console.log('[Connection Timed Out, Trying to Reconnect....!]');
						process.send('reset');
					} else if (reason === DisconnectReason.badSession) {
						console.log('[BadSession exists, Trying to Reconnect....!]');
						clearState();
						process.send('reset');
					} else if (reason === DisconnectReason.connectionReplaced) {
						console.log(`[Connection Replaced, Trying to Reconnect....!]`);
						process.send('reset');
					} else {
						console.log('[Server Disconnected: Maybe Your WhatsApp Account got Fucked....!]');
						process.send('reset');
					}
				}
			});
			sock.ev.on('messages.upsert', () => {});
		} catch (error) {
			console.error('An Error Occurred:', error);
			throw new Error('An Error Occurred');
		}
	});
}

app.listen(PORT, () => {
	console.log(`API Running on PORT:${PORT}`);
});
