var CUETokenLoom = artifacts.require('CUETokenLoom');

const gatewayAddress = '0xe754d9518bf4a9c63476891ef9AA7d91C8236A5D';

module.exports = function(deployer, network, accounts) {
  if (network === 'rinkeby' && network !== 'development') {
    return
  }

  deployer.then(async () => {
    await deployer.deploy(CUETokenLoom, gatewayAddress)
    const CUETokenLoomInstance = await CUETokenLoom.deployed()

    console.log('\n*************************************************************************\n')
    console.log(`CUE Token Address: ${CUETokenLoomInstance.address}`)
    console.log('\n*************************************************************************\n')
  });
};