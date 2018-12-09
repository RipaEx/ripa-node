![RIPA-NODE](./banner_medium_node.jpg)

Ripa is a next generation crypto-currency and decentralized application platform, written entirely in JavaScript. For more information please refer to our website: https://ripaex.io/.

The Token Exchange Campaign is up at https://tec.ripaex.io

This version is still alpha, use at your own risks

## Install, Upgrade etc...

You need to provision a linux (ubuntu tested) server (digital ocean, vultur or other).

Then use the excellent ripa-commander script
```
cd
wget https://raw.githubusercontent.com/RipaEx/ripa-commander/master/RIPA_commander_mainnet.sh
chmod 700 ~/RIPA_commander_mainnet.sh
./RIPA_commander_mainnet.sh


```

For developers, please read below in section "Developer Installation"

## Details

This is a fork from Lisk with the following features:
- Removed sidechains (deprecated in favor of smartbridge)
- Removed custom node version
- Removed UI for stability and security reasons
- Changed some constants (block rewards, blocktime etc...)
- Added simple PBFT before forging new block
- Ditch addresses from the protocol in favor of bitcoin like system, enabling HD Wallet as for BIP32
- Completely rewritten node management using a single NodeManager and messaging system
- Completely rewritten round management (removed mem_round, reward block fees to forger)
- Added 64 bytes vendorField as first iteration of smart bridge
- Made peers management entirely in-memory for efficiency
- Strengthened the transaction management and broadcast (reject often, reject soon)
- Rearchitect with relay nodes and forging nodes
- Nodes broadcast only block headers.

### Planned features:
- Simple blockchain validation for SPV and use in lite clients
- Add IPFS as first class citizen (using smartbridge addressing)
- Protocol improvements (uncle forging, voting weights).
- Remove unsecured API
- Routing tables

### Performance
- stable on testnet at 5tx/s
- pushed to 10tx/s on devnet


## Developer Installation

Install essentials:

```
sudo apt-get update
sudo apt-get install -y curl build-essential python git
```

Install PostgreSQL (min version: 9.5.2)

```
sudo apt-get install -y postgresql postgresql-contrib libpq-dev
sudo -u postgres createuser --createdb --pwprompt $USER
createdb ripa_mainnet
```

Install Node.js (tested with version 6.9.2, but any recent LTS release should do):

```
sudo apt-get install -y npm nodejs
sudo npm install -g n
sudo n 8.10.0
```

Install grunt-cli and forever(globally):

```
sudo npm install grunt-cli -g
sudo npm install forever -g
```

Clone this repository
```
git clone https://github.com/RipaEx/ripa-node.git
cd ripa-node
```

Install node modules:
```
npm install libpq secp256k1
npm install
```

## Launch with forever
Start
```
forever start app.js
```
Watch log
```
tail -f logs/ripa.log
```

## Launch with forever - DevNET -
Start
```
forever start app.js --config config.devnet.json --genesis genesisBlock.devnet.json
```
Watch log
```
tail -f logs/ripa.log
```

## Launch from command line

To launch ripa on mainnet:
```
createdb ripa_mainnet
node run start:mainnet
```

**NOTE:** The **port**, **address**, **genesis block** and **config-path** can be overridden by providing the relevant command switch:
```
node app.js -p [port] -a [address] -c [config-path] -g [genesisBlock-path]
```
This allow you to run several different networks, or your own private chain


## Launch your own private or public chain
Generate a genesisBlock.json + a default config.json containing all passphrases of genesis delegates
```
node tasks/createGenesisBlock.js
```
You can find generated files in tasks/
- genesisBlock.json
- config.json
- delegatesPassphrases.json (containing details about the genesis delegates)
- genesisPassphrase.json (containing the details of account having all premined ripas)

Obviously you can hack away tasks/createGenesisBlock.js for your own custom use.

You can the start with your own chain on a single node (all delegates will forge on your single node) using:
```
createdb ripa_newtest
npm run start:newtest
```

Then you can distribute the config.json (without the delegates secrets inside, and with custom peers settings) to peers to let them join your chain


## Tests
Load git submodule [ripa-js](https://github.com/RipaEx/ripa-js):
```
git submodule init
git submodule update
```

You should run using test configurations

```
npm run start:test
```

Run the test suite:

```
npm test
```

Run individual tests:

```
npm test -- test/api/accounts.js
npm test -- test/api/transactions.js
```

**NOTE:** The master passphrase for this test genesis block is as follows:

```
peace vanish bleak box tuna woman rally manage undo royal lucky since
```


## Authors
- Giovanni Silvestri <gsit80@gmail.com>
- FX Thoorens <fx.thoorens@ark.io>
- Boris Povod <boris@crypti.me>
- Pavel Nekrasov <landgraf.paul@gmail.com>
- Sebastian Stupurac <stupurac.sebastian@gmail.com>
- Oliver Beddows <oliver@lisk.io>

## License

RIPAEX is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
