![Diffy chat pic narrow](https://github.com/Boring-Software-Nation/diffychat-dotrtc/assets/126072104/636122af-c915-48e2-b52d-b7b2874986f5)

# Intro

This library allows you to establish p2p connections between polkadot accounts and instantly exchange data in both directions.

# Usage:

You can create a DOTRTC instance with the necessary settings and specify event handlers (connection request, successful connection, disconnection):

    const p2p = new DOTRTC({
        iceServer:      string,                 //Stun or turn server (https://datatracker.ietf.org/doc/html/rfc8445), example: `stun:stun.services.mozilla.com`
        endpoint:       string                  //Endpoint of parachain node, for example `wss://diffy.bsn.si`
        phrase:         string,                 //Secret phrase
        onConnectionRequest: function() {...}   //Handler that will be called when someone tries to connect to you
        onConnect: function() {...}             //Handler that will be called when a connection is successfully established with someone
        onDisconnect: function() {...}          //Handler will be called when the connection is broken (the remote user forcibly disconnected, or may be caused by problems with the Internet connection)
    });


When creating a DOTRTC instance, you must specify a successful connection handler:

    onConnect: function(channel) {
        console.log('connection established with:', channel.remoteAddress);
    }

You can assign a nickname to your wallet. Other users will connect to you using this username:

    p2p.register('<USERNAME>');

Create a p2p connection to the account by his DOT address:

    p2p.connect({
        to: '<USERNAME>'
    });

After that, the onConnectionRequest event will fire for the user they are trying to connect to, in which a connection request will come.
The user will have to accept it or ignore it.

    onConnectionRequest: function(connection) {
        console.log(connection.remoteAddress);      //`connection.remoteAddress` contains the address of the user who is trying to connect to us
        connection.accept();                        //allow this user to connect to us
    }


Upon successful connection, the `onConnect` handler will be called, in which the `channel` object of the connection will come in the arguments, through which messages can be sended
The `channel` object has the following methods:

    channel.sendMessage(payload);                   //send message to remote address. Payload must be type Uint8Array
    channel.onMessage(payload => {                  //payload is Uint8Array
        console.log(data);
    });

# Demo

The repository contains a demo page (in the `/demo` directory) that demonstrates the operation of the DotRTC library

This demo page uses a substrate deployed at `wss://diffy.bsn.si`.
Test users alice (private key `//Alice`) and bob (private key `//Bob`) are already registered in this parachain.
If you want to launch a page with your own parachain, then when initializing DotRTC (https://github.com/Boring-Software-Nation/diffychat-dotrtc/blob/main/demo/index.js#L28) you need to add the `endpoint` parameter with the address parachain nodes, for example:

    endpoint: 'wss://diffy.bsn.si/'

## Demo build

To install dependencies use

    npm i

Rollup is used to build the test page (конфиг: https://github.com/Boring-Software-Nation/diffychat-dotrtc/blob/main/demo/rollup.config.js)

    rollup -c ./rollup.config.js

Compiled js for test page including all dependencies will be in `/demo/build` directory.

To run use html file (https://github.com/Belsoft-rs/diffychat-dotrtc/blob/main/demo/index.html)

For ease of viewing and testing, this page has already been deployed on github pages and is available at:

    https://belsoft-rs.github.io/diffychat/

## Unit test

To run unit tests, use command

    npm test

## Demo video

[![Delivery vid pic ms1](https://user-images.githubusercontent.com/126072104/232100957-aa315c8c-2c3f-440e-b2d3-0c2055c47eaf.jpg)](https://media.belsoft.rs/diffychat/diffy.mp4)
