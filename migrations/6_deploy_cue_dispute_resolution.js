var CUETokenLoom = artifacts.require('CUETokenLoom');
var CUEDisputeResolution = artifacts.require('CUEDisputeResolution');

module.exports = function(deployer, network, accounts) {
  if (network === 'rinkeby' && network !== 'development') {
    return
  }

  deployer.then(async () => {
    await deployer.deploy(CUEDisputeResolution, CUETokenLoom.address);
    const CUEDisputeResolutionInstance = await CUEDisputeResolution.deployed()

    console.log('\n*************************************************************************\n')
    console.log(`CUE Dispute Resolution Address: ${CUEDisputeResolutionInstance.address}`)
    console.log('\n*************************************************************************\n')
  })
};
