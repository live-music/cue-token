const BigNumber = require('bignumber.js');
const moment = require('moment');
const CUEToken = artifacts.require('CUEToken');
const CUEBookings = artifacts.require('CUEBookings');

const should = require('chai')
 .use(require('chai-as-promised'))
 .use(require('chai-bignumber'))
 .should();

contract('CUEBookings Penalize Performer', async (accounts) => {
  let token, bookings;
  let WALLET, AGENT_ADDRESS, PERFORMER_ADDRESS, CUE_WALLET, BOOKINGS_WALLET;
  [WALLET, AGENT_ADDRESS, PERFORMER_ADDRESS] = accounts;

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

  const getBooking = async () => {
    return await bookings.getBooking(ID);
  }

  const checkBalances = async () => {
    (await token.balanceOf(AGENT_ADDRESS)).toString().should.equal(agentBalance.toString());
    (await token.balanceOf(PERFORMER_ADDRESS)).toString().should.equal(performerBalance.toString());
    (await token.balanceOf(CUE_WALLET)).toString().should.equal(cueBalance.toString());
    (await token.balanceOf(BOOKINGS_WALLET)).toString().should.equal(bookingsBalance.toString());
  }

  beforeEach(async () => {
    await CUEToken.deployed().then(instance => token = instance);
    await CUEBookings.deployed(CUEToken.address).then(async instance => {
      bookings = instance
      CUE_WALLET = await instance.CUEWallet();
      BOOKINGS_WALLET = instance.address;
    });
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

  it ('should create future declined booking', async () => {
    await createBooking();
    await acceptBooking();
    await checkBalances();
  });

  it('should adjust time forward to within 48 hours of event', async () => {
    const addTime = new moment(now).add('2', 'days').add('12', 'hours');
    const timeAdjustment = addTime.unix() - now.unix();
    await web3.currentProvider.send({ id: '1', jsonrpc: '2.0', method: 'evm_increaseTime', params: [timeAdjustment] }, (err, result) => {});
    await web3.currentProvider.send({ id: '1', jsonrpc: '2.0', method: 'evm_mine' }, (err, result) => {});
  });

  it('should payout penalties for booked decline (PERFORMER)', async () => {
    await bookings.declineBooking(ID, { from: PERFORMER_ADDRESS });
    bookingsBalance = bookingsBalance.minus(PAY).minus(DEPOSIT);
    agentBalance = agentBalance.plus(PAY).plus(DEPOSIT);
    await checkBalances();

    const booking = await getBooking();
    booking.status.should.equal('performer_reject_penalty');
    booking.agent.should.equal(AGENT_ADDRESS);
    booking.performer.should.equal(PERFORMER_ADDRESS);
    booking.pay.toString().should.equal(PAY.toString());
    booking.deposit.toString().should.equal(DEPOSIT.toString());
    booking.startTime.toString().should.equal(START_TIME.unix().toString());
    booking.endTime.toString().should.equal(END_TIME.unix().toString());
  });
});
