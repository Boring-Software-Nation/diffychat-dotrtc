import PeerChannel from './PeerChannel.js';
import State from "states-manager";
import wrtc from 'wrtc';
import {atob, btoa} from 'abab';

let Peer = class Peer {
	remoteAddress;				// The address of the peer with which the connection is established
	systemChannel;				// `PeerChannel` object of connection
	#pc;						// peerConnection
	#readyState = new State();	// State of connection
	#master = false;			// Equals true if this peer is the connection initiator
	#onDisconnect;

	/**
	 * @constructor
	 * @param cfg				{Object}
	 * @param cfg.remoteAddress	{String}	// The address of the peer with which the connection is established
	 * @param cfg.iceServer		{Object}	// {urls}
	 * @param cfg.onDisconnect	{Function}	// onDisconnect handler
	 */
	constructor(cfg) {
		this.remoteAddress = cfg.remoteAddress;
		this.#onDisconnect = cfg.onDisconnect;
		this.#pc = new wrtc.RTCPeerConnection({
			iceServers: [
				cfg.iceServer
			]
		});
		this.#pc.onsignalingstatechange = e => {
			//console.log('[Peer] signal:', this.#pc.signalingState);
		};
		this.#pc.oniceconnectionstatechange = e => {
			//console.log('[Peer] connection:', this.#pc.iceConnectionState);
		};
	}

	/**
	 * @description Calls the handlers when a connection to a peer is established and a system channel is opened.
	 * @param handler	{Function}		// Handler
	 */
	onReady(handler) {
		this.#readyState.onReady(handler);
	}

	/**
	 * @description Creates a connection and returns the generated localOffer to the callback. After the interlocutor accepts it, you need to call offerAccept to save his code
	 * @return {Promise}
	 */
	offerCreate() {
		return new Promise(done => {
			this.#master = true;

			//console.warn('[Peer] creating channel');
			this.channelCreate({
				remoteAddress: this.remoteAddress
			}).then(channel => {
				this.systemChannel = channel;
				//console.warn('[Peer] connection established (system channel opened)', channel);
				this.#readyState.ready();
			});

			//console.log('[Peer.offerCreate] created system channel:', this.sysChannel);
			this.#pc.onicecandidate = event => {
				if (event.candidate === null) {
					//console.log('[Peer.offerCreate] Offer created');
					done(btoa(JSON.stringify(this.#pc.localDescription)));
				}
			};
			this.#pc.onicecandidateerror = e => {
				//console.warn('onicecandidateerror:', e);
			};
			this.#pc.onnegotiationneeded = e => {
				this.#pc.createOffer().then(localOffer => {
					this.#pc.setLocalDescription(localOffer);
				});
			};
		});
	}

	/**
	 * @description Accepts connection
	 * @param remoteOffer	{String}		// webRTC remote offer
	 * @return {Promise}
	 */
	offerAccept(remoteOffer) {
		return new Promise(done => {
			let offerLocal;
			this.#pc.setRemoteDescription(new wrtc.RTCSessionDescription(JSON.parse(atob(remoteOffer))))	// Install remoteOffer
				.catch(console.log)
				.then(() => {																				// create an answer, if we didn't create the offer
					if (this.#master) {
						done();
					} else {
						this.#pc.onicecandidate = event => {
							let makeOffer = () => {
								offerLocal = btoa(JSON.stringify(this.#pc.localDescription));
								//console.log('[Peer.onicecandidate] onicecandidate, offerLocal:', offerLocal);
								done(offerLocal);
							};
							if (event.candidate === null && !this['oncandidateready']) {
								makeOffer();
							}
						};
						this.#pc.ondatachannel = e => {
							this.channelCreate({
								remoteAddress: this.remoteAddress,
								channel: e.channel
							}).then(channel => {
								this.systemChannel = channel;
								//console.warn('[Peer] channel accepted:', channel);
								this.#readyState.ready();
							});
						};
						this.#pc.createAnswer().then(d => {
							//console.log('[Peer] create answer');
							this.#pc.setLocalDescription(d);
						}).catch(console.log);
					}
				});
		});
	}

	/**
	 * @description Create channel for connection
	 * @param cfg					{Object}
	 * @param cfg.remoteAddress		{String}
	 * @param cfg.channel			{Object=}
	 * @return {Promise}
	 */
	channelCreate(cfg) {
		return new Promise(done => {
			let channel;
			channel = new PeerChannel({
				pc: this.#pc,
				remoteAddress: cfg.remoteAddress,
				channel: cfg.channel
			}, () => {
				done(channel);
			}, () => {
				this.#onDisconnect(channel);
			});
		});
	}
};

export default Peer;
