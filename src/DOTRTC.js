import Blockchain from './blockchain.js';
import {Peer} from './Peer.js';
import {Keyring} from "@polkadot/api";

const peers = {};

const DOTRTC = class DOTRTC {
	#cfg;
	#bConn;
	peers;

	/**
	 * @constructor
	 * @param cfg
	 * @param cfg.iceServer				{String=}	// [optional] Stun or Turn server
	 * @param cfg.phrase				{String}	// Private key
	 * @param cfg.endpoint				{String=}	//
	 * @param cfg.onConnectionRequest	{Function=}	//
	 * @param cfg.onConnect				{Function=}	//
	 * @param cfg.onDisconnect			{Function=}	//
	 */
	constructor(cfg) {
		this.peers = {};
		if (!cfg.iceServer) {
			cfg.iceServer = {
				urls: 'stun:stun2.l.google.com:19302'
			};
		}
		this.#cfg = cfg;

		const srKeyring = new Keyring({type: 'sr25519'});
		const accountSrKeyring = srKeyring.addFromUri(cfg.phrase);
		const edKeyring = new Keyring({type: 'ed25519'});
		const accountEdKeyring = edKeyring.addFromUri(cfg.phrase);

		this.#bConn = new Blockchain({
			srKeyring: accountSrKeyring,
			edKeyring: accountEdKeyring,
			endpoint: cfg.endpoint || 'wss://diffy.bsn.si/'
		});

		/*
		* On offer event. If the gateway sent someone an offer to connect, we accept it and send our localOffer
		*/
		this.#bConn.onOffer(offerCfg => {
			let peer = new Peer({												// This is the peer trying to connect to us
				remoteAddress: offerCfg.from,
				iceServer: cfg.iceServer
			});

			cfg.onConnectionRequest({
				remoteAddress: offerCfg.from,
				accept: () => {
					peer.onReady(() => {
						cfg.onConnect(peer.systemChannel);
					});
					peer.offerAccept(offerCfg.offer).then((offerLocal) => {
						this.#bConn.createAnswer({
							to: offerCfg.from,
							offer: offerLocal
						});
					});
				}
			});
		});

		this.#bConn.onAnswer(answer => {
			const peer = peers[answer.from];			//from(ed)
			peer.offerAccept(answer.offer);
			peer.onReady(() => {
				cfg.onConnect(peer.systemChannel);
			});
		});
	}

	getUsername(addr) {
		return this.#bConn.getUsername(addr);
	}

	register(username, addr) {
		return this.#bConn.register(username, addr);
	}

	/**
	 * @param cfg		{Object}
	 * @param cfg.to	{String}		// username
	 * @return {Promise<unknown>}
	 */
	connect(cfg) {
		//console.warn('[DOTRTC] connect:', cfg);
		return new Promise(done => {

			this.#bConn.getAddress(cfg.to).then(addr => {			//addr(ed)
				console.log('connect to: ', addr);
				if (peers[addr]) {					// If there is already a feast, then we wait until the connection is established and then we return it
					//console.warn('[DOTRTC] Get peer. Waiting ready state...');
					peers[addr].onReady(() => {
						done(peers[addr]);
					});
				} else {								// If there is no peer, we exchange codes with it and establish a connection, return the peer
					//console.log('[DOTRTC] create Peer');
					let peer = peers[addr] = new Peer({
						remoteAddress: addr,
						iceServer: this.#cfg.iceServer,
						onDisconnect: this.#cfg.onDisconnect
					});

					Promise.all([
						peer.offerCreate(),						// Generate localOffer
					]).then(([localOffer]) => {	// We ask the blockchain to transfer our localOffer to it and receive remoteOffer from it
						//console.log('[DOTRTC] creating local Offer:', localOffer);

						this.#bConn.createOffer({
							to: addr,
							offer: localOffer,
							welcomeMsg: 'helloTest'
						});
					});
				}
			});
		});
	}
};

export default DOTRTC;
