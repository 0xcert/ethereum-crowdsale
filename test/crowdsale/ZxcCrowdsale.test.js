const assertRevert = require('@0xcert/ethereum-utils/test/helpers/assertRevert');
const { advanceBlock } = require('../helpers/advanceToBlock');
const { increaseTime, increaseTimeTo, duration } = require('../helpers/increaseTime');
const latestTime = require('../helpers/latestTime');
const ether = require('../helpers/ether');

const BigNumber = web3.BigNumber;

const ZxcCrowdsale = artifacts.require('ZxcCrowdsale');
const ZxcCrowdsaleTestable = artifacts.require('../mocks/ZxcCrowdsaleTestable.sol');
const ZxcBigDecimals = artifacts.require('../mocks/ZxcBigDecimals.sol');
const Zxc = artifacts.require('@0xcert/ethereum-zxc/contracts/tokens/Zxc.sol');


contract('crowdsale/ZxcCrowdsale', (accounts) => {
  const decimalsMul = new BigNumber('1e+18');  // 10 ** 18
  const rate = new BigNumber(10000);  // 1 ETH = 10,000 ZXC
  const crowdSaleZxcCap = new BigNumber(250000001).mul(decimalsMul);  // 250M + 1, 18 decimals
  const minimumWeiDeposit = ether(1);
  let startTimePresale;
  let startTimeSaleWithBonus;
  let startTimeSaleNoBonus;
  let endTime;

  const bonusDividend = new BigNumber(100);  // 100%
  const bonusPresale = new BigNumber(10);  // 10%
  // 100% / 10% = 10 <-- which we use to calc bonus: tokenAmount / 10
  const bonusPresaleDivisor = bonusDividend.div(bonusPresale);

  const bonusSale = new BigNumber(5);  // 5%
  // 100% / 20% = 5 <-- which we use to calc bonus: tokenAmount / 5
  const bonusSaleDivisor = bonusDividend.div(bonusSale);

  const crowdsaleOwner = accounts[1];
  const tokenOwner = accounts[2];
  const wallet = accounts[3];
  const buyerOne = accounts[4];
  const buyerTwo = accounts[5];
  const _tester = accounts[6];  // tester should never be the default account!

  let token;
  let crowdsale;

  before(async () => {
    // Advance to the next block to correctly read time in the solidity "now"
    // function interpreted by testrpc
    await advanceBlock();
  });

  describe('ZxcCrowdsale constructor', function() {
    before(async () => {
      startTimePresale = latestTime() + duration.hours(1);
      startTimeSaleWithBonus = latestTime() + duration.hours(5);
      startTimeSaleNoBonus = latestTime() + duration.hours(8);
      endTime = latestTime() + duration.hours(12);
    });

    beforeEach(async () => {
      token = await Zxc.new({from: tokenOwner});
      crowdsale = await ZxcCrowdsale.new(wallet,
                                        token.address,
                                        startTimePresale,
                                        startTimeSaleWithBonus,
                                        startTimeSaleNoBonus,
                                        endTime,
                                        rate,
                                        crowdSaleZxcCap,
                                        bonusPresale,
                                        bonusSale,
                                        minimumWeiDeposit,
                                        {from: crowdsaleOwner});
    });

    it('time stages should be correct and in the right order', async () => {
      const actualPresaleTime = await crowdsale.startTimePresale.call();
      const actualSaleWithBonusTime = await crowdsale.startTimeSaleWithBonus.call();
      const actualSaleNoBonusTime = await crowdsale.startTimeSaleNoBonus.call();
      const actualEndTime = await crowdsale.endTime.call();
      assert.ok(actualPresaleTime < actualSaleWithBonusTime < actualSaleNoBonusTime < actualEndTime);
      assert.strictEqual(actualPresaleTime.toNumber(), startTimePresale);
      assert.strictEqual(actualSaleWithBonusTime.toNumber(), startTimeSaleWithBonus);
      assert.strictEqual(actualSaleNoBonusTime.toNumber(), startTimeSaleNoBonus);
      assert.strictEqual(actualEndTime.toNumber(), endTime);
    });

    it('constructor should set correct wallet address', async () => {
      assert.strictEqual(await crowdsale.wallet.call(), wallet);
    });

    it('constructor should set correct token address', async () => {
      assert.strictEqual(await crowdsale.token.call(), token.address);
    });

    it('constructor should set correct rate', async () => {
      const actualRate = await crowdsale.rate.call();
      //assert.strictEqual(actualRate.toString(), rate.mul(decimalsMul).toString());
      assert.strictEqual(actualRate.toString(), rate.toString());
    });

    it('constructor should set correct crowdSaleZxcCap', async () => {
      const actualCap = await crowdsale.crowdSaleZxcCap.call();
      assert.strictEqual(actualCap.toString(), crowdSaleZxcCap.toString());
    });

    it('constructor should set correct bonusPresale', async () => {
      const actualBonusPresale = await crowdsale.bonusPresale.call();
      assert.strictEqual(actualBonusPresale.toString(), bonusPresale.toString());
    });

    it('constructor should set correct bonusSale', async () => {
      const actualBonusSale = await crowdsale.bonusSale.call();
      assert.strictEqual(actualBonusSale.toString(), bonusSale.toString());
    });

    it('constructor should set correct minimumWeiDeposit', async () => {
      const actualMinDeposit = await crowdsale.minimumWeiDeposit.call();
      assert.strictEqual(actualMinDeposit.toString(), minimumWeiDeposit.toString());
    });

    it('constructor should set correct zxcSold value', async () => {
      const actualTokensSold = await crowdsale.zxcSold.call();
      assert.strictEqual(actualTokensSold.toString(), new BigNumber(0).toString());
    });

    it('constructor should fail with start time in the past', async () => {
      const firstStageStartPast = latestTime() - duration.weeks(1);
      await assertRevert(ZxcCrowdsale.new(wallet,
                                          token.address,
                                          firstStageStartPast,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          crowdSaleZxcCap,
                                          bonusPresale,
                                          bonusSale,
                                          minimumWeiDeposit));
    });
    it('constructor should fail with wallet address set to 0', async () => {
      await assertRevert(ZxcCrowdsale.new(0,
                                          token.address,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          crowdSaleZxcCap,
                                          bonusPresale,
                                          bonusSale,
                                          minimumWeiDeposit));
    });

    it('constructor should set correct wallet address', async () => {
      const _crowdsale = await ZxcCrowdsale.new(wallet,
                                                token.address,
                                                startTimePresale,
                                                startTimeSaleWithBonus,
                                                startTimeSaleNoBonus,
                                                endTime,
                                                rate,
                                                crowdSaleZxcCap,
                                                bonusPresale,
                                                bonusSale,
                                                minimumWeiDeposit);
      assert.strictEqual(await _crowdsale.wallet.call(), wallet);
    });

    it('constructor should fail with token address set to 0', async () => {
      await assertRevert(ZxcCrowdsale.new(wallet,
                                          0,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          crowdSaleZxcCap,
                                          bonusPresale,
                                          bonusSale,
                                          minimumWeiDeposit));
    });

    it('constructor should fail if wallet address equals token address', async () => {
      await assertRevert(ZxcCrowdsale.new(token.address,
                                          token.address,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          crowdSaleZxcCap,
                                          bonusPresale,
                                          bonusSale,
                                          minimumWeiDeposit));
    });

    it('constructor should fail if bonusPresale == 0', async () => {
      await assertRevert(ZxcCrowdsale.new(wallet,
                                          token.address,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          crowdSaleZxcCap,
                                          0,
                                          bonusSale,
                                          minimumWeiDeposit));
    });

    it('constructor should fail if bonusPresale > 100', async () => {
      await assertRevert(ZxcCrowdsale.new(wallet,
                                          token.address,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          crowdSaleZxcCap,
                                          101,
                                          bonusSale,
                                          minimumWeiDeposit));
    });

    it('constructor should fail if bonusSale == 0', async () => {
      await assertRevert(ZxcCrowdsale.new(wallet,
                                          token.address,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          crowdSaleZxcCap,
                                          bonusPresale,
                                          0,
                                          minimumWeiDeposit));
    });

    it('constructor should fail if bonusSale > 100', async () => {
      await assertRevert(ZxcCrowdsale.new(wallet,
                                          token.address,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          crowdSaleZxcCap,
                                          bonusPresale,
                                          101,
                                          minimumWeiDeposit));
    });

    it('constructor should fail with rate set to zero', async () => {
      await assertRevert(ZxcCrowdsale.new(wallet,
                                          token.address,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          0,
                                          crowdSaleZxcCap,
                                          bonusPresale,
                                          bonusSale,
                                          minimumWeiDeposit));
    });

    it('constructor should fail if token decimals != 18', async () => {
      let _token = await ZxcBigDecimals.new({from: tokenOwner});
      await assertRevert(ZxcCrowdsale.new(wallet,
                                          _token.address,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          crowdSaleZxcCap,
                                          bonusPresale,
                                          bonusSale,
                                          minimumWeiDeposit));
    });

    it('constructor should fail with zero crowdsale cap', async () => {
      await assertRevert(ZxcCrowdsale.new(wallet,
                                          token.address,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          0,
                                          bonusPresale,
                                          bonusSale,
                                          minimumWeiDeposit));
    });

    it('constructor should fail with too low minimumWeiDeposit', async () => {
      await assertRevert(ZxcCrowdsale.new(wallet,
                                          token.address,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          crowdSaleZxcCap,
                                          bonusPresale,
                                          bonusSale,
                                          0));
    });
  });

  describe('ZxcCrowdsale helper functions', function() {
    beforeEach(async () => {
      // We need to restart start times for each test or EVM will fail spectacularly.
      startTimePresale = latestTime() + duration.hours(1);
      startTimeSaleWithBonus = latestTime() + duration.hours(5);
      startTimeSaleNoBonus = latestTime() + duration.hours(8);
      endTime = latestTime() + duration.hours(12);

      token = await Zxc.new({from: tokenOwner});
      crowdsale = await ZxcCrowdsaleTestable.new(wallet,
                                                 token.address,
                                                 startTimePresale,
                                                 startTimeSaleWithBonus,
                                                 startTimeSaleNoBonus,
                                                 endTime,
                                                 rate,
                                                 crowdSaleZxcCap,
                                                 bonusPresale,
                                                 bonusSale,
                                                 minimumWeiDeposit,
                                                 _tester,
                                                 {from: crowdsaleOwner});
    });

    it('hasEnded should return false if crowdsale not started, cap not reached', async () => {
      assert.strictEqual(await crowdsale.hasEnded(), false);
    });

    it('hasEnded should return false if crowdsale in private sale stage, cap not reached', async () => {
      await increaseTimeTo(startTimePresale + duration.seconds(30));
      assert.strictEqual(await crowdsale.hasEnded(), false);
    });

    it('hasEnded should return false if in crowdsale in bonus stage, cap not reached', async () => {
      await increaseTimeTo(startTimeSaleWithBonus + duration.seconds(30));
      assert.strictEqual(await crowdsale.hasEnded(), false);
    });

    it('hasEnded should return false if in crowdsale in no bonus stage, cap not reached', async () => {
      await increaseTimeTo(startTimeSaleNoBonus + duration.seconds(30));
      assert.strictEqual(await crowdsale.hasEnded(), false);
    });

    it('hasEnded should return true if crowdsale time ran out, cap not reached', async () => {
      await increaseTimeTo(endTime + duration.seconds(30));
      assert.strictEqual(await crowdsale.hasEnded(), true);
    });

    it('hasEnded should return true if crowdsale reached the cap, end time not reached', async () => {
      await increaseTimeTo(startTimePresale + duration.seconds(30));
      crowdsale._testSetZxcSold(crowdSaleZxcCap, {from: _tester})
      assert.strictEqual(await crowdsale.hasEnded(), true);
    });

    it('hasEnded should return true if crowdsale reached the cap and end time', async () => {
      await increaseTimeTo(endTime + duration.seconds(30));
      crowdsale._testSetZxcSold(crowdSaleZxcCap, {from: _tester})
      assert.strictEqual(await crowdsale.hasEnded(), true);
    });

    it('isPrivatePresale should return true if in private sale stage', async () => {
      await increaseTimeTo(startTimePresale + duration.seconds(30));
      assert.strictEqual(await crowdsale.isPrivatePresaleWrapper(), true);
    });

    it('isPrivatePresale should return false if not in private sale stage', async () => {
      // Test before we hit the stage
      assert.strictEqual(await crowdsale.isPrivatePresaleWrapper(), false);
      await increaseTimeTo(startTimeSaleWithBonus + duration.seconds(30));
      assert.strictEqual(await crowdsale.isPrivatePresaleWrapper(), false);
    });

    it('isPublicSaleWithBonus should return true if in public bonus stage', async () => {
      await increaseTimeTo(startTimeSaleWithBonus + duration.seconds(30));
      assert.strictEqual(await crowdsale.isPublicSaleWithBonusWrapper(), true);
    });

    it('isPublicSaleWithBonus should return false if not in public bonus stage', async () => {
      // Test before we hit the stage
      assert.strictEqual(await crowdsale.isPublicSaleWithBonusWrapper(), false);
      await increaseTimeTo(startTimeSaleNoBonus + duration.seconds(30));
      assert.strictEqual(await crowdsale.isPublicSaleWithBonusWrapper(), false);
    });

    it('isPublicSaleNoBonus should return true if in public no bonus stage', async () => {
      await increaseTimeTo(startTimeSaleNoBonus + duration.seconds(30));
      assert.strictEqual(await crowdsale.isPublicSaleNoBonusWrapper(), true);
    });

    it('isPublicSaleNoBonus should return false if not in public no bonus stage', async () => {
      // Test before we hit the stage
      assert.strictEqual(await crowdsale.isPublicSaleNoBonusWrapper(), false);
      await increaseTimeTo(endTime + duration.seconds(30));
      assert.strictEqual(await crowdsale.isPublicSaleNoBonusWrapper(), false);
    });

    it('getTokenAmount should return correct num of tokens if in private presale stage', async () => {
      await increaseTimeTo(startTimePresale + duration.seconds(30));
      // 5.1 ETH = 51000 ZXC
      // 10% bonus: 51000 / 10 = 5100 ZXC
      // Total: 56100.0 ZXC
      let weiAmount = ether(5.1);
      let expectedTokens = weiAmount.mul(rate);
      let expectedBonus =  expectedTokens.div(bonusPresaleDivisor);
      let actualTokens = await crowdsale.getTokenAmountWrapper(weiAmount, {from: buyerOne});
      assert.strictEqual(actualTokens.toString(), expectedTokens.add(expectedBonus).toString());
      // Sanity check
      assert.strictEqual(actualTokens.toString(), '5.61e+22');
      assert.strictEqual(actualTokens.div(decimalsMul).toString(), '56100');
    });

    it('getTokenAmount should return correct num of tokens if in public bonus stage', async () => {
      await increaseTimeTo(startTimeSaleWithBonus + duration.seconds(30));
      // 7.192012 ETH = 71920.12 ZXC
      // 5% bonus: 71920.12 / 20 = 3596.006 ZXC
      // Total: 75516.126 ZXC
      let weiAmount = ether(7.192012);
      let expectedTokens = weiAmount.mul(rate);
      let expectedBonus =  expectedTokens.div(bonusSaleDivisor);
      let actualTokens = await crowdsale.getTokenAmountWrapper(weiAmount, {from: buyerOne});
      assert.strictEqual(actualTokens.toString(),
                         expectedTokens.add(expectedBonus).toString());
      // Sanity check
      assert.strictEqual(actualTokens.toString(), '7.5516126e+22');
      assert.strictEqual(actualTokens.div(decimalsMul).toString(), '75516.126');
    });

    it('getTokenAmount should return correct num of tokens if in public no bonus stage', async () => {
      await increaseTimeTo(startTimeSaleNoBonus + duration.seconds(30));
      // 9.8639 ETH = 98639 ZXC
      let weiAmount = ether(9.8639);
      let expectedTokens = weiAmount.mul(rate);
      let actualTokens = await crowdsale.getTokenAmountWrapper(weiAmount, {from: buyerOne});
      assert.strictEqual(actualTokens.toString(),
                         expectedTokens.toString());
      // Sanity check
      assert.strictEqual(actualTokens.toString(), '9.8639e+22');
      assert.strictEqual(actualTokens.div(decimalsMul).toString(), '98639');
    });

    it('getTokenAmount should revert if sale has not started yet', async () => {
      let weiAmount = ether(19.8);
      await assertRevert(crowdsale.getTokenAmountWrapper(weiAmount, {from: buyerOne}));
    });

    it('getTokenAmount should revert if sale has ended', async () => {
      await increaseTimeTo(endTime + duration.seconds(30));
      let weiAmount = ether(19.8);
      await assertRevert(crowdsale.getTokenAmountWrapper(weiAmount, {from: buyerOne}));
    });

    it('forwardFunds should send ether to wallet address', async () => {
      let weiAmount = ether(1.2);
      let initialBalance = await web3.eth.getBalance(wallet);
      await crowdsale.forwardFundsWrapper({from: buyerOne, value: weiAmount});
      let newBalance = await web3.eth.getBalance(wallet);
      assert.strictEqual(newBalance.sub(initialBalance).toString(), ether(1.2).toString());
    });
  });

  describe('ZxcCrowdsale purchase tokens', function() {
    beforeEach(async () => {
      // We need to restart start times for each test or EVM will fail spectacularly.
      startTimePresale = latestTime() + duration.hours(1);
      startTimeSaleWithBonus = latestTime() + duration.hours(5);
      startTimeSaleNoBonus = latestTime() + duration.hours(8);
      endTime = latestTime() + duration.hours(12);

      token = await Zxc.new({from: tokenOwner});
      crowdsale = await ZxcCrowdsaleTestable.new(wallet,
                                                 token.address,
                                                 startTimePresale,
                                                 startTimeSaleWithBonus,
                                                 startTimeSaleNoBonus,
                                                 endTime,
                                                 rate,
                                                 crowdSaleZxcCap,
                                                 bonusPresale,
                                                 bonusSale,
                                                 minimumWeiDeposit,
                                                 _tester,
                                                 {from: crowdsaleOwner});
      // TODO(luka): this enables transfers for all. We need to enable it only for crowdsale
      // contract.
      await token.enableTransfer({from: tokenOwner});
    });

    it('buyTokens should purchase tokens', async () => {
      let weiAmount = ether(11.05);
      let expectedSoldTokens = weiAmount.mul(rate);
      let startWalletBalance = await web3.eth.getBalance(wallet);

      // Set crowdsale contract ZXC allowance
      await token.approve(crowdsale.address, crowdSaleZxcCap, {from: tokenOwner});
      await increaseTimeTo(startTimeSaleNoBonus + duration.seconds(30));

      let { logs } = await crowdsale.buyTokens(buyerOne, {from: buyerOne, value: weiAmount});
      let actualBalance = await token.balanceOf(buyerOne);
      // Buyer should get correct number of tokens
      assert.equal(actualBalance.toString(), expectedSoldTokens.toString());
      // Wallet should receive correct amount of wei
      let endWalletBalance = await web3.eth.getBalance(wallet);
      assert.strictEqual(endWalletBalance.sub(startWalletBalance).toString(), weiAmount.toString());
      // Counter for sold ZXC should be increased
      let zxcSold = await crowdsale.zxcSold.call()
      assert.strictEqual(zxcSold.toString(), expectedSoldTokens.toString());

      let event = logs.find(e => e.event === 'TokenPurchase');
      assert.notEqual(event, undefined);
    });

    it('buyTokens should fail purchasing tokens if beneficiary address is 0', async () => {
      let weiAmount = ether(7.03);
      // Set crowdsale contract ZXC allowance
      await token.approve(crowdsale.address, crowdSaleZxcCap, {from: tokenOwner});
      await increaseTimeTo(startTimeSaleNoBonus + duration.seconds(30));

      await assertRevert(crowdsale.buyTokens(0, {from: buyerOne, value: weiAmount}));
    });

    it('buyTokens should fail purchasing tokens if ether amount is less than minimum deposit', async () => {
      let weiAmount = ether(0.03);
      // Set crowdsale contract ZXC allowance
      await token.approve(crowdsale.address, crowdSaleZxcCap, {from: tokenOwner});
      await increaseTimeTo(startTimeSaleNoBonus + duration.seconds(30));

      await assertRevert(crowdsale.buyTokens(buyerOne, {from: buyerOne, value: weiAmount}));
    });

    it('buyTokens should purchase tokens for minimum deposit amount', async () => {
      let weiAmount = ether(1);
      let expectedTokens = weiAmount.mul(rate);

      // Set crowdsale contract ZXC allowance
      await token.approve(crowdsale.address, crowdSaleZxcCap, {from: tokenOwner});
      await increaseTimeTo(startTimeSaleNoBonus + duration.seconds(30));

      await crowdsale.buyTokens(buyerOne, {from: buyerOne, value: weiAmount});
      let actualTokens = await token.balanceOf(buyerOne);
      assert.strictEqual(actualTokens.toString(), expectedTokens.toString());
    });

    it('buyTokens should purchase tokens if sold token amount hits crowdsale cap', async () => {
      let weiAmount = ether(3);
      let crowdsaleCap = ether(3).mul(rate);
      let expectedTokens = weiAmount.mul(rate);

      // Set crowdsale contract ZXC allowance
      await token.approve(crowdsale.address, crowdsaleCap, {from: tokenOwner});
      await increaseTimeTo(startTimeSaleNoBonus + duration.seconds(30));

      await crowdsale.buyTokens(buyerOne, {from: buyerOne, value: weiAmount});
      let actualTokens = await token.balanceOf(buyerOne);
      assert.strictEqual(actualTokens.toString(), expectedTokens.toString());
    });

    it('buyTokens should fail purchasing if sold token amount goes over crowdsale cap', async () => {
      let weiAmount = ether(3.1);
      let crowdsaleCap = ether(3).mul(rate);

      // Set crowdsale contract ZXC allowance
      await token.approve(crowdsale.address, crowdsaleCap, {from: tokenOwner});
      await increaseTimeTo(startTimeSaleNoBonus + duration.seconds(30));

      await assertRevert(crowdsale.buyTokens(buyerOne, {from: buyerOne, value: weiAmount}));
    });

    it('buyTokens should fail purchasing tokens if transferFrom fails', async () => {
      let weiAmount = ether(2.1);

      await increaseTimeTo(startTimeSaleNoBonus + duration.seconds(30));

      // Crowdsale ZXC allowance not set, transferFrom fails
      await assertRevert(crowdsale.buyTokens(buyerOne, {from: buyerOne, value: weiAmount}));
    });

    it('fallback function should purchase tokens', async () => {
      let weiAmount = ether(8.05113);
      let expectedSoldTokens = weiAmount.mul(rate);
      let startWalletBalance = await web3.eth.getBalance(wallet);

      // Set crowdsale contract ZXC allowance
      await token.approve(crowdsale.address, crowdSaleZxcCap, {from: tokenOwner});
      await increaseTimeTo(startTimeSaleNoBonus + duration.seconds(30));

      let { logs } = await crowdsale.sendTransaction({from: buyerOne, value: weiAmount});
      let actualBalance = await token.balanceOf(buyerOne);
      // Buyer should get correct number of tokens
      assert.equal(actualBalance.toString(), expectedSoldTokens.toString());
      // Wallet should receive correct amount of wei
      let endWalletBalance = await web3.eth.getBalance(wallet);
      assert.strictEqual(endWalletBalance.sub(startWalletBalance).toString(), weiAmount.toString());
      // Counter for sold ZXC should be increased
      let zxcSold = await crowdsale.zxcSold.call()
      assert.strictEqual(zxcSold.toString(), expectedSoldTokens.toString());

      let event = logs.find(e => e.event === 'TokenPurchase');
      assert.notEqual(event, undefined);
    });

  });
});
