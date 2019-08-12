var CUEToken = artifacts.require('CUEToken');

module.exports = function(deployer, network, accounts) {
  if (network !== 'rinkeby' && network !== 'development') {
    return
  }

  deployer.then(async () => {
    await deployer.deploy(CUEToken)
    const CUETokenInstance = await CUEToken.deployed()

    console.log('\n*************************************************************************\n')
    console.log(`CUE Token Address: ${CUETokenInstance.address}`)
    console.log('\n*************************************************************************\n')
  })
};