const BigNumber = require('bignumber.js');
const moment = require('moment');
const CUEToken = artifacts.require('CUEToken');
const CUEBookings = artifacts.require('CUEBookings');
const CUEDisputeResolution = artifacts.require('CUEDisputeResolution')

const should = require('chai')
 .use(require('chai-as-promised'))
 .use(require('chai-bignumber'))
 .should();

contract('CUEDisputeResolution (PERFORMER)', async (accounts) => {
  let token, bookings, disputes;
  let CUE_WALLET, BOOKINGS_WALLET, DISPUTE_WALLET;
  let WALLET, AGENT_ADDRESS, PERFORMER_ADDRESS, ARBITRATOR_ONE, ARBITRATOR_TWO;
  [WALLET, AGENT_ADDRESS, PERFORMER_ADDRESS, ARBITRATOR_ONE, ARBITRATOR_TWO] = accounts;

  const now = moment(new Date());
  const ID = web3.utils.fromUtf8('1337');
  const PAY = new BigNumber(10e18);
  const DEPOSIT = PAY.div(10);
  const SHARE = DEPOSIT.div(2);
  const START_TIME = new moment(now).add('4', 'days');
  const END_TIME = new moment(START_TIME).add('4', 'hours');
  let agentBalance = new BigNumber(50e18);
  let performerBalance = new BigNumber(50e18);
  let cueBalance = new BigNumber(0);
  let bookingsBalance = new BigNumber(0);
  let disputeBalance = new BigNumber(0);

  const createBooking = async () => {
    await token.approve(bookings.address, PAY, { from: AGENT_ADDRESS });
    await bookings.newBooking(ID, PERFORMER_ADDRESS, PAY, START_TIME.unix(), END_TIME.unix(), { from: AGENT_ADDRESS });
    agentBalance = agentBalance.minus(PAY);
    bookingsBalance = bookingsBalance.plus(PAY);
  }
  
  const acceptBooking = async () => {
    await token.approve(bookings.address, DEPOSIT, { from: PERFORMER_ADDRESS });
    await bookings.acceptBooking(ID, { from: PERFORMER_ADDRESS });
    performerBalance = performerBalance.minus(DEPOSIT);
    bookingsBalance = bookingsBalance.plus(DEPOSIT);
  }

  const createDispute = async () => {
    await bookings.agentClaim(ID, { from: AGENT_ADDRESS });
    const agentClaim = await getBooking();
    agentClaim.status.should.equal('agent_claim');
    await bookings.performerClaim(ID, { from: PERFORMER_ADDRESS });
    bookingsBalance = bookingsBalance.minus(PAY).minus(DEPOSIT);
    disputeBalance = disputeBalance.plus(PAY).plus(DEPOSIT);
  }

  const getBooking = async () => {
    return await bookings.getBooking(ID);
  }

  const checkBalances = async () => {
    (await token.balanceOf(AGENT_ADDRESS)).toString().should.equal(agentBalance.toString());
    (await token.balanceOf(PERFORMER_ADDRESS)).toString().should.equal(performerBalance.toString());
    (await token.balanceOf(CUE_WALLET)).toString().should.equal(cueBalance.toString());
    (await token.balanceOf(BOOKINGS_WALLET)).toString().should.equal(bookingsBalance.toString());
    (await token.balanceOf(DISPUTE_WALLET)).toString().should.equal(disputeBalance.toString());
  }

  beforeEach(async () => {
    await CUEToken.deployed().then(instance => token = instance);
    await CUEDisputeResolution.deployed().then(instance => {
      disputes = instance
      DISPUTE_WALLET = instance.address;
    });

    await CUEBookings.deployed(CUEToken.address).then(async instance => {
      bookings = instance
      CUE_WALLET = await instance.CUEWallet();
      BOOKINGS_WALLET = instance.address;
    });
  });

  it('should set the owner for bookings and disputes', async () => {
    await bookings.setDisputeResolutionAddress(disputes.address, { from: WALLET });
    await disputes.setBookingsAddress(bookings.address, { from: WALLET });

    const bookingsAddress = await disputes.CUEBookingsAddress();
    bookingsAddress.should.equal(bookings.address);
    const bookingsOwner = await bookings.owner();
    bookingsOwner.should.equal(WALLET);

    const disputesOwner = await disputes.owner();
    disputesOwner.should.equal(bookings.address);
    const disputesAddress = await bookings.DisputeResolutionAddress();
    disputesAddress.should.equal(disputes.address);
  });

  it('should send 500 tokens to agent and performer', async () => {
    let balance;

    await token.transfer(AGENT_ADDRESS, agentBalance, { from: WALLET });
    balance = await token.balanceOf(AGENT_ADDRESS);
    balance.toString().should.equal(agentBalance.toString());

    await token.transfer(PERFORMER_ADDRESS, performerBalance, { from: WALLET });
    balance = await token.balanceOf(PERFORMER_ADDRESS);
    balance.toString().should.equal(performerBalance.toString());
  });
  
  it ('should create future successful booking', async () => {
    await createBooking();
    await acceptBooking();
    await checkBalances();

    bookings.addArbitrator(ARBITRATOR_ONE, web3.utils.fromUtf8('arbitrator 1'));
    bookings.addArbitrator(ARBITRATOR_TWO, web3.utils.fromUtf8('arbitrator 2'));
  });

  it('should adjust time forward to successful booking', async () => {
    const addTime = new moment(now).add('5', 'days');
    const timeAdjustment = addTime.unix() - now.unix();
    await web3.currentProvider.send({ id: '1', jsonrpc: '2.0', method: 'evm_increaseTime', params: [timeAdjustment] }, (err, result) => {});
    await web3.currentProvider.send({ id: '1', jsonrpc: '2.0', method: 'evm_mine' }, (err, result) => {});
  });

  it('should resolve dispute in favor of performer', async() => {
    await createDispute();
    await checkBalances();
    await disputes.resolveDispute(ID, true, { from: ARBITRATOR_TWO });
    cueBalance = cueBalance.plus(SHARE);
    performerBalance = performerBalance.plus(PAY).plus(SHARE);
    disputeBalance = disputeBalance.minus(PAY).minus(DEPOSIT);
    await checkBalances();
  });

  it('should remove all arbitrators', async() => {
    await bookings.removeArbitrator(ARBITRATOR_ONE);
    await bookings.removeArbitrator(ARBITRATOR_TWO);

    const arbitratorCount = await disputes.getArbitratorCount();
    arbitratorCount.toNumber().should.equal(0);
  });
});
