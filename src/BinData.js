const BinData = class {
	/**
	 * @param param	{Number|ArrayBuffer|Uint8Array}
	 */
	constructor(param) {
		if (typeof param === 'number') {
			this.buffer = new ArrayBuffer(param);
		} else if (param instanceof ArrayBuffer) {
			this.buffer = param;
		} else if (param instanceof Uint8Array) {
			this.uint8Array = param;
			this.buffer = param.buffer;
		} else {
			this.buffer = new ArrayBuffer(100);
		}
		this.bufferView = new DataView(this.buffer);
		if (!this.uint8Array) {
			this.uint8Array = new Uint8Array(this.buffer);
		}
		this.offset = 0;
		//console.log('BinData:', this);
	}

	length() {
		return this.uint8Array.length;
	}

	/**getters*/
	getUint8() {
		let value = this.bufferView.getUint8(this.offset);
		this.offset++;
		return value;
	}

	getUint16() {
		let value = this.bufferView.getUint16(this.offset);
		this.offset += 2;
		return value;
	}

	getUint32() {
		let value = this.bufferView.getUint32(this.offset);
		this.offset += 4;
		return value;
	}

	getFloat32() {
		let value = this.bufferView.getFloat32(this.offset);
		this.offset += 4;
		return value;
	}

	getFloat64() {
		let value = this.bufferView.getFloat64(this.offset);
		this.offset += 8;
		return value;
	}

	getDate() {
		let value = this.bufferView.getFloat64(this.offset);
		this.offset += 8;
		return new Date(value);
	}

	getString(length) {
		if (length === undefined) {
			length = this.buffer.byteLength - this.offset;
		}
		const dec = new TextDecoder();
		let value = dec.decode(this.buffer.slice(this.offset, this.offset + length));
		this.offset += length;
		return value;
	}

	getBuffer(length) {
		if (length === undefined) {
			length = this.buffer.byteLength - this.offset;
		} else if ((this.offset + length) > this.length()) {
			length = this.length() - this.offset;
		}

		let value = this.buffer.slice(this.offset, this.offset + length);
		this.offset += length;
		//console.log('[getBuffer] length:', length, 'offset:', this.offset, 'byteLength:', this.buffer.byteLength);
		return value;
	}

	getUint8Array(length) {
		if (length === undefined) {
			length = this.buffer.byteLength - this.offset;
		}
		let value = this.buffer.slice(this.offset, this.offset + length);
		this.offset += length;
		return new Uint8Array(value);
	}

	init() {
		this.offset = 0;
	}

	skip(length) {
		this.offset += length;
	}

	get notEnd() {
		return this.offset < this.length();
	}

	/**setters*/
	setUint8(value, offset) {
		this.bufferView.setUint8(offset !== undefined ? offset : this.offset, value);
		this.offset++;
		return value;
	}

	setUint16(value, offset) {
		this.bufferView.setUint16(offset !== undefined ? offset : this.offset, value);
		this.offset += 2;
		return value;
	}

	setUint32(value, offset) {
		this.bufferView.setUint32(offset !== undefined ? offset : this.offset, value);
		this.offset += 4;
		return value;
	}

	setInt32(value, offset) {
		this.bufferView.setInt32(offset !== undefined ? offset : this.offset, value);
		this.offset += 4;
		return value;
	}

	setFloat32(value, offset) {
		this.bufferView.setUint32(offset !== undefined ? offset : this.offset, value);
		this.offset += 4;
		return value;
	}

	setString(value, offset) {
		const enc = new TextEncoder();
		this.uint8Array.set(enc.encode(value), offset !== undefined ? offset : this.offset);
		this.offset += value.length;
	}

	setBuffer(value, offset) {
		if (value instanceof ArrayBuffer) {
			value = new Uint8Array(value);
		}
		//console.log('offset:', offset !== undefined ? offset : this.offset);
		this.uint8Array.set(value, offset !== undefined ? offset : this.offset);
		this.offset += value.byteLength;
		//console.log('setBuffer:', this.uint8Array, 'value:', value);
	}

	get value() {
		return this.buffer;
	}
}

export default BinData;
