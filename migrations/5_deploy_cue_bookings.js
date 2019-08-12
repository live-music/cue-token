var CUETokenLoom = artifacts.require('CUETokenLoom');
var CUEBookings = artifacts.require('CUEBookings');

module.exports = function(deployer, network, accounts) {
  if (network === 'rinkeby' && network !== 'development') {
    return
  }

  deployer.then(async () => {
    await deployer.deploy(CUEBookings, CUETokenLoom.address);
    const CUEBookingsInstance = await CUEBookings.deployed()

    console.log('\n*************************************************************************\n')
    console.log(`CUE Bookings Address: ${CUEBookingsInstance.address}`)
    console.log('\n*************************************************************************\n')
  })
};
