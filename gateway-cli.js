const Tx = require('ethereumjs-tx')
const Web3 = require('web3')
const program = require('commander')
const fs = require('fs')
const path = require('path')
const Base64 = require('js-base64').Base64;
const {
    Client, NonceTxMiddleware, SignedTxMiddleware, Address, LocalAddress, CryptoUtils, LoomProvider,
    Contracts, Web3Signer, soliditySha3, EvmContract
} = require('loom-js')
// TODO: fix this export in loom-js
const { OfflineWeb3Signer } = require('loom-js/dist/solidity-helpers')
const BN = require('bn.js')

const RinkebyGatewayJSON = require('./src/Gateway.json')
const CUETokenRinkebyJSON = require('./src/contracts/CUEToken.json')
const CUETokenJSON = require('./src/contracts/CUETokenLoom.json')
const CUETips = require('./src/contracts/CUETips.json')

const TransferGateway = Contracts.TransferGateway
const AddressMapper = Contracts.AddressMapper
const EthCoin = Contracts.EthCoin

// See https://loomx.io/developers/docs/en/testnet-plasma.html#contract-addresses-transfer-gateway
// for the most up to date address.
const rinkebyGatewayAddress = '0xb73C9506cb7f4139A4D6Ac81DF1e5b6756Fab7A2'
const extdevGatewayAddress = '0xE754d9518bF4a9C63476891eF9Aa7D91c8236a5d'
const extdevChainId = 'extdev-plasma-us1'

const coinMultiplier = new BN(10).pow(new BN(18))

async function getRinkebyCoinContract(web3js) {
  const networkId = await web3js.eth.net.getId()
  return new web3js.eth.Contract(
    CUETokenRinkebyJSON.abi,
    CUETokenRinkebyJSON.networks[networkId].address
  )
}

async function getRinkebyCoinContractAddress(web3js) {
  const networkId = await web3js.eth.net.getId()
  return CUETokenRinkebyJSON.networks[networkId].address
}

async function getRinkebyCoinBalance(web3js, accountAddress) {
  const contract = await getRinkebyCoinContract(web3js)
  const balance = await contract.methods
    .balanceOf(accountAddress)
    .call()
  return balance
}

async function getRinkebyEthBalance(web3js, accountAddress) {
  const balance = await web3js.eth.getBalance(accountAddress);
  return balance
}

async function depositCoinToRinkebyGateway(web3js, amount, ownerAccount, gas) {
  const contract = await getRinkebyCoinContract(web3js)
  const contractAddress = await getRinkebyCoinContractAddress(web3js)
  const gateway  = await getRinkebyGatewayContract(web3js)

  let gasEstimate = await contract.methods
    .approve(rinkebyGatewayAddress, amount.toString())
    .estimateGas({ from: ownerAccount })

  if (gasEstimate == gas) {
    throw new Error('Not enough enough gas, send more.')
  }

  await contract.methods
    .approve(rinkebyGatewayAddress, amount.toString())
    .send({ from: ownerAccount, gas: gasEstimate })

  gasEstimate = await gateway.methods
    .depositERC20(amount.toString(), contractAddress)
    .estimateGas({ from: ownerAccount, gas })
      console.log(gasEstimate)

  if (gasEstimate == gas) {
    throw new Error('Not enough enough gas, send more.')
  }
  
  return gateway.methods
    .depositERC20(amount.toString(), contractAddress)
    .send({ from: ownerAccount, gas: gasEstimate })
}

async function getExtdevCoinContract(web3js) {
  const networkId = await web3js.eth.net.getId()
  return new web3js.eth.Contract(
    CUETokenJSON.abi,
    CUETokenJSON.networks[networkId].address,
  )
}

async function getExtdevCoinBalance(web3js, accountAddress) {
  const contract = await getExtdevCoinContract(web3js)
  const addr = accountAddress.toLowerCase()
  const balance = await contract.methods
    .balanceOf(addr)
    .call({ from: addr })
  return balance
}

async function getExtdevTokenBalance(web3js, accountAddress) {
  const contract = await getExtdevTokenContract(web3js)
  const addr = accountAddress.toLowerCase()
  const total = await contract.methods
    .balanceOf(addr)
    .call({ from: addr })
  const tokens = []
  for (let i = 0; i < Math.min(total, 5); i++) {
    const tokenId = await contract.methods
      .tokenOfOwnerByIndex(addr, i)
      .call({ from: addr })
    tokens.push(tokenId)
  }
  return { total, tokens }
}

async function getExtdevTransferContract(web3js) {
  const networkId = await web3js.eth.net.getId()
  return new web3js.eth.Contract(
    CUETips.abi,
    CUETips.networks[networkId].address,
  )
}

async function getTokenContract(web3js) {
  const privateKeyStr = fs.readFileSync(path.join(__dirname, './extdev_private_key'), 'utf-8')
  const privateKey = CryptoUtils.B64ToUint8Array(privateKeyStr)
  const publicKey = CryptoUtils.publicKeyFromPrivateKey(privateKey)

  const client = new Client(
    extdevChainId,
    'wss://extdev-plasma-us1.dappchains.com/websocket',
    'wss://extdev-plasma-us1.dappchains.com/queryws'
  )
  // required middleware
  client.txMiddleware = [
    new NonceTxMiddleware(publicKey, client),
    new SignedTxMiddleware(privateKey)
  ]

  // console.log('got client', client);
  const contract = await getExtdevCoinContract(web3js)
  const contractAddr = contract._address;
  // const contractAddr = await client.getContractAddres('CUEToken')
  const callerAddr = new Address(client.chainId, LocalAddress.fromPublicKey(publicKey))
  return new EvmContract({
    contractAddr,
    callerAddr,
    client
  })
}

async function approveTransfer(web3js, accountAddress, amount) {
  const contract = await getExtdevCoinContract(web3js)
  const transferContract = await getExtdevTransferContract(web3js)
  const cueTipsAddress = transferContract._address.toLowerCase()
  const addr = accountAddress.toLowerCase()
  console.log('APPROVING:', cueTipsAddress, addr, amount);
  const response = await contract.methods
    .approve(cueTipsAddress, new BN(amount).mul(coinMultiplier).toString())
    .send({ from: addr })
  return response
}

async function initiateTransfer(web3js, accountAddress, recipient, amount) {
  const contract = await getExtdevTransferContract(web3js)
  const addr = accountAddress.toLowerCase()
  const recip = recipient.toLowerCase()
  console.log('TRANSFERRING:', addr, recip);
  const response = await contract.methods
    .tip(recip, new BN(amount).mul(coinMultiplier).toString(), 'test')
    .send({ from: addr })
  return response
}

async function allowance(web3js, accountAddress) {
  const contract = await getExtdevCoinContract(web3js)
  const transferContract = await getExtdevTransferContract(web3js)
  const cueTipsAddress = transferContract._address.toLowerCase()
  const addr = accountAddress.toLowerCase()
  console.log('CHECKING ALLOWANCE', addr, cueTipsAddress);
  console.log(web3js);
  const response = await contract.methods
  .allowance(addr, cueTipsAddress)
  .call({ from: addr })
  return response
}

// Returns a promise that will be resolved with a hex string containing the signature that must
// be submitted to the Ethereum Gateway to withdraw a token.
async function depositCoinToExtdevGateway({
  client, web3js, amount,
  ownerExtdevAddress, ownerRinkebyAddress,
  tokenExtdevAddress, tokenRinkebyAddress, timeout
}) {
  const ownerExtdevAddr = Address.fromString(`${client.chainId}:${ownerExtdevAddress}`)
  const gatewayContract = await TransferGateway.createAsync(client, ownerExtdevAddr)
  
  const coinContract = await getExtdevCoinContract(web3js)
  await coinContract.methods
    .approve(extdevGatewayAddress.toLowerCase(), amount.toString())
    .send({ from: ownerExtdevAddress })
  
  const ownerRinkebyAddr = Address.fromString(`eth:${ownerRinkebyAddress}`)
  const receiveSignedWithdrawalEvent = new Promise((resolve, reject) => {
    let timer = setTimeout(
      () => reject(new Error('Timeout while waiting for withdrawal to be signed')),
      timeout
    )
    const listener = event => {
      const tokenEthAddr = Address.fromString(`eth:${tokenRinkebyAddress}`)
      if (
        event.tokenContract.toString() === tokenEthAddr.toString() &&
        event.tokenOwner.toString() === ownerRinkebyAddr.toString()
      ) {
        clearTimeout(timer)
        timer = null
        gatewayContract.removeAllListeners(TransferGateway.EVENT_TOKEN_WITHDRAWAL)
        resolve(event)
      }
    }
    gatewayContract.on(TransferGateway.EVENT_TOKEN_WITHDRAWAL, listener)
  })

  const tokenExtdevAddr = Address.fromString(`${client.chainId}:${tokenExtdevAddress}`)
  await gatewayContract.withdrawERC20Async(amount, tokenExtdevAddr, ownerRinkebyAddr)
  console.log(`${amount.div(coinMultiplier).toString()} tokens deposited to DAppChain Gateway...`)

  const event = await receiveSignedWithdrawalEvent
  return CryptoUtils.bytesToHexAddr(event.sig)
}

async function getPendingWithdrawalReceipt(client, ownerAddress) {
  const ownerAddr = Address.fromString(`${client.chainId}:${ownerAddress}`)
  const gatewayContract = await TransferGateway.createAsync(client, ownerAddr)
  return gatewayContract.withdrawalReceiptAsync(ownerAddr)
}

async function getRinkebyGatewayContract(web3js) {
  const networkId = await web3js.eth.net.getId()
  return new web3js.eth.Contract(
    RinkebyGatewayJSON.abi,
    RinkebyGatewayJSON.networks[networkId].address
  )
}


async function withdrawCoinFromRinkebyGateway({ web3js, amount, accountAddress, signature, gas }) {
  const gatewayContract = await getRinkebyGatewayContract(web3js)
  const networkId = await web3js.eth.net.getId()

  const gasEstimate = await gatewayContract.methods
    .withdrawERC20(amount.toString(), signature, CUETokenRinkebyJSON.networks[networkId].address)
    .estimateGas({ from: accountAddress, gas })

  if (gasEstimate == gas) {
    throw new Error('Not enough enough gas, send more.')
  }

  return gatewayContract.methods
    .withdrawERC20(amount.toString(), signature, CUETokenRinkebyJSON.networks[networkId].address)
    .send({ from: accountAddress, gas: gasEstimate })
}

async function transferCoinToRinkebyAccount({ web3js, amount, accountAddress, recipient, gas }) {
  const contract = await getRinkebyCoinContract(web3js)
  const addr = accountAddress.toLowerCase()
  const recip = recipient.toLowerCase()

  console.log(`Transferring ${ amount.toString() } to ${ recip } from ${ addr }`)

  const response = await contract.methods
    .transfer(recip, amount.toString())
    .send({ from: addr, gas })
  return response
}

function loadRinkebyAccount() {
  const privateKey = fs.readFileSync(path.join(__dirname, './rinkeby_private_key'), 'utf-8')
  const web3js = new Web3(`https://rinkeby.infura.io/${process.env.INFURA_API_KEY}`)
  const ownerAccount = web3js.eth.accounts.privateKeyToAccount('0x' + privateKey)
  web3js.eth.accounts.wallet.add(ownerAccount)
  return { account: ownerAccount, web3js }
}

function loadExtdevAccount() {
  const privateKeyStr = fs.readFileSync(path.join(__dirname, './extdev_private_key'), 'utf-8')
  const privateKey = CryptoUtils.B64ToUint8Array(privateKeyStr)
  const publicKey = CryptoUtils.publicKeyFromPrivateKey(privateKey)
  const client = new Client(
    extdevChainId,
    'wss://extdev-plasma-us1.dappchains.com/websocket',
    'wss://extdev-plasma-us1.dappchains.com/queryws'
  )
  client.txMiddleware = [
    new NonceTxMiddleware(publicKey, client),
    new SignedTxMiddleware(privateKey)
  ]
  client.on('error', msg => {
    console.error('PlasmaChain connection error', msg)
  })
 
  return {
    account: LocalAddress.fromPublicKey(publicKey).toString(),
    web3js: new Web3(new LoomProvider(client, privateKey)),
    client
  }
}

function loadRinkebyCustomAccount() {
  const privateKey = fs.readFileSync(path.join(__dirname, './custom_rinkeby_private_key'), 'utf-8')
  const web3js = new Web3(`https://rinkeby.infura.io/${process.env.INFURA_API_KEY}`)
  const ownerAccount = web3js.eth.accounts.privateKeyToAccount('0x' + privateKey)
  web3js.eth.accounts.wallet.add(ownerAccount)
  return { account: ownerAccount, web3js }
}

function loadExtdevCustomAccount() {
  const privateKeyStr = fs.readFileSync(path.join(__dirname, './custom_extdev_private_key'), 'utf-8')
  const privateKey = CryptoUtils.B64ToUint8Array(privateKeyStr)
  const publicKey = CryptoUtils.publicKeyFromPrivateKey(privateKey)
  const client = new Client(
    extdevChainId,
    'wss://extdev-plasma-us1.dappchains.com/websocket',
    'wss://extdev-plasma-us1.dappchains.com/queryws'
  )
  client.txMiddleware = [
    new NonceTxMiddleware(publicKey, client),
    new SignedTxMiddleware(privateKey)
  ]
  client.on('error', msg => {
    console.error('PlasmaChain connection error', msg)
  })
 
  return {
    account: LocalAddress.fromPublicKey(publicKey).toString(),
    web3js: new Web3(new LoomProvider(client, privateKey)),
    client
  }
}

async function mapContracts({
  client,
  signer,
  tokenRinkebyAddress,
  tokenExtdevAddress,
  ownerExtdevAddress,
  rinkebyTxHash
}) {
  const ownerExtdevAddr = Address.fromString(`${client.chainId}:${ownerExtdevAddress}`)
  const gatewayContract = await TransferGateway.createAsync(client, ownerExtdevAddr)
  const foreignContract = Address.fromString(`eth:${tokenRinkebyAddress}`)
  const localContract = Address.fromString(`${client.chainId}:${tokenExtdevAddress}`)
  
  const hash = soliditySha3(
    { type: 'address', value: tokenRinkebyAddress.slice(2) },
    { type: 'address', value: tokenExtdevAddress.slice(2) }
  )

  const foreignContractCreatorSig = await signer.signAsync(hash)
  const foreignContractCreatorTxHash = Buffer.from(rinkebyTxHash.slice(2), 'hex')

  await gatewayContract.addContractMappingAsync({
    localContract,
    foreignContract,
    foreignContractCreatorSig,
    foreignContractCreatorTxHash
  })
}

async function mapAccounts({ client, signer, ownerRinkebyAddress, ownerExtdevAddress }) {
  const ownerRinkebyAddr = Address.fromString(`eth:${ownerRinkebyAddress}`)
  const ownerExtdevAddr = Address.fromString(`${client.chainId}:${ownerExtdevAddress}`)
  const mapperContract = await AddressMapper.createAsync(client, ownerExtdevAddr)
  
  try {
    const mapping = await mapperContract.getMappingAsync(ownerExtdevAddr)
    console.log(`${mapping.from.toString()} is already mapped to ${mapping.to.toString()}`)
    return
  } catch (err) {
    // assume this means there is no mapping yet, need to fix loom-js not to throw in this case
  }
  console.log(`mapping ${ownerRinkebyAddr.toString()} to ${ownerExtdevAddr.toString()}`)
  await mapperContract.addIdentityMappingAsync(ownerExtdevAddr, ownerRinkebyAddr, signer)
  console.log(`Mapped ${ownerExtdevAddr} to ${ownerRinkebyAddr}`)
}

program
  .command('deposit-coin <amount>')
  .description('deposit the specified amount of ERC20 tokens into the Transfer Gateway')
  .option("-a, --account <number>", "Account for the deposit")
  .option("-g, --gas <number>", "Gas for the tx")
  .action(async function(amount, options) {
    let account, web3js;
    if (options.account) {
      const rinkeby = loadRinkebyCustomAccount()
      account = rinkeby.account;
      web3js = rinkeby.web3js;
    } else {
      const rinkeby = loadRinkebyAccount()
      account = rinkeby.account;
      web3js = rinkeby.web3js;
    }
    try {
      const actualAmount = new BN(amount).mul(coinMultiplier)
      const tx = await depositCoinToRinkebyGateway(
        web3js, actualAmount, account.address, options.gas || 350000
      )
      console.log(`${amount} tokens deposited to Ethereum Gateway.`)
      console.log(`Rinkeby tx hash: ${tx.transactionHash}`)
    } catch (err) {
      console.error(err)
    }
  })


program
  .command('withdraw-coin <amount>')
  .description('withdraw the specified amount of ERC20 tokens via the Transfer Gateway')
  .option("-g, --gas <number>", "Gas for the tx")
  .option("-a, --account <number>", "Account for the tx")
  .option("--timeout <number>", "Number of seconds to wait for withdrawal to be processed")
  .action(async function(amount, options) {
    let client
    try {
      let extdev, rinkeby;
      if (options.account) {
        rinkeby = loadRinkebyCustomAccount()
        extdev = loadExtdevCustomAccount()
      } else {
        extdev = loadExtdevAccount()
        rinkeby = loadRinkebyAccount()
      }

      client = extdev.client

      const actualAmount = new BN(amount).mul(coinMultiplier)
      const rinkebyNetworkId = await rinkeby.web3js.eth.net.getId()
      const extdevNetworkId = await extdev.web3js.eth.net.getId()
      const signature = await depositCoinToExtdevGateway({
        client: extdev.client,
        web3js: extdev.web3js,
        amount: actualAmount,
        ownerExtdevAddress: extdev.account,
        ownerRinkebyAddress: rinkeby.account.address,
        tokenExtdevAddress: CUETokenJSON.networks[extdevNetworkId].address,
        tokenRinkebyAddress: CUETokenRinkebyJSON.networks[rinkebyNetworkId].address,
        timeout: options.timeout ? (options.timeout * 1000) : 120000
      })

      const tx = await withdrawCoinFromRinkebyGateway({
        web3js: rinkeby.web3js,
        amount: actualAmount,
        accountAddress: rinkeby.account.address,
        signature,
        gas: options.gas || 350000
      })

      console.log(`${amount} tokens withdrawn from Ethereum Gateway.`)
      console.log(`Rinkeby tx hash: ${tx.transactionHash}`)
    } catch (err) {
      console.error(err)
    } finally {
      if (client) {
        client.disconnect()
      }
    }
  })

program
  .command('resume-withdrawal')
  .description('attempt to complete a pending withdrawal via the Transfer Gateway')
  .option("-a, --account <number>", "Account for the tx")
  .option("-g, --gas <number>", "Gas for the tx")
  .action(async function(options) {
    let client, rinkeby, extdev
    try {
      if (options.account) {
        rinkeby = loadRinkebyCustomAccount()
        extdev = loadExtdevCustomAccount()
      } else {
        extdev = loadExtdevAccount()
        rinkeby = loadRinkebyAccount()
      }
      client = extdev.client

      const networkId = await rinkeby.web3js.eth.net.getId()
      const myRinkebyCoinAddress = Address.fromString(`eth:${CUETokenRinkebyJSON.networks[networkId].address}`)
      const myRinkebyGatewayAddress = Address.fromString(`eth:${rinkebyGatewayAddress}`)
      const receipt = await getPendingWithdrawalReceipt(extdev.client, extdev.account)
      const signature = CryptoUtils.bytesToHexAddr(receipt.oracleSignature)

      if (receipt.tokenContract.toString() === myRinkebyCoinAddress.toString()) {
        const tx = await withdrawCoinFromRinkebyGateway({
          web3js: rinkeby.web3js,
          amount: receipt.tokenAmount,
          accountAddress: rinkeby.account.address,
          signature,
          gas: options.gas || 350000
        })
        console.log(`${receipt.tokenAmount.div(coinMultiplier).toString()} tokens withdrawn from Etheruem Gateway.`)
        console.log(`Rinkeby tx hash: ${tx.transactionHash}`)
      } else {
        console.log("Unsupported asset type!")
      }
    } catch (err) {
      console.error(err)
    } finally {
      if (client) {
        client.disconnect()
      }
    }
  })

program
  .command('tip-cue <amount>')
  .description('Transfer tokens to another user with CUE receiving share for royalties')
  .option('-a, --account <hex address> | gateway', 'Account address')
  .action(async function(amount, options) {
    try {
      let ownerAddress
      const { account, web3js, client } = loadExtdevAccount()
      ownerAddress = account

      console.log('getting extdev account', ownerAddress);
      try {
        const approval = await approveTransfer(web3js, ownerAddress, amount)
        console.log('got approval response', approval);
        let recipient = options.account;
        const transfer = await initiateTransfer(web3js, ownerAddress, recipient, amount)
        console.log('got transfer response', transfer);
      } catch (err) {
        throw err
      } finally {
        client.disconnect()
      }
    } catch (err) {
      console.error(err)
    }
  })

program
  .command('cue-allowance')
  .description('Transfer tokens to another user with CUE receiving share for royalties')
  .option('-a, --account <hex address> | gateway', 'Account address')
  .action(async function(amount, options) {
    try {
      let ownerAddress, balance
      const { account, web3js, client } = loadExtdevAccount()
      ownerAddress = account
      try {
        balance = await allowance(web3js, ownerAddress)
        console.log('GOT ALLOWANCE', balance);
      } catch (err) {
        throw err
      } finally {
        client.disconnect()
      }
    } catch (err) {
      console.error(err)
    }
  })


program
  .command('coin-balance')
  .description('display the current ERC20 token balance for an account')
  .option('-c, --chain <chain ID>', '"eth" for Rinkeby, "extdev" for PlasmaChain')
  .option('-a, --account <hex address> | gateway', 'Account address')
  .action(async function(options) {
    try {
      let ownerAddress, balance
      if (options.chain === 'eth') {
        const { account, web3js } = loadRinkebyAccount()
        ownerAddress = account.address
        if (options.account) {
          ownerAddress = (options.account === 'gateway') ? rinkebyGatewayAddress : options.account
        }
        balance = await getRinkebyCoinBalance(web3js, ownerAddress)
      } else {
        const { account, web3js, client } = loadExtdevAccount()
        ownerAddress = account
        if (options.account) {
          ownerAddress = (options.account === 'gateway') ? extdevGatewayAddress : options.account
        }
        console.log('getting extdev account', ownerAddress);
        try {
          balance = await getExtdevCoinBalance(web3js, ownerAddress)
        } catch (err) {
          throw err
        } finally {
          client.disconnect()
        }
      }
    console.log(`${ownerAddress} balance is ${new BN(balance).div(coinMultiplier).toString() }`)
    } catch (err) {
      console.error(err)
    }
  })

program
  .command('map-contracts <contract-type>')
  .description('maps contracts')
  .action(async function(contractType, options) {
    let client
    try {
      const rinkeby = loadRinkebyAccount()
      const extdev = loadExtdevAccount()
      client = extdev.client
      const rinkebyNetworkId = await rinkeby.web3js.eth.net.getId()
      const extdevNetworkId = await extdev.web3js.eth.net.getId()

      let tokenRinkebyAddress, tokenExtdevAddress, rinkebyTxHash
      if (contractType === 'coin') {
        tokenRinkebyAddress = CUETokenRinkebyJSON.networks[rinkebyNetworkId].address
        rinkebyTxHash = CUETokenRinkebyJSON.networks[rinkebyNetworkId].transactionHash
        tokenExtdevAddress = CUETokenJSON.networks[extdevNetworkId].address
      } else if (contractType === 'token') {
        tokenRinkebyAddress = MyRinkebyTokenJSON.networks[rinkebyNetworkId].address
        rinkebyTxHash = MyRinkebyTokenJSON.networks[rinkebyNetworkId].transactionHash
        tokenExtdevAddress = MyTokenJSON.networks[extdevNetworkId].address
      } else {
        console.log('Specify which contracts you wish to map, "coin" or "token"')
        return
      }
      
      const signer = new OfflineWeb3Signer(rinkeby.web3js, rinkeby.account)
      await mapContracts({
        client,
        signer,
        tokenRinkebyAddress,
        tokenExtdevAddress,
        ownerExtdevAddress: extdev.account,
        rinkebyTxHash
      })
      console.log(`Submitted request to map ${tokenExtdevAddress} to ${tokenRinkebyAddress}`)
    } catch (err) {
      console.error(err)
    } finally {
      if (client) {
        client.disconnect()
      }
    }
  })

program
  .command('map-accounts')
  .option('-c, --custom <chain ID>', 'Map secondary accounts')
  .description('maps accounts')
  .action(async function(options) {
    console.log('map options', options);
    let client, rinkeby, extdev
    try {
      if (options.custom) {
        rinkeby = loadRinkebyCustomAccount()
        extdev = loadExtdevCustomAccount()
        client = extdev.client
      } else {
        rinkeby = loadRinkebyAccount()
        extdev = loadExtdevAccount()
        client = extdev.client
      }

      const signer = new OfflineWeb3Signer(rinkeby.web3js, rinkeby.account)
      await mapAccounts({
        client,
        signer,
        ownerRinkebyAddress: rinkeby.account.address,
        ownerExtdevAddress: extdev.account
      })
    } catch (err) {
      console.error(err)
    } finally {
      if (client) {
        client.disconnect()
      }
    }
  })

program
  .version('0.1.0')
  .parse(process.argv)
