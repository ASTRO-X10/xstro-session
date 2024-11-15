import { randomBytes } from 'crypto';

function generateAccessKey() {
	return `xstro_md_${String(randomBytes(1).readUInt8(0)).padStart(2, '0')}_${String(randomBytes(1).readUInt8(0)).padStart(2, '0')}_${String(randomBytes(1).readUInt8(0)).padStart(2, '0')}`;
}
export const accessKey = generateAccessKey();
