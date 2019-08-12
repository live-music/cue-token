const BigNumber = require('bignumber.js');
const CUEToken = artifacts.require('CUEToken');
const CUETips = artifacts.require('CUETips');

const should = require('chai')
 .use(require('chai-as-promised'))
 .use(require('chai-bignumber'))
 .should();

let token, transfer, cueWallet;

contract('CUEToken and CUETips', async (accounts) => {
  let accountA, accountB, accountC;
  [accountA, accountB, accountC] = accounts;

  beforeEach(async () => {
    await CUEToken.deployed().then(instance => token = instance);
    await CUETips.deployed(CUEToken.address).then(async instance => {
      transfer = instance
      cueWallet = await instance.CUEWallet();
    });
  });

  it('should transfer 500 tokens', async() => {
    const amount = new BigNumber(500e18);
    await token.transfer(accountB, amount, { from: accountA });
    const balance = await token.balanceOf(accountB);
    balance.toString().should.equal(amount.toString());
  });

  it('should approve and tip 30 tokens', async() => {
    let amount = new BigNumber(30e18);

    await token.approve(transfer.address, amount, { from: accountB });
    await transfer.tip(accountC, amount, { from: accountB });

    const shared = await token.balanceOf(cueWallet);
    shared.toString().should.equal(new BigNumber(15e18).toString());

    const tipped = await token.balanceOf(accountC);
    tipped.toString().should.equal(new BigNumber(15e18).toString());
  });
});
