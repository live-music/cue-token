var CUEBookings = artifacts.require('CUEBookings');
var CUEDisputeResolution = artifacts.require('CUEDisputeResolution');

module.exports = function(deployer, network, accounts) {
  if (network === 'rinkeby' && network !== 'development') {
    return
  }

  deployer.then(async () => {
    await CUEBookings.deployed(async instance => {
      await instance.setDisputeResolutionAddress(CUEDisputeResolution.address, { from: accounts[0] });
    })
  
    await CUEDisputeResolution.deployed(async instance => {
      await instance.setBookingsAddress(CUEBookings.address, { from: accounts[0] });
    })
  })
};
