var moment = require('moment');
var fs = require('fs');
var path = require('path');
var ripajs = require('ripajs');
var crypto = require('crypto');
var bip39 = require('bip39');
var ByteBuffer = require('bytebuffer');
var bignum = require('../helpers/bignum.js');
var Crypto = require('../helpers/crypto.js');
var constants = require('../helpers/constants');
var networks = require('../networks.json');

// network name that SHOULD already be preconfigured in ../networks.json
var network_name = "ripa";
if (!networks[network_name]) {
    console.log("WARNING: no configuration found in networks.json for '" + network_name + "'. Defaulting to 'devnet'");
    network_name = "devnet";
}

// directory to export passphrases of premine account and genesis delegates. Should exist
var private_dir = './private';

// directory to export config and genesisBlock files. Should exist
var output_dir = './private';

// default port for node
var default_port = 5500;

// version of network to set in the config file
var config_version = '0.2.0';

// ips of your nodes in your network
var seed_peers = [
    {
        ip: "127.0.0.1",
        port: 5500
    }, {
        ip: "127.0.0.2",
        port: 5500
    }, {
        ip: "127.0.0.3",
        port: 5500
    }, {
        ip: "127.0.0.4",
        port: 5500
    }, {
        ip: "127.0.0.5",
        port: 5500
    }
];

// default db named
var db_name = "ripa_" + networks[network_name].name;

// optional premined accounts. Example :
// [
//   {address:"Aoasdk8wehw98eve8fvwr", total:13940327},
//   {address:"A12lknlkh23902h3n4l2234", total:1000000000}
// ]
// total in satoshi
var genesisAccounts = [];
if (fs.existsSync('./private/genesis.' + networks[network_name].name + '.accounts.json')) {
    var genesisAccounts = JSON.parse(fs.readFileSync('./private/genesis.' + networks[network_name].name + '.accounts.json'));
}
else {
    console.log("WARNING: no premined accounts found ('./private/genesis." + networks[network_name].name + ".accounts.json').");
}

// Total of premined token in satoshi. The premined accounts will be substracted to this
var totalpremine = 11500000000000000;


// config file that will be tuned and exported
var config = {
    port: default_port,
    address: "0.0.0.0",
    version: config_version,
    fileLogLevel: "info",
    logFileName: "logs/ripa.log",
    consoleLogLevel: "debug",
    trustProxy: false,
    db: {
        host: "localhost",
        port: 5432,
        database: db_name,
        user: null,
        password: "password",
        poolSize: 20,
        poolIdleTimeout: 30000,
        reapIntervalMillis: 1000,
        logEvents: [
            "error"
        ]
    },
    api: {
        mount: true,
        access: {
            whiteList: []
        },
        options: {
            limits: {
                max: 0,
                delayMs: 0,
                delayAfter: 0,
                windowMs: 60000
            }
        }
    },
    peers: {
        minimumNetworkReach: 1,
        list: seed_peers,
        blackList: [],
        options: {
            limits: {
                max: 0,
                delayMs: 0,
                delayAfter: 0,
                windowMs: 60000
            },
            maxUpdatePeers: 20,
            timeout: 5000
        }
    },
    forging: {
        coldstart: 6,
        force: true,
        secret: [],
        access: {
            whiteList: [
                "127.0.0.1"
            ]
        }
    },
    loading: {
        verifyOnLoading: false,
        loadPerIteration: 5000
    },
    ssl: {
        enabled: false,
        options: {
            port: 443,
            address: "0.0.0.0",
            key: "./ssl/ripa.key",
            cert: "./ssl/ripa.crt"
        }
    },
    network: network_name
};
// general functions
makeKeypair = function (seed) {
    return ripajs.crypto.getKeys(seed, networks[config.network]);
};

sign = function (block, keypair) {
    var hash = getHash(block);
    return keypair.sign(hash).toDER().toString("hex");
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
    var size = 4 + 4 + 4 + 8 + 4 + 4 + 8 + 8 + 4 + 4 + 4 + 32 + 32 + 64;
    var b, i;

    try {
        var bb = new ByteBuffer(size, true);
        bb.writeInt(block.version);
        bb.writeInt(block.timestamp);
        bb.writeInt(block.height);

        if (block.previousBlock) {
            var pb = bignum(block.previousBlock).toBuffer({ size: '8' });

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
        height: 1
    };

    block.id = getId(block);

    try {
        block.blockSignature = sign(block, data.keypair);
    } catch (e) {
        throw e;
    }

    return block;
}


// START of the script

var delegates = [];
var transactions = [];
var remainingfund = {};
ripajs.crypto.setNetworkVersion(networks[network_name].pubKeyHash);

var genesis = {
    passphrase: bip39.generateMnemonic(),
    balance: totalpremine
};

var premine = {
    passphrase: bip39.generateMnemonic()
};

premine.publicKey = ripajs.crypto.getKeys(premine.passphrase).publicKey;
premine.address = ripajs.crypto.getAddress(premine.publicKey, networks[config.network].pubKeyHash);

genesis.publicKey = ripajs.crypto.getKeys(genesis.passphrase).publicKey;
genesis.address = ripajs.crypto.getAddress(genesis.publicKey, networks[config.network].pubKeyHash);

// creation of delegates
for (var i = 1; i < (constants.activeDelegates + 1); i++) {
    var delegate = {
        'passphrase': bip39.generateMnemonic(),
        'username': "genesis_" + i
    };

    delegate.publicKey = ripajs.crypto.getKeys(delegate.passphrase).publicKey;
    delegate.address = ripajs.crypto.getAddress(delegate.publicKey, networks[config.network].pubKeyHash);

    // create delegate
    var createDelegateTx = ripajs.delegate.createDelegate(delegate.passphrase, delegate.username);
    createDelegateTx.fee = 0;
    createDelegateTx.timestamp = 0;
    createDelegateTx.senderId = delegate.address;
    createDelegateTx.signature = ripajs.crypto.sign(createDelegateTx, ripajs.crypto.getKeys(delegate.passphrase));
    createDelegateTx.id = ripajs.crypto.getId(createDelegateTx);

    transactions.push(createDelegateTx);

    delegates.push(delegate);
}

var total = 0;

for (var i = 0; i < genesisAccounts.length; i++) {
    var account = genesisAccounts[i];
    total += account.total;

    //send ripa to account
    var premineTx = ripajs.transaction.createTransaction(account.address, account.total, null, premine.passphrase);

    premineTx.fee = 0;
    premineTx.timestamp = 0;
    premineTx.senderId = premine.address;
    premineTx.signature = ripajs.crypto.sign(premineTx, ripajs.crypto.getKeys(premine.passphrase));
    premineTx.id = ripajs.crypto.getId(premineTx);
    transactions.push(premineTx);

}

remainingfund.total = totalpremine - total;

var preminefund = ripajs.transaction.createTransaction(genesis.address, remainingfund.total, null, premine.passphrase);

preminefund.fee = 0;
preminefund.timestamp = 0;
preminefund.senderId = premine.address;
preminefund.signature = ripajs.crypto.sign(preminefund, ripajs.crypto.getKeys(premine.passphrase));
preminefund.id = ripajs.crypto.getId(preminefund);
transactions.push(preminefund);

var genesisBlock = create({
    keypair: ripajs.crypto.getKeys(genesis.passphrase, networks[config.network]),
    transactions: transactions,
    timestamp: 0
});

config.nethash = genesisBlock.payloadHash;

fs.writeFile(output_dir + "/genesisBlock." + config.network + ".json", JSON.stringify(genesisBlock, null, 2));
fs.writeFile(output_dir + "/config." + config.network + ".json", JSON.stringify(config, null, 2));

// add delegates passphrases in config for testing on one single node
for (var i = 0; i < constants.activeDelegates; i++) {
    config.forging.secret.push(delegates[i].passphrase);
}
fs.writeFile(private_dir + "/config." + config.network + ".autoforging.json", JSON.stringify(config, null, 2));

var forging = [];
seed_peers.forEach(function (seed) {
    forging.push({ secret: [] });
});
// split all delegates accross all seed_peers
for (var i = 0; i < constants.activeDelegates; i++) {
    var seed_index = i % seed_peers.length;
    forging[seed_index].secret.push(delegates[i].passphrase);
}

seed_peers.forEach(function (peer, index) {
    config.forging.secret = forging[index];
    fs.writeFile(private_dir + "/config." + config.network + "." + peer.ip + ".json", JSON.stringify(config, null, 2));
});

fs.writeFile(private_dir + "/delegatesPassphrases." + config.network + ".json", JSON.stringify(delegates, null, 2));
fs.writeFile(private_dir + "/genesisPassphrase." + config.network + ".json", JSON.stringify(genesis, null, 2));
