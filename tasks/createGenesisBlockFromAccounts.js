var moment = require('moment');
var fs = require('fs');
var path = require('path');
var ripajs = require('ripajs');
var crypto = require('crypto');
var bip39 = require('bip39');
var ByteBuffer = require('bytebuffer');
var bignum = require('../helpers/bignum.js');
var ed = require('../helpers/ed.js');

var accounts = require('../tasks/accounts.js').accounts;

//var genesisVote = JSON.parse(fs.readFileSync('./tasks/genesisPassphrase.json'));

var config = {
    "port": 4000,
    "address": "0.0.0.0",
    "version": "0.2.1",
    "fileLogLevel": "info",
    "logFileName": "logs/ripa.log",
    "consoleLogLevel": "debug",
    "trustProxy": false,
    "db": {
        "host": "localhost",
        "port": 5432,
        "database": "ripa_testnet",
        "user": null,
        "password": "password",
        "poolSize": 20,
        "poolIdleTimeout": 30000,
        "reapIntervalMillis": 1000,
        "logEvents": [
            "error"
        ]
    },
    "api": {
        "mount":true,
        "access": {
            "whiteList": []
        },
        "options": {
            "limits": {
                "max": 0,
                "delayMs": 0,
                "delayAfter": 0,
                "windowMs": 60000
            }
        }
    },
    "peers": {
        "minimumNetworkReach":1,
        "list": [{"ip":"127.0.0.1", "port":4000}],
        "blackList": [],
        "options": {
            "limits": {
                "max": 0,
                "delayMs": 0,
                "delayAfter": 0,
                "windowMs": 60000
            },
            "maxUpdatePeers": 20,
            "timeout": 5000
        }
    },
    "forging": {
        "coldstart": 6,
        "force": true,
        "secret": [],
        "access": {
            "whiteList": [
                "127.0.0.1"
            ]
        }
    },
    "loading": {
        "verifyOnLoading": false,
        "loadPerIteration": 5000
    },
    "ssl": {
        "enabled": false,
        "options": {
            "port": 443,
            "address": "0.0.0.0",
            "key": "./ssl/ripa.key",
            "cert": "./ssl/ripa.crt"
        }
    }
};

sign = function (block, keypair) {
	var hash = getHash(block);
	return ed.sign(hash, keypair).toString('hex');
};


getId = function (block) {
	var hash = crypto.createHash('sha256').update(getBytes(block)).digest();
	var temp = new Buffer(8);
	for (var i = 0; i < 8; i++) {
		temp[i] = hash[7 - i];
	}

	var id = bignum.fromBuffer(temp).toString();
	return id;
};

getHash = function (block) {
	return crypto.createHash('sha256').update(getBytes(block)).digest();
};


getBytes = function (block) {
	var size = 4 + 4 + 4 + 8 + 4 + 4 + 8 + 8 + 4 + 4 + 4 + 32 + 32 + 66;
	var b, i;

	try {
		var bb = new ByteBuffer(size, true);
		bb.writeInt(block.version);
		bb.writeInt(block.timestamp);
    bb.writeInt(block.height);

		if (block.previousBlock) {
			var pb = bignum(block.previousBlock).toBuffer({size: '8'});

			for (i = 0; i < 8; i++) {
				bb.writeByte(pb[i]);
			}
		} else {
			for (i = 0; i < 8; i++) {
				bb.writeByte(0);
			}
		}

		bb.writeInt(block.numberOfTransactions);
		bb.writeLong(block.totalAmount);
		bb.writeLong(block.totalFee);
		bb.writeLong(block.reward);

		bb.writeInt(block.payloadLength);

		var payloadHashBuffer = new Buffer(block.payloadHash, 'hex');
		for (i = 0; i < payloadHashBuffer.length; i++) {
			bb.writeByte(payloadHashBuffer[i]);
		}

		var generatorPublicKeyBuffer = new Buffer(block.generatorPublicKey, 'hex');
		for (i = 0; i < generatorPublicKeyBuffer.length; i++) {
			bb.writeByte(generatorPublicKeyBuffer[i]);
		}

		if (block.blockSignature) {
			var blockSignatureBuffer = new Buffer(block.blockSignature, 'hex');
			for (i = 0; i < blockSignatureBuffer.length; i++) {
				bb.writeByte(blockSignatureBuffer[i]);
			}
		}

		bb.flip();
		b = bb.toBuffer();
	} catch (e) {
		throw e;
	}

	return b;
};

create = function (data) {
	var transactions = data.transactions.sort(function compare(a, b) {
		if (a.type < b.type) { return -1; }
		if (a.type > b.type) { return 1; }
		if (a.amount < b.amount) { return -1; }
		if (a.amount > b.amount) { return 1; }
		return 0;
	});

	var nextHeight = 1;

	var reward = 0,
	    totalFee = 0, totalAmount = 0, size = 0;

	var blockTransactions = [];
	var payloadHash = crypto.createHash('sha256');

	for (var i = 0; i < transactions.length; i++) {
		var transaction = transactions[i];
		var bytes = ripajs.crypto.getBytes(transaction);

		size += bytes.length;

		totalFee += transaction.fee;
		totalAmount += transaction.amount;

		blockTransactions.push(transaction);
		payloadHash.update(bytes);
	}

	var block = {
		version: 0,
		totalAmount: totalAmount,
		totalFee: totalFee,
		reward: reward,
		payloadHash: payloadHash.digest().toString('hex'),
		timestamp: data.timestamp,
		numberOfTransactions: blockTransactions.length,
		payloadLength: size,
		previousBlock: null,
		generatorPublicKey: data.keypair.publicKey.toString('hex'),
		transactions: blockTransactions,
    height:1
	};

  block.id=getId(block);


	try {
		block.blockSignature = sign(block, data.keypair);
	} catch (e) {
		throw e;
	}

	return block;
}

var delegates = [];
var transactions = [];

var genesis = {
  passphrase: bip39.generateMnemonic(),
  balance: 12500000000000000
};

var premine = {
  passphrase: bip39.generateMnemonic()
};

premine.publicKey = ripajs.crypto.getKeys(premine.passphrase).publicKey;
premine.address = ripajs.crypto.getAddress(premine.publicKey);

genesis.publicKey = ripajs.crypto.getKeys(genesis.passphrase).publicKey;
genesis.address = ripajs.crypto.getAddress(genesis.publicKey);
genesis.wif = ripajs.crypto.getKeys(genesis.passphrase).toWIF();

var totalbalance = genesis.balance;
var numvote = 0;

for(var i in accounts){
  var account = accounts[i];

  //send ripa to account
	var premineTx = ripajs.transaction.createTransaction(account.address, account.balance, null, premine.passphrase);

  delete premineTx.asset;
	premineTx.fee = 0;
	premineTx.timestamp = 0;
	premineTx.senderId = premine.address;
	premineTx.signature = ripajs.crypto.sign(premineTx,ripajs.crypto.getKeys(premine.passphrase));
	premineTx.id = ripajs.crypto.getId(premineTx);
	transactions.push(premineTx);
  totalbalance = totalbalance - account.balance;

  if(account.username){
    // create delegate
    var createDelegateTx = ripajs.delegate.createDelegate("dummy", account.username);
    createDelegateTx.fee = 0;
    createDelegateTx.timestamp = 0;
    createDelegateTx.senderId = account.address;
    createDelegateTx.senderPublicKey = account.publicKey;
    createDelegateTx.asset.delegate.publicKey = account.publicKey;
    createDelegateTx.id = ripajs.crypto.getId(createDelegateTx);
    //don't have passphrase so no verify
    createDelegateTx.signature="";
    transactions.push(createDelegateTx);

    if(numvote<51 && account.username.startsWith("genesis_")){
      numvote++
      console.log("Voting for " + account.username);
      console.log(totalbalance);
    	//vote for genesis_ accounts
    	var voteTransaction = ripajs.vote.createVote(genesis.passphrase,["+"+account.publicKey]);
    	voteTransaction.fee = 0;
    	voteTransaction.timestamp = 0;
      voteTransaction.senderId = genesis.address;
    	voteTransaction.signature = ripajs.crypto.sign(voteTransaction,ripajs.crypto.getKeys(genesis.passphrase));
    	voteTransaction.id = ripajs.crypto.getId(voteTransaction);

    	transactions.push(voteTransaction);
    }
  }

}

console.log(totalbalance);

var genesisBlock = create({
  keypair: ripajs.crypto.getKeys(genesis.passphrase),
  transactions:transactions,
  timestamp:0
});

config.nethash = genesisBlock.payloadHash;


fs.writeFile("./private/genesisBlock.testnet.json",JSON.stringify(genesisBlock, null, 2));
fs.writeFile("./private/config.testnet.json",JSON.stringify(config, null, 2));
//fs.writeFile("./private/delegatesPassphrases.testnet.json", JSON.stringify(delegates, null, 2));
//fs.writeFile("./private/genesisPassphrase.testnet.json", JSON.stringify(genesis, null, 2));
