import DOTRTC from "../src/DOTRTC.js";
import {cryptoWaitReady} from '@polkadot/util-crypto';
import {Keyring} from '@polkadot/api';

const $tplAuth = document.getElementById('tplAuth');
const $tplRegister = document.getElementById('tplRegister');
const $tplConnector = document.getElementById('tplConnector');
const $tplMsg = document.getElementById('tplMsg');
const $username = document.getElementById('username');
const $msg = document.getElementById('msg');
const $log = document.getElementById('log');
const $phrase = document.getElementById('phrase');
const $toAddress = document.getElementById('to');

window.app = new (class App {
	#p2p;
	#channel;
	#accountSrKeyring;

	auth = () => {
		cryptoWaitReady().then(() => {
			$tplAuth.style.display = 'none';

			const srKeyring = new Keyring({type: 'sr25519'});
			this.#accountSrKeyring = srKeyring.addFromUri($phrase.value);
			this.addLog(`My address: <b>${this.#accountSrKeyring['address']}</b>`);

			this.#p2p = new DOTRTC({
				phrase: $phrase.value,
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

			this.#p2p.getUsername(this.#accountSrKeyring).then((username) => {
				if (username) {
					this.addLog('auth as: ' + username);
					$tplConnector.style.display = 'block';
				} else {
					$tplRegister.style.display = 'block';
				}
			});
		});
	}

	register = () => {
		$tplRegister.style.display = 'none';
		this.addLog('registration username: ' + $username.value);

		const edKeyring = new Keyring({type: 'ed25519'});
		const accountEdKeyring = edKeyring.addFromUri($phrase.value);

		this.#p2p.register($username.value, accountEdKeyring).then(() => {
			this.addLog('username registered');
			$tplConnector.style.display = 'block';
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
