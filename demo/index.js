import DOTRTC from "../src/DOTRTC.js";
import {cryptoWaitReady} from '@polkadot/util-crypto';
import {Keyring} from '@polkadot/api';

const $tplAuth = document.getElementById('tplAuth');
const $tplConnector = document.getElementById('tplConnector');
const $tplMsg = document.getElementById('tplMsg');
const $msg = document.getElementById('msg');
const $log = document.getElementById('log');
const $phrase = document.getElementById('phrase');
const $toAddress = document.getElementById('to');

window.app = new (class App {
	#p2p;
	#channel;

	auth = () => {
		cryptoWaitReady().then(() => {
			$tplAuth.style.display = 'none';
			$tplConnector.style.display = 'block';

			const keyring = new Keyring({type: 'ed25519'});
			const accountKeyring = keyring.addFromUri($phrase.value);
			this.addLog(`My address: <b>${accountKeyring['address']}</b>`);

			this.#p2p = new DOTRTC({
				keyring: accountKeyring,
				onConnectionRequest: connection => {
					this.addLog(`<b>${connection.remoteAddress}</b> try connect to me`);
					connection.accept();
				},
				onConnect: (channel) => {
					this.#channel = channel;
					this.addLog(`<b>${channel.remoteAddress}</b> connected to me`);
					$tplConnector.style.display = 'none';
					$tplMsg.style.display = 'block';

					channel.onMessage(msgBin => {
						const dec = new TextDecoder();
						const message = dec.decode(msgBin);
						this.addLog('Got message:' + message);
					})
				}
			});
		});
	}

	connect = () => {
		const toAddress = $toAddress.value;
		this.addLog(`Connecting to <b>${toAddress}</b> ...`);
		this.#p2p.connect({to: toAddress});
	}

	sendMessage = () => {
		this.addLog("send message: " + $msg.value);
		let enc = new TextEncoder();
		const message = enc.encode($msg.value);		//convert to Uint8Array
		$msg.value = '';
		this.#channel.sendMessage(message);
	}

	addLog = (msg) => {
		$log.innerHTML += "<div>" + msg + "</div>";
	}
})();
