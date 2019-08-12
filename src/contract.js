import {
  Client, LocalAddress, CryptoUtils, LoomProvider
} from 'loom-js'

import Web3 from 'web3'
import CUEToken from './contracts/CUEToken.json'
import CUETips from './contracts/CUETips.json'
import BN from 'bn.js'
import _pbkdf2 from 'pbkdf2';
const pbkdf2 = _pbkdf2.pbkdf2Sync
import unorm from 'unorm';
import { Buffer } from 'safe-buffer';

const coinMultiplier = new BN(10).pow(new BN(18));

export default class Contract {
  async loadContract() {
    this.onEvent = null
    this._createClient()
    this._createCurrentUserAddress()
    this._createWebInstance()
    await this._createContractInstance()
  }

  salt (password) {
    return 'mnemonic' + (password || '')
  }

  mnemonicToSeed (mnemonic, password) {
    var mnemonicBuffer = Buffer.from(unorm.nfkd(mnemonic), 'utf8')
    var saltBuffer = Buffer.from(this.salt(unorm.nfkd(password)), 'utf8')

    return pbkdf2(mnemonicBuffer, saltBuffer, 2048, 32, 'sha512')
  }

  _createClient() {
    // const mnemonic = ['window', 'change', 'anchor', 'level', 'infant', 'fine', 'inside', 'multiply', 'spirit', 'left', 'slight', 'evoke']
    // this.privateKey = CryptoUtils.B64ToUint8Array('CESg7MZ/XTeMjJSL2z5n66+9ABWsakbl/mLPhmsz2cCeDZ7FO2OEF4fUSpDVIx97o19RE+mvSkuQHyu75BCfmg==')
    const mnemonic = 'code cluster sadness canoe dice seminar sibling wool olympic pond ketchup copper';
    const seed = this.mnemonicToSeed(mnemonic, 'password');
    this.privateKey = CryptoUtils.generatePrivateKeyFromSeed(seed);
    this.publicKey = CryptoUtils.publicKeyFromPrivateKey(this.privateKey);
    console.log('KEYS', this.privateKey, LocalAddress.fromPublicKey(this.publicKey).toString());
    let writeUrl = 'ws://127.0.0.1:46658/websocket'
    let readUrl = 'ws://127.0.0.1:46658/queryws'
    let networkId = 'default'

    if (process.env.NETWORK == 'extdev') {
      writeUrl = 'ws://extdev-plasma-us1.dappchains.com:80/websocket'
      readUrl = 'ws://extdev-plasma-us1.dappchains.com:80/queryws'
      networkId = 'extdev-plasma-us1'
    }

    this.client = new Client(networkId, writeUrl, readUrl)

    this.client.on('error', msg => {
      console.error('Error on connect to client', msg)
      console.warn('Please verify if loom command is running')
    })
  }

  _createCurrentUserAddress() {
    this.currentUserAddress = LocalAddress.fromPublicKey(this.publicKey).toString()
  }

  _createWebInstance() {
    this.web3 = new Web3(new LoomProvider(this.client, this.privateKey))
  }

  async _createContractInstance() {
    const networkId = await this._getCurrentNetwork()

    this.CUETokenInstance = new this.web3.eth.Contract(
      CUEToken.abi,
      CUEToken.networks[networkId].address,
      { from: this.currentUserAddress }
    )

    this.CUETipsInstance = new this.web3.eth.Contract(
      CUETips.abi,
      CUETips.networks[networkId].address,
      { from: this.currentUserAddress }
    )

    this.CUETipsInstance.events.TransferSuccessful((err, event) => {
      if (err) console.error('Error on event', err)
      else if (this.onEvent) {
        console.log('transfer successful', event);
        this.onEvent(event.returnValues)
      }
    })
  }

  addEventListener(fn) {
    this.onEvent = fn
  }

  async _getCurrentNetwork() {
    return Promise.resolve('9545242630824')
    // return Promise.resolve('default')
  }

  async getBalance() {
    return await this.CUETokenInstance.methods.balanceOf(this.currentUserAddress).call({
      from: this.currentUserAddress
    })
  }

  async tip(address, amount) {
    const approvalResponse = await this.CUETokenInstance.methods
      .approve(this.CUETipsInstance._address.toLowerCase(), (amount * coinMultiplier).toString())
      .send({ from: this.currentUserAddress.toLowerCase() })

    const response = await this.CUETipsInstance.methods
      .tip(address.toLowerCase(), (amount * coinMultiplier).toString())
      .send({ from: this.currentUserAddress.toLowerCase() })

    return response
  }

  // const allowanceResponse = await this.CUETokenInstance.methods
  //   .allowance(this.currentUserAddress.toLowerCase(), this.CUETipsInstance._address.toLowerCase())
  //   .call({ from: this.currentUserAddress.toLowerCase() })
  // console.log('allowance', allowanceResponse, (amount * coinMultiplier).toString());
}
