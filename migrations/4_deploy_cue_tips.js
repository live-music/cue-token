var CUETokenLoom = artifacts.require('CUETokenLoom');
var CUETips = artifacts.require('CUETips');

module.exports = function(deployer, network, accounts) {
  if (network === 'rinkeby' && network !== 'development') {
    return
  }

  deployer.then(async () => {
    await deployer.deploy(CUETips, CUETokenLoom.address);
    const CUETipsInstance = await CUETips.deployed()

    console.log('\n*************************************************************************\n')
    console.log(`CUE Tips Address: ${CUETipsInstance.address}`)
    console.log('\n*************************************************************************\n')
  })
};
