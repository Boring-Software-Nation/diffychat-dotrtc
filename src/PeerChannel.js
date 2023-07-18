import BinData from './BinData.js';

const PeerChannel = class PeerChannel {
	pc;
	remoteAddress;
	#onMessage;

	/**
	 * @constructor
	 * @param cfg					{Object}			//
	 * @param cfg.pc				{RTCPeerConnection}	// PeerConnection
	 * @param cfg.remoteAddress		{String}			// The address of the peer with which the connection is established
	 * @param cfg.channel			{RTCDataChannel}	// Existed RTC data channel
	 * @param onOpen				{Function=}			// Called when a port is opened
	 * @param onClose				{Function=}			// Called when a port is opened
	 */
	constructor(cfg, onOpen, onClose) {
		this.pc = cfg.pc;
		this.messages = {};
		this.messageId = 1;
		this.remoteAddress = cfg.remoteAddress;

		if (cfg.channel) {
			//console.log('[PeerChannel] use existed channel:', cfg.channel);
			this.channel = cfg.channel;
		} else {
			//console.log('[PeerChannel] pc:', this.pc);
			let dataChannelParams = {
				ordered: false
			};
			let label = "<system>";	//cfg.port;	//JSON.stringify({port: cfg.port});
			this.channel = this.pc.createDataChannel(label, dataChannelParams);
			this.channel.binaryType = 'arraybuffer';
			//console.log('[PeerChannel] create new channel:', this.channel);
		}

		//this.channel.onclose = (e) => console.log('[PeerChannel] dc has closed', e);
		this.channel.onerror = (e) => {
			console.log('[PeerChannel] dc has onerror', e, onClose);
			if (onClose) {
				onClose(this);
			}
		}
		this.channel.onopen = () => {
			//console.log('[PeerChannel] channel has opened');
			if (onOpen) {
				onOpen(this);
			}
		};
		this.channel.onmessage = e => {
			//console.warn('[Peer channel] receive msg:', e);
			(new Promise((next) => {
				if (e.data instanceof Blob) {
					e.data.arrayBuffer().then(data => {
						next(data);
					})
				} else {
					next(e.data);
				}
			})).then(data => {
				//console.warn('[Peer channel] receive data:', data);
				let frame = new BinData(data);
				let messageId = frame.getUint32();
				let blockNum = frame.getUint32();
				let blocksCount = frame.getUint32();
				let payload = frame.getBuffer();
				//console.log('%c[PeerChannel.in] receive frame, messageId:', 'background:cyan;color:black', messageId, 'frame:', frame);
				PeerChannelMessage.get({
					channel: this,
					id: messageId,
					blocksCount: blocksCount,
					onLoad: (msg) => {
						if (this.#onMessage) {
							this.#onMessage(msg);
						}
					}
				}).frameSet(blockNum, payload);
			});
		};
	}

	/**
	 * @description Close connection
	 */
	close() {
		this.channel.close();
	}

	/**
	 * @description Fires the handler when a new message is received from the peer
	 * @param handler
	 */
	onMessage(handler) {
		this.#onMessage = handler;
	}

	/**
	 * @description Breaks large messages into frames and sends to the peer
	 * @param message	{Uint8Array}
	 */
	sendMessage(message) {
		if (!(message instanceof Uint8Array)) {
			console.error('[PeerChannel] wrong messageType. Uint8Array required');
		}
		let binMsg = new BinData(message);
		let blocksCount = Math.ceil(binMsg.length() / PeerChannelMessage.FRAME_PAYLOAD_SIZE);
		let blockNum = 0;
		while (binMsg.notEnd) {
			let frameData = binMsg.getBuffer(PeerChannelMessage.FRAME_PAYLOAD_SIZE);
			let frame = new BinData(frameData.byteLength + 12);
			frame.setUint32(this.messageId);
			frame.setUint32(blockNum);
			frame.setUint32(blocksCount);
			frame.setBuffer(frameData);
			//console.log('[PeerChannel] send block:', blockNum, 'messageId:', this.messageId, 'data:', frameData);
			blockNum++;
			this.channel.send(new Uint8Array(frame.buffer));
		}

		this.messageId++;
	}
};


const PeerChannelMessage = class PeerChannelMessage {
	id;
	length;
	#blocksCount;
	#onLoad;

	/**
	 * @constructor
	 * @param cfg				{Object}
	 * @param cfg.blocksCount	{Number}
	 * @param cfg.id			{Number}
	 * @param cfg.channel		{PeerChannel}
	 * @param cfg.onLoad		{Function}
	 */
	constructor(cfg) {
		this.channel = cfg.channel;
		this.id = cfg.id;
		this.#blocksCount = cfg.blocksCount;
		this.#onLoad = cfg.onLoad;
		this.payload = new Uint8Array(cfg.blocksCount * PeerChannelMessage.FRAME_PAYLOAD_SIZE);
		this.required = cfg.blocksCount;
	}

	/**
	 * @description Sets the frame of the received message. If all message frames are loaded, then calls `onLoad` handler
	 * @param blockNum
	 * @param payload
	 */
	frameSet(blockNum, payload) {
		this.required--;
		let offset = blockNum * PeerChannelMessage.FRAME_PAYLOAD_SIZE;
		this.payload.set(new Uint8Array(payload), offset);
		if (blockNum + 1 === this.#blocksCount) {											// If this is the last block, then we cut the payload'a size to the current one
			this.length = (this.#blocksCount - 1) * PeerChannelMessage.FRAME_PAYLOAD_SIZE + payload.byteLength;
			this.payload = new Uint8Array(this.payload.buffer, 0, this.length);
		}
		if (!this.required) {
			this.#onLoad(this.payload);
		}
	}

	/**
	 * @description Returns a message object
	 * @param cfg	{Object}
	 * @return {PeerChannelMessage}
	 */
	static get(cfg) {
		let channelMessage = cfg.channel.messages[cfg.id];
		if (!channelMessage) {
			channelMessage = cfg.channel.messages[cfg.id] = new PeerChannelMessage(cfg);
		}
		return channelMessage;
	}

	static FRAME_PAYLOAD_SIZE = 16 * 1024;		//Size of frame
};

export default PeerChannel;
