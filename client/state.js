import { Sequelize, DataTypes } from 'sequelize';
import dotenv from 'dotenv';
import pino from 'pino';
import * as baileys from 'baileys';
const { initAuthCreds, proto } = baileys;
dotenv.config();

const logger = pino({ level: 'silent' });

const DATABASE_URL = process.env.DATABASE_URL || './auth/database.db';
const DATABASE =
	DATABASE_URL === './auth/database.db'
		? new Sequelize({
				dialect: 'sqlite',
				storage: DATABASE_URL,
				logging: console.log, // Enable logging for debugging
		  })
		: new Sequelize(DATABASE_URL, {
				dialect: 'postgres',
				ssl: true,
				protocol: 'postgres',
				dialectOptions: {
					native: true,
					ssl: { require: true, rejectUnauthorized: false },
				},
				logging: console.log, // Enable logging for debugging
		  });

const defaultLogger = pino({ level: 'silent' });

const profile = async (name, fn, logger = defaultLogger) => {
	const start = performance.now();
	const result = await fn();
	logger.debug(`${name} took ${(performance.now() - start).toFixed(2)} ms`);
	return result;
};

const bufferToJSON = obj => {
	if (Buffer.isBuffer(obj)) {
		return { type: 'Buffer', data: Array.from(obj) };
	}
	if (Array.isArray(obj)) {
		return obj.map(bufferToJSON);
	}
	if (obj && typeof obj === 'object') {
		if (typeof obj.toJSON === 'function') {
			return obj.toJSON();
		}
		const result = {};
		for (const key in obj) {
			if (obj.hasOwnProperty(key)) {
				result[key] = bufferToJSON(obj[key]);
			}
		}
		return result;
	}
	return obj;
};

const jsonToBuffer = obj => {
	if (obj && obj.type === 'Buffer' && Array.isArray(obj.data)) {
		return Buffer.from(obj.data);
	}
	if (Array.isArray(obj)) {
		return obj.map(jsonToBuffer);
	}
	if (obj && typeof obj === 'object') {
		const result = {};
		for (const key in obj) {
			if (obj.hasOwnProperty(key)) {
				result[key] = jsonToBuffer(obj[key]);
			}
		}
		return result;
	}
	return obj;
};

export default async function useSQLiteAuthState(sessionId) {
	// Define the AuthStateModel for storing session data
	const AuthStateModel = DATABASE.define(
		'AuthState',
		{
			session_id: {
				type: DataTypes.STRING,
				primaryKey: true,
			},
			data_key: {
				type: DataTypes.STRING,
				primaryKey: true,
			},
			data_value: DataTypes.TEXT,
		},
		{
			tableName: 'session',
			timestamps: false,
		},
	);

	// Synchronize the database to create the database file and table if they don't exist
	await DATABASE.sync();

	// Define data reading and writing functions for session management
	const writeData = async (key, data) => {
		const serialized = JSON.stringify(bufferToJSON(data));
		await AuthStateModel.upsert({ session_id: sessionId, data_key: key, data_value: serialized });
	};

	const readData = async key => {
		const row = await AuthStateModel.findOne({ where: { session_id: sessionId, data_key: key } });
		return row?.data_value ? jsonToBuffer(JSON.parse(row.data_value)) : null;
	};

	const creds = (await profile('readCreds', () => readData('auth_creds'), logger)) || initAuthCreds();

	const state = {
		creds,
		keys: {
			get: async (type, ids) => {
				return profile(
					'keys.get',
					async () => {
						const data = {};
						const rows = await AuthStateModel.findAll({
							where: {
								session_id: sessionId,
								data_key: ids.map(id => `${type}-${id}`),
							},
						});
						rows.forEach(row => {
							const id = row.data_key.split('-')[1];
							let value = jsonToBuffer(JSON.parse(row.data_value));
							if (type === 'app-state-sync-key') {
								value = proto.Message.AppStateSyncKeyData.fromObject(value);
							}
							data[id] = value;
						});
						return data;
					},
					logger,
				);
			},
			set: async data => {
				return profile(
					'keys.set',
					async () => {
						const insert = [];
						const deleteKeys = [];
						for (const [category, categoryData] of Object.entries(data)) {
							for (const [id, value] of Object.entries(categoryData || {})) {
								const key = `${category}-${id}`;
								if (value) {
									const serialized = JSON.stringify(bufferToJSON(value));
									insert.push({ session_id: sessionId, data_key: key, data_value: serialized });
								} else {
									deleteKeys.push(key);
								}
							}
						}

						if (insert.length) {
							await AuthStateModel.bulkCreate(insert, { updateOnDuplicate: ['data_value'] });
						}

						if (deleteKeys.length) {
							await AuthStateModel.destroy({
								where: {
									session_id: sessionId,
									data_key: deleteKeys,
								},
							});
						}
					},
					logger,
				);
			},
		},
	};

	return {
		state,
		saveCreds: async () => {
			await profile('saveCreds', () => writeData('auth_creds', state.creds), logger);
		},
		deleteSession: async () => {
			await profile('deleteSession', () => AuthStateModel.destroy({ where: { session_id: sessionId } }), logger);
		},
	};
}

export { useSQLiteAuthState };
