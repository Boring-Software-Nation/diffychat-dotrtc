import Blockchain from './blockchain.js';
import {Peer} from './Peer.js';

const peers = {};

const DOTRTC = class DOTRTC {
	#cfg;
	#bConn;
	peers;

	/**
	 * @constructor
	 * @param cfg
	 * @param cfg.iceServer				{String=}	// [optional] Stun or Turn server
	 * @param cfg.keyring				{Object}	// Keyring of user
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

		this.#bConn = new Blockchain({
			keyring: cfg.keyring,
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
			const peer = peers[answer.from];
			peer.offerAccept(answer.offer);
			peer.onReady(() => {
				cfg.onConnect(peer.systemChannel);
			})
		});
	}

	/**
	 * @param cfg		{Object}
	 * @param cfg.to	{String}
	 * @return {Promise<unknown>}
	 */
	connect(cfg) {
		//console.warn('[DOTRTC] connect:', cfg);
		return new Promise(done => {
			if (peers[cfg.to]) {				// If there is already a feast, then we wait until the connection is established and then we return it
				//console.warn('[DOTRTC] Get peer. Waiting ready state...');
				peers[cfg.to].onReady(() => {
					done(peers[cfg.to]);
				});
			} else {								// If there is no peer, we exchange codes with it and establish a connection, return the peer
				//console.log('[DOTRTC] create Peer');
				let peer = peers[cfg.to] = new Peer({
					remoteAddress: cfg.to,
					iceServer: this.#cfg.iceServer
				});

				Promise.all([
					peer.offerCreate(),						// Generate localOffer
				]).then(([localOffer]) => {	// We ask the blockchain to transfer our localOffer to it and receive remoteOffer from it
					//console.log('[DOTRTC] creating local Offer:', localOffer);

					this.#bConn.createOffer({
						to: cfg.to,
						offer: localOffer,
						welcomeMsg: 'helloTest'
					});
				});
			}
		});
	}
};

export default DOTRTC;
