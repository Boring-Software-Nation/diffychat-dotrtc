import BinData from "../src/BinData.js";

/*
test('Peer, constructor', () => {
	let bin = new BinData(10);
	bin.setUint8(value);
	bin.init();
	const res = bin.getUint8();
	expect(res).toBe(value);
});
*/

test('BinData, setUint8/getUint8', () => {
	const value = 15;
	let bin = new BinData(10);
	bin.setUint8(value);
	bin.init();
	const res = bin.getUint8();
	expect(res).toBe(value);
});

test('BinData, setUint16/getUint16', () => {
	const value = 1245;
	let bin = new BinData(10);
	bin.setUint16(value);
	bin.init();
	const res = bin.getUint16();
	expect(res).toBe(value);
});

test('BinData, setUint32/getUint32', () => {
	const value = 65900;
	let bin = new BinData(10);
	bin.setUint32(value);
	bin.init();
	const res = bin.getUint32();
	expect(res).toBe(value);
});

/*
test('BinData, setFloat32/getFloat32', () => {
	const value = 15.62;
	let bin = new BinData(20);
	bin.setFloat32(value);
	bin.init();
	const res = bin.getFloat32();
	console.log(bin);
	expect(res).toBe(value);
});
*/

test('BinData, getBuffer/setBuffer', () => {
	const value = new Uint8Array([5,6,7]).buffer;
	let bin = new BinData(20);
	bin.setBuffer(value);
	bin.init();
	const res = bin.getBuffer(3);
	expect(JSON.stringify(Array.from(new Uint8Array(value)))).toBe(JSON.stringify(Array.from(new Uint8Array(res))));
});

test('BinData, getString/getString', () => {
	const value = "hello";
	let bin = new BinData(20);
	bin.setString(value);
	bin.init();
	const res = bin.getString(5);
	expect(value).toBe(res);
});