import { NextRequest, NextResponse } from "next/server";
import { HubYoung } from 'hub-young-downloader';
import { uploadBook } from "@/lib/storage";
import * as crypto from "node:crypto"
import { pool } from "@/lib/db";
import { env } from "node:process";

export const dynamic = 'force-dynamic'

const password = env.CRYPTO_PSW || "";
const salt = env.CRYPTO_SALT || "";
const key = crypto.scryptSync(password, salt, 24);

const headers = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

const decrypt = (encryptedObj: {encrypted: string, iv: string}) => new Promise<string>((resolve, reject) => {
	const algorithm = 'aes-192-cbc';
	const { encrypted, iv } = encryptedObj;
	const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'));
	let decrypted = decipher.update(encrypted, 'hex', 'utf8');
	decrypted += decipher.final('utf8');
	resolve(decrypted);
});

const loginHubYoung = async () => {
	const res = await pool.one("SELECT * FROM platform_credentials WHERE account_id = $1 AND platform_name = $2", ["bellofigogu", "hubyoung"]);

	let decrypted_password = await decrypt(res.encrypted_password);

	let obj = new HubYoung();

	try {
		await obj.login(res.platform_username, decrypted_password);
		return obj;
	} catch (error: any) {
		// return NextResponse.json({message: error.message}, { status: 404, headers });
		return error;
	}
}

export async function GET() {
	const hy = await loginHubYoung();

	let books = await hy.getBooks();

	return NextResponse.json({books}, { status: 200, headers });
}

export async function POST(request: NextRequest) {
	const data = await request.json();

	const hy = await loginHubYoung();
	await hy.getBooks();
	await hy.download(data.bookId);

	await uploadBook(`./${data.bookName}.pdf`, data.bookName, data.thumbnail);

	return NextResponse.json({ messaggio: "damn" }, { status: 200, headers });
}