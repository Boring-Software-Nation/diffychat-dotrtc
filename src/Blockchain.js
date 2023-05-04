import State from "states-manager";
import PoolHandlers from "pool-handlers";
import BinData from "./BinData.js";
import {ApiPromise, WsProvider} from '@polkadot/api';
import {cryptoWaitReady, encodeAddress, decodeAddress} from '@polkadot/util-crypto';

const enc = new TextEncoder();
const dec = new TextDecoder();

const Blockchain = class Blockchain {
	#srKeyring;				//sr25519 keyring of account
	#edKeyring;				//ed25519 keyring of account
	#readyState;			//Status of connection to blockchain
	#client;				//Blockchain connection
	#provider;				//Blockchain provider
	#handlersOnRequest;
	#handlersOnAnswer;

	/**
	 * @constructor
	 * @param cfg				{Object}
	 * @param cfg.edKeyring		{Object}
	 * @param cfg.srKeyring		{Object}
	 * @param cfg.endpoint		{string}		//Ws address of parachain node
	 */
	constructor(cfg) {
		this.#srKeyring = cfg.srKeyring;
		this.#edKeyring = cfg.edKeyring;
		this.#readyState = new State();
		this.#provider = new WsProvider(cfg.endpoint);
		this.#handlersOnRequest = new PoolHandlers();
		this.#handlersOnAnswer = new PoolHandlers();
		const api = ApiPromise.create({provider: this.#provider});

		cryptoWaitReady().then(() => {
			api.then(client => {
				this.#client = client;
				this.#client.query.system.events((events) => {
					events.forEach((record) => {
						const {event} = record;

						//catch offer event
						if (client.events.templateModule.Offer.is(event)) {
							//console.log('[Blockchain] catch offer: ', event.data);		//[offer, accountFrom(sr), accountTo(ed), msg]

							let accountFrom = encodeAddress(event.data[1]);
							let accountTo = encodeAddress(event.data[2]);

							if (accountTo === this.#edKeyring.address) {

								this.#client.query.templateModule.itemByAccountIdStore(decodeAddress(accountFrom)).then(value => {
									if (!value.isEmpty) {
										let addrU8a = new Uint8Array(value.address.buffer);

										const offerBin = new BinData(event.data[0].buffer);
										const ln = offerBin.getUint16();

										const cryptOfferU8A = new Uint8Array(offerBin.getBuffer(ln));
										const offerU8A = this.#edKeyring.decryptMessage(cryptOfferU8A, addrU8a);
										const offer = dec.decode(offerU8A);

										this.#handlersOnRequest.run({
											from: encodeAddress(addrU8a),
											offer: offer
										});
									}
								});
							}
						}

						//catch answer event
						if (client.events.templateModule.Answer.is(event)) {
							const accountFrom = encodeAddress(event.data[1]);
							const accountTo = encodeAddress(event.data[2]);
							if (accountTo === this.#edKeyring.address) {
								const offerBin = new BinData(event.data[0].buffer);
								const ln = offerBin.getUint16();
								const cryptOfferU8A = new Uint8Array(offerBin.getBuffer(ln));

								this.#client.query.templateModule.itemByAccountIdStore(decodeAddress(accountFrom)).then(value => {
									if (!value.isEmpty) {
										let addrU8a = new Uint8Array(value.address.buffer);

										const offerU8A = this.#edKeyring.decryptMessage(cryptOfferU8A, addrU8a);
										const offer = dec.decode(offerU8A);

										this.#handlersOnAnswer.run({
											from: encodeAddress(addrU8a),
											offer: offer
										});
									}
								});


							}
						}
					});
				});

				this.#readyState.ready();
			});
		});
	}

	getUsername(edAddr) {
		return new Promise(resolve => {
			this.#readyState.onReady(() => {
				console.log('edAddr:', edAddr);
				console.log('addrBin:', edAddr.publicKey);
				console.log('client:', this.#client.query.templateModule.itemByAccountIdStore);
				this.#client.query.templateModule.itemByAccountIdStore(edAddr.publicKey).then(value => {
					let username;
					if (!value.isEmpty) {
						let usernameU8a = new Uint8Array(value.nickname.buffer);
						const ln = usernameU8a[0];
						username = dec.decode(usernameU8a.slice(1, ln+1));

						console.log('value:', value);
						console.log('username:', username);
					}
					resolve(username);
				});
			});
		});
	}

	register(username, edAddr) {
		return new Promise(resolve => {
			console.log('[bch register]');
			this.#readyState.onReady(() => {
				console.log('edAddr:', edAddr);
				const usernameBin = new BinData(21);
				usernameBin.setUint8(username.length);
				usernameBin.setString(username);
				console.log('usernameBin:', usernameBin.uint8Array);
				console.log('addrBin:', edAddr.publicKey);
				this.#client.tx.templateModule.register(usernameBin.uint8Array, edAddr.publicKey).signAndSend(this.#srKeyring, ({
																																  events = [],
																																  status
																															  }) => {
					if (status.isInBlock) {
						//console.log('[offer] tx in block, hash: ', status.asInBlock.toHex());
						resolve();
					} else {
						//console.log('[answer] status of transaction', status.type);
					}
				});
			});
		});
	}

	getAddress(username) {
		return new Promise(resolve => {
			this.#readyState.onReady(() => {
				const usernameBin = new BinData(21);
				usernameBin.setUint8(username.length);
				usernameBin.setString(username);

				this.#client.query.templateModule.itemByNicknameStore(usernameBin.uint8Array).then(addr => {
					const addrBin = new Uint8Array(addr.buffer);
					const addrHex = encodeAddress(addrBin);
					resolve(addrHex);
				});
			});
		});
	}

	/**
	 * @method createOffer
	 * @description Send webrtc offer to blockchain
	 * @param cfg
	 * @param cfg.to			{String}	//to ed25519 address
	 * @param cfg.offer			{String}
	 * @param cfg.welcomeMsg	{String}
	 * @return Promise
	 *
	 */
	createOffer(cfg) {
		return new Promise(resolve => {
			this.#readyState.onReady(() => {
				//Sign and send offer
				const offerU8A = enc.encode(cfg.offer);
				let cryptOfferU8A = this.#edKeyring.encryptMessage(offerU8A, decodeAddress(cfg.to));

				const offerBin = new BinData(2048);
				offerBin.setUint16(cryptOfferU8A.byteLength);
				offerBin.setBuffer(cryptOfferU8A);

				const welcomeMsgBin = new BinData(300);
				welcomeMsgBin.setString(cfg.welcomeMsg);

				this.#client.tx.templateModule.offerChat(welcomeMsgBin.uint8Array, offerBin.uint8Array, cfg.to).signAndSend(this.#srKeyring, ({
																																				events = [],
																																				status
																																			}) => {
					if (status.isInBlock) {
						//console.log('[offer] tx in block, hash: ', status.asInBlock.toHex());
						resolve();
					} else {
						//console.log('[answer] status of transaction', status.type);
					}
				});
			});
		});
	}

	/**
	 * @description Push answer to blockchain
	 * @param cfg			{Object}
	 * @param cfg.to		{String}		//to ed25519 address
	 * @param cfg.offer		{String}
	 */
	createAnswer(cfg) {
		return new Promise(resolve => {
			this.#readyState.onReady(() => {
				const answerBin = new BinData(2048);
				const offerU8A = enc.encode(cfg.offer);

				const cryptOfferU8A = this.#edKeyring.encryptMessage(offerU8A, decodeAddress(cfg.to));

				answerBin.setUint16(cryptOfferU8A.byteLength);
				answerBin.setBuffer(cryptOfferU8A);
				//console.log('[Blockchain] push answer:', answerBin);

				this.#client.tx.templateModule.answerChat(answerBin.uint8Array, cfg.to).signAndSend(this.#srKeyring, ({
																														events = [],
																														status
																													}) => {
					if (status.isInBlock) {
						//console.log('tx in block, hash: ', status.asInBlock.toHex());
						resolve();
					} else {
						//console.log('status of transaction', status.type);
					}
				});
			});
		});
	}

	/**
	 * @method onRequestOffer
	 * @description Catch event on webrtc offer request from blockchain
	 * @param handler
	 */
	onOffer(handler) {
		this.#handlersOnRequest.push(handler);
	}

	/**
	 * @method onAnswer
	 * @description Catch event on webrtc answer from blockchain
	 * @param handler
	 */
	onAnswer(handler) {
		this.#handlersOnAnswer.push(handler);
	}
};


export default Blockchain;
