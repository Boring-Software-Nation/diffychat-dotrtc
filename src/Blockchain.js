import State from "states-manager";
import PoolHandlers from "pool-handlers";
import BinData from "./BinData.js";
import {ApiPromise, WsProvider} from '@polkadot/api';
import {cryptoWaitReady, encodeAddress, decodeAddress} from '@polkadot/util-crypto';

const enc = new TextEncoder();
const dec = new TextDecoder();

const Blockchain = class Blockchain {
	#keyring;				//Keyring of account
	#readyState;			//Status of connection to blockchain
	#client;				//Blockchain connection
	#provider;				//Blockchain provider
	#handlersOnRequest;
	#handlersOnAnswer;

	/**
	 * @constructor
	 * @param cfg				{Object}
	 * @param cfg.keyring		{Object}
	 * @param cfg.endpoint		{string}		//Ws address of parachain node
	 */
	constructor(cfg) {
		this.#keyring = cfg.keyring;
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
							//console.log('[Blockchain] catch offer: ', event.data);		//[offer, accountFrom, accountTo, msg]

							let accountFrom = encodeAddress(event.data[1]);
							let accountTo = encodeAddress(event.data[2]);
							if (accountTo === this.#keyring.address) {
								const offerBin = new BinData(event.data[0].buffer);
								const ln = offerBin.getUint16();

								const cryptOfferU8A = new Uint8Array(offerBin.getBuffer(ln));
								const offerU8A = this.#keyring.decryptMessage(cryptOfferU8A, decodeAddress(accountFrom));
								const offer = dec.decode(offerU8A);

								this.#handlersOnRequest.run({
									from: accountFrom,
									offer: offer
								});
							}
						}

						//catch answer event
						if (client.events.templateModule.Answer.is(event)) {
							//console.log('[Blockchain] catch answer: ', event.data);
							const accountFrom = encodeAddress(event.data[1]);
							const accountTo = encodeAddress(event.data[2]);
							if (accountTo === this.#keyring.address) {
								const offerBin = new BinData(event.data[0].buffer);
								const ln = offerBin.getUint16();
								const cryptOfferU8A = new Uint8Array(offerBin.getBuffer(ln));
								const offerU8A = this.#keyring.decryptMessage(cryptOfferU8A, decodeAddress(accountFrom));
								const offer = dec.decode(offerU8A);

								this.#handlersOnAnswer.run({
									from: accountFrom,
									offer: offer
								});
							}
						}
					});
				});

				this.#readyState.ready();
			});
		});
	}

	/**
	 * @method createOffer
	 * @description Send webrtc offer to blockchain
	 * @param cfg
	 * @param cfg.to			{String}	//to DOT address
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
				let cryptOfferU8A = this.#keyring.encryptMessage(offerU8A, decodeAddress(cfg.to));

				const offerBin = new BinData(2048);
				offerBin.setUint16(cryptOfferU8A.byteLength);
				offerBin.setBuffer(cryptOfferU8A);

				const welcomeMsgBin = new BinData(300);
				welcomeMsgBin.setString(cfg.welcomeMsg);

				this.#client.tx.templateModule.offerChat(welcomeMsgBin.uint8Array, offerBin.uint8Array, cfg.to).signAndSend(this.#keyring, ({
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
	 * @param cfg.to		{String}
	 * @param cfg.offer		{String}
	 */
	createAnswer(cfg) {
		return new Promise(resolve => {
			this.#readyState.onReady(() => {
				const answerBin = new BinData(2048);
				const offerU8A = enc.encode(cfg.offer);

				const cryptOfferU8A = this.#keyring.encryptMessage(offerU8A, decodeAddress(cfg.to));

				answerBin.setUint16(cryptOfferU8A.byteLength);
				answerBin.setBuffer(cryptOfferU8A);
				//console.log('[Blockchain] push answer:', answerBin);

				this.#client.tx.templateModule.answerChat(answerBin.uint8Array, cfg.to).signAndSend(this.#keyring, ({
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
