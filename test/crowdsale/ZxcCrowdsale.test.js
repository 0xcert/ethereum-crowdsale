const assertRevert = require('@0xcert/ethereum-utils/test/helpers/assertRevert');
const { advanceBlock } = require('../helpers/advanceToBlock');
const { increaseTime, increaseTimeTo, duration } = require('../helpers/increaseTime');
const latestTime = require('../helpers/latestTime');
const ether = require('../helpers/ether');

const BigNumber = web3.BigNumber;

const ZxcCrowdsale = artifacts.require('ZxcCrowdsale');
const ZxcCrowdsaleTestable = artifacts.require('../mocks/ZxcCrowdsaleTestable.sol');
const ZxcBigDecimals = artifacts.require('../mocks/ZxcBigDecimals.sol');
const Xcert = artifacts.require('@0xcert/ethereum-xcert/contracts/tokens/Xcert.sol');
const Zxc = artifacts.require('@0xcert/ethereum-zxc/contracts/tokens/Zxc.sol');


contract('crowdsale/ZxcCrowdsale', (accounts) => {
  const decimalsMul = new BigNumber('1e+18');  // 10 ** 18
  const rate = new BigNumber(10000);  // 1 ETH = 10,000 ZXC
  const crowdSaleZxcSupply = new BigNumber(250000001).mul(decimalsMul);  // 250M + 1, 18 decimals
  const preSaleZxcCap = crowdSaleZxcSupply.sub(55000000);  // 195M
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
  const xcertTokenOwner = accounts[7];

  let token;
  let xcertToken;
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
      xcertToken = await Xcert.new({from: tokenOwner});
      crowdsale = await ZxcCrowdsale.new(wallet,
                                         token.address,
                                         xcertToken.address,
                                         startTimePresale,
                                         startTimeSaleWithBonus,
                                         startTimeSaleNoBonus,
                                         endTime,
                                         rate,
                                         preSaleZxcCap,
                                         crowdSaleZxcSupply,
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

    it('constructor should set correct crowdSaleZxcSupply', async () => {
      const actualSupply = await crowdsale.crowdSaleZxcSupply.call();
      assert.strictEqual(actualSupply.toString(), crowdSaleZxcSupply.toString());
    });

    it('constructor should set correct preSaleZxcCap', async () => {
      const actualCap = await crowdsale.preSaleZxcCap.call();
      assert.strictEqual(actualCap.toString(), preSaleZxcCap.toString());
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
                                          xcertToken.address,
                                          firstStageStartPast,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          preSaleZxcCap,
                                          crowdSaleZxcSupply,
                                          bonusPresale,
                                          bonusSale,
                                          minimumWeiDeposit));
    });
    it('constructor should fail with wallet address set to 0', async () => {
      await assertRevert(ZxcCrowdsale.new(0,
                                          token.address,
                                          xcertToken.address,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          preSaleZxcCap,
                                          crowdSaleZxcSupply,
                                          bonusPresale,
                                          bonusSale,
                                          minimumWeiDeposit));
    });

    it('constructor should set correct wallet address', async () => {
      const _crowdsale = await ZxcCrowdsale.new(wallet,
                                                token.address,
                                                xcertToken.address,
                                                startTimePresale,
                                                startTimeSaleWithBonus,
                                                startTimeSaleNoBonus,
                                                endTime,
                                                rate,
                                                preSaleZxcCap,
                                                crowdSaleZxcSupply,
                                                bonusPresale,
                                                bonusSale,
                                                minimumWeiDeposit);
      assert.strictEqual(await _crowdsale.wallet.call(), wallet);
    });

    it('constructor should set correct Xcert token address', async () => {
      const _crowdsale = await ZxcCrowdsale.new(wallet,
                                                token.address,
                                                xcertToken.address,
                                                startTimePresale,
                                                startTimeSaleWithBonus,
                                                startTimeSaleNoBonus,
                                                endTime,
                                                rate,
                                                preSaleZxcCap,
                                                crowdSaleZxcSupply,
                                                bonusPresale,
                                                bonusSale,
                                                minimumWeiDeposit);
      assert.strictEqual(await _crowdsale.xcertKyc.call(), xcertToken.address);
    });

    it('constructor should fail with Xcert token address set to 0', async () => {
      await assertRevert(ZxcCrowdsale.new(wallet,
                                          token.address,
                                          0,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          preSaleZxcCap,
                                          crowdSaleZxcSupply,
                                          bonusPresale,
                                          bonusSale,
                                          minimumWeiDeposit));
    });

    it('constructor should fail with token address set to 0', async () => {
      await assertRevert(ZxcCrowdsale.new(wallet,
                                          0,
                                          xcertToken.address,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          preSaleZxcCap,
                                          crowdSaleZxcSupply,
                                          bonusPresale,
                                          bonusSale,
                                          minimumWeiDeposit));
    });

    it('constructor should fail if token address equals Xcert token address', async () => {
      await assertRevert(ZxcCrowdsale.new(wallet,
                                          token.address,
                                          token.address,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          preSaleZxcCap,
                                          crowdSaleZxcSupply,
                                          bonusPresale,
                                          bonusSale,
                                          minimumWeiDeposit));
    });

    it('constructor should fail if wallet address equals Xcert token address', async () => {
      await assertRevert(ZxcCrowdsale.new(wallet,
                                          token.address,
                                          wallet,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          preSaleZxcCap,
                                          crowdSaleZxcSupply,
                                          bonusPresale,
                                          bonusSale,
                                          minimumWeiDeposit));
    });

    it('constructor should fail if wallet address equals token address', async () => {
      await assertRevert(ZxcCrowdsale.new(token.address,
                                          token.address,
                                          xcertToken.address,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          preSaleZxcCap,
                                          crowdSaleZxcSupply,
                                          bonusPresale,
                                          bonusSale,
                                          minimumWeiDeposit));
    });

    it('constructor should fail if bonusPresale == 0', async () => {
      await assertRevert(ZxcCrowdsale.new(wallet,
                                          token.address,
                                          xcertToken.address,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          preSaleZxcCap,
                                          crowdSaleZxcSupply,
                                          0,
                                          bonusSale,
                                          minimumWeiDeposit));
    });

    it('constructor should fail if bonusPresale > 100', async () => {
      await assertRevert(ZxcCrowdsale.new(wallet,
                                          token.address,
                                          xcertToken.address,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          preSaleZxcCap,
                                          crowdSaleZxcSupply,
                                          101,
                                          bonusSale,
                                          minimumWeiDeposit));
    });

    it('constructor should fail if bonusSale == 0', async () => {
      await assertRevert(ZxcCrowdsale.new(wallet,
                                          token.address,
                                          xcertToken.address,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          preSaleZxcCap,
                                          crowdSaleZxcSupply,
                                          bonusPresale,
                                          0,
                                          minimumWeiDeposit));
    });

    it('constructor should fail if bonusSale > 100', async () => {
      await assertRevert(ZxcCrowdsale.new(wallet,
                                          token.address,
                                          xcertToken.address,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          preSaleZxcCap,
                                          crowdSaleZxcSupply,
                                          bonusPresale,
                                          101,
                                          minimumWeiDeposit));
    });

    it('constructor should fail with rate set to zero', async () => {
      await assertRevert(ZxcCrowdsale.new(wallet,
                                          token.address,
                                          xcertToken.address,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          0,
                                          preSaleZxcCap,
                                          crowdSaleZxcSupply,
                                          bonusPresale,
                                          bonusSale,
                                          minimumWeiDeposit));
    });

    it('constructor should fail if token decimals != 18', async () => {
      let _token = await ZxcBigDecimals.new({from: tokenOwner});
      await assertRevert(ZxcCrowdsale.new(wallet,
                                          _token.address,
                                          xcertToken.address,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          preSaleZxcCap,
                                          crowdSaleZxcSupply,
                                          bonusPresale,
                                          bonusSale,
                                          minimumWeiDeposit));
    });

    it('constructor should fail with zero presale token cap', async () => {
      await assertRevert(ZxcCrowdsale.new(wallet,
                                          token.address,
                                          xcertToken.address,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          0,
                                          crowdSaleZxcSupply,
                                          bonusPresale,
                                          bonusSale,
                                          minimumWeiDeposit));
    });

    it('constructor should fail with presale token cap > crowdsale token supply', async () => {
      await assertRevert(ZxcCrowdsale.new(wallet,
                                          token.address,
                                          xcertToken.address,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          crowdSaleZxcSupply.add(1),
                                          crowdSaleZxcSupply,
                                          bonusPresale,
                                          bonusSale,
                                          minimumWeiDeposit));
    });

    it('constructor should fail with zero crowdsale token supply', async () => {
      await assertRevert(ZxcCrowdsale.new(wallet,
                                          token.address,
                                          xcertToken.address,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          preSaleZxcCap,
                                          0,
                                          bonusPresale,
                                          bonusSale,
                                          minimumWeiDeposit));
    });

    it('constructor should fail with too low minimumWeiDeposit', async () => {
      await assertRevert(ZxcCrowdsale.new(wallet,
                                          token.address,
                                          xcertToken.address,
                                          startTimePresale,
                                          startTimeSaleWithBonus,
                                          startTimeSaleNoBonus,
                                          endTime,
                                          rate,
                                          preSaleZxcCap,
                                          crowdSaleZxcSupply,
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
      xcertToken = await Xcert.new({from: tokenOwner});
      crowdsale = await ZxcCrowdsaleTestable.new(wallet,
                                                 token.address,
                                                 xcertToken.address,
                                                 startTimePresale,
                                                 startTimeSaleWithBonus,
                                                 startTimeSaleNoBonus,
                                                 endTime,
                                                 rate,
                                                 preSaleZxcCap,
                                                 crowdSaleZxcSupply,
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
      crowdsale._testSetZxcSold(crowdSaleZxcSupply, {from: _tester})
      assert.strictEqual(await crowdsale.hasEnded(), true);
    });

    it('hasEnded should return true if crowdsale reached the cap and end time', async () => {
      await increaseTimeTo(endTime + duration.seconds(30));
      crowdsale._testSetZxcSold(crowdSaleZxcSupply, {from: _tester})
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

    it('getTokenAmount should return correct num of tokens if bonus stage', async () => {
      // 5.1 ETH = 51000 ZXC
      // 10% bonus: 51000 / 10 = 5100 ZXC
      // Total: 56100.0 ZXC
      const weiAmount = ether(5.1);
      const bonusPercent = new BigNumber('10');
      const expectedTokens = weiAmount.mul(rate);
      const expectedBonus =  expectedTokens.mul(bonusPercent).div(100);
      const actualTokens = await crowdsale.getTokenAmountWrapper(weiAmount, bonusPercent,
        {from: buyerOne});
      assert.strictEqual(actualTokens.toString(), expectedTokens.add(expectedBonus).toString());
      // Sanity check
      assert.strictEqual(actualTokens.toString(), '5.61e+22');
      assert.strictEqual(actualTokens.div(decimalsMul).toString(), '56100');
    });

    it('getTokenAmount should return correct num of tokens if not bonus stage', async () => {
      // 5.1 ETH = 51000 ZXC
      // Total: 51000.0 ZXC
      const weiAmount = ether(5.1);
      const expectedTokens = weiAmount.mul(rate);
      const actualTokens = await crowdsale.getTokenAmountWrapper(weiAmount, 0, {from: buyerOne});
      assert.strictEqual(actualTokens.toString(), expectedTokens.toString());
      // Sanity check
      assert.strictEqual(actualTokens.toString(), '5.1e+22');
      assert.strictEqual(actualTokens.div(decimalsMul).toString(), '51000');
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
      xcertToken = await Xcert.new({from: xcertTokenOwner});
      crowdsale = await ZxcCrowdsale.new(wallet,
                                         token.address,
                                         xcertToken.address,
                                         startTimePresale,
                                         startTimeSaleWithBonus,
                                         startTimeSaleNoBonus,
                                         endTime,
                                         rate,
                                         preSaleZxcCap,
                                         crowdSaleZxcSupply,
                                         bonusPresale,
                                         bonusSale,
                                         minimumWeiDeposit,
                                         {from: crowdsaleOwner});
      // Mint KYC token for buyerOne
      await xcertToken.mint(buyerOne,
                            123,
                            "https://foobar.io",
                            "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
                            ["0xa65de9e6"],
                            ["0xa65de9e6"],
                            {from: xcertTokenOwner});
      // TODO(luka): this enables transfers for all. We need to enable it only for crowdsale
      // contract.
      await token.enableTransfer({from: tokenOwner});
    });

    it('buyTokens should purchase tokens when in public presale', async () => {
      const weiAmount = ether("3.333333333333333333");
      const expectedSoldTokens = weiAmount.mul(rate);
      const expectedBonus =  expectedSoldTokens.div(bonusPresaleDivisor);
      const startWalconstBalance = await web3.eth.getBalance(wallet);

      // Set crowdsale contract ZXC allowance
      await token.approve(crowdsale.address, crowdSaleZxcSupply, {from: tokenOwner});
      await increaseTimeTo(startTimePresale + duration.seconds(30));

      const { logs } = await crowdsale.buyTokens(buyerOne, {from: buyerOne, value: weiAmount});
      const actualBalance = await token.balanceOf(buyerOne);
      // Buyer should get correct number of tokens
      assert.equal(actualBalance.toString(), expectedSoldTokens.add(expectedBonus).toString());
      // wallet should receive correct amount of wei
      const endWalletBalance = await web3.eth.getBalance(wallet);
      assert.strictEqual(endWalletBalance.sub(startWalconstBalance).toString(), weiAmount.toString());
      // Counter for sold ZXC should be increased
      const zxcSold = await crowdsale.zxcSold.call();
      assert.strictEqual(zxcSold.toString(), expectedSoldTokens.add(expectedBonus).toString());

      const event = logs.find(e => e.event === 'TokenPurchase');
      assert.notEqual(event, undefined);
    });

    it('buyTokens should revert purchase tokens when in public presale and cap reached', async () => {
      const weiAmount = ether("11.1");
      const presaleCap = new BigNumber("10").mul(decimalsMul).mul(rate);
      crowdsale = await ZxcCrowdsale.new(wallet,
                                         token.address,
                                         xcertToken.address,
                                         startTimePresale,
                                         startTimeSaleWithBonus,
                                         startTimeSaleNoBonus,
                                         endTime,
                                         rate,
                                         presaleCap,
                                         crowdSaleZxcSupply,
                                         bonusPresale,
                                         bonusSale,
                                         minimumWeiDeposit,
                                         {from: crowdsaleOwner});

      // Set crowdsale contract ZXC allowance
      await token.approve(crowdsale.address, crowdSaleZxcSupply, {from: tokenOwner});
      await increaseTimeTo(startTimePresale + duration.seconds(30));

      await assertRevert(crowdsale.buyTokens(0, {from: buyerOne, value: weiAmount}));
    });

    it('buyTokens should purchase tokens when in public sale with bonus', async () => {
      const weiAmount = ether("7.1234");
      const expectedSoldTokens = weiAmount.mul(rate);
      const expectedBonus =  expectedSoldTokens.div(bonusSaleDivisor);
      const startWalconstBalance = await web3.eth.getBalance(wallet);

      // Set crowdsale contract ZXC allowance
      await token.approve(crowdsale.address, crowdSaleZxcSupply, {from: tokenOwner});
      await increaseTimeTo(startTimeSaleWithBonus + duration.seconds(30));

      const { logs } = await crowdsale.buyTokens(buyerOne, {from: buyerOne, value: weiAmount});
      const actualBalance = await token.balanceOf(buyerOne);
      // Buyer should get correct number of tokens
      assert.equal(actualBalance.toString(), expectedSoldTokens.add(expectedBonus).toString());
      // wallet should receive correct amount of wei
      const endWalletBalance = await web3.eth.getBalance(wallet);
      assert.strictEqual(endWalletBalance.sub(startWalconstBalance).toString(), weiAmount.toString());
      // Counter for sold ZXC should be increased
      const zxcSold = await crowdsale.zxcSold.call();
      assert.strictEqual(zxcSold.toString(), expectedSoldTokens.add(expectedBonus).toString());

      const event = logs.find(e => e.event === 'TokenPurchase');
      assert.notEqual(event, undefined);
    });

    it('buyTokens should purchase tokens when in public sale with no bonus', async () => {
      const weiAmount = ether("3.333333333333333333");
      const expectedSoldTokens = weiAmount.mul(rate);
      const startWalletBalance = await web3.eth.getBalance(wallet);

      // Set crowdsale contract ZXC allowance
      await token.approve(crowdsale.address, crowdSaleZxcSupply, {from: tokenOwner});
      await increaseTimeTo(startTimeSaleNoBonus + duration.seconds(30));

      const { logs } = await crowdsale.buyTokens(buyerOne, {from: buyerOne, value: weiAmount});
      const actualBalance = await token.balanceOf(buyerOne);
      // Buyer should get correct number of tokens
      assert.equal(actualBalance.toString(), expectedSoldTokens.toString());
      // Wallet should receive correct amount of wei
      const endWalletBalance = await web3.eth.getBalance(wallet);
      assert.strictEqual(endWalletBalance.sub(startWalletBalance).toString(), weiAmount.toString());
      // Counter for sold ZXC should be increased
      const zxcSold = await crowdsale.zxcSold.call();
      assert.strictEqual(zxcSold.toString(), expectedSoldTokens.toString());

      const event = logs.find(e => e.event === 'TokenPurchase');
      assert.notEqual(event, undefined);
    });

    it('buyTokens should revert purchase tokens prior to the sale', async () => {
      const weiAmount = ether("12.8");
      // Set crowdsale contract ZXC allowance
      await token.approve(crowdsale.address, crowdSaleZxcSupply, {from: tokenOwner});
      await assertRevert(crowdsale.buyTokens(0, {from: buyerOne, value: weiAmount}));
    });

    it('buyTokens should revert purchase tokens after the sale', async () => {
      const weiAmount = ether("12.8");
      // Set crowdsale contract ZXC allowance
      await token.approve(crowdsale.address, crowdSaleZxcSupply, {from: tokenOwner});
      await increaseTimeTo(endTime + duration.seconds(30));

      await assertRevert(crowdsale.buyTokens(0, {from: buyerOne, value: weiAmount}));
    });

    it('buyTokens should fail if beneficiary address is not the same as msg.sender', async () => {
      let weiAmount = ether(7.03);
      // Set crowdsale contract ZXC allowance
      await token.approve(crowdsale.address, crowdSaleZxcSupply, {from: tokenOwner});
      await increaseTimeTo(startTimeSaleNoBonus + duration.seconds(30));

      // buyerOne has KYC, buyerTwo doesn't have it.
      await assertRevert(crowdsale.buyTokens(buyerTwo, {from: buyerOne, value: weiAmount}));
      await assertRevert(crowdsale.buyTokens(buyerOne, {from: buyerTwo, value: weiAmount}));
    });

    it('buyTokens should fail purchasing tokens if less than min deposit in presale', async () => {
      let weiAmount = ether(0.03);
      // Set crowdsale contract ZXC allowance
      await token.approve(crowdsale.address, crowdSaleZxcSupply, {from: tokenOwner});
      await increaseTimeTo(startTimePresale + duration.seconds(30));

      await assertRevert(crowdsale.buyTokens(buyerOne, {from: buyerOne, value: weiAmount}));
    });

    it('buyTokens should purchase tokens for min deposit in presale', async () => {
      let weiAmount = ether(1);
      let expectedTokens = weiAmount.mul(rate);
      const expectedBonus =  expectedTokens.div(bonusPresaleDivisor);

      // Set crowdsale contract ZXC allowance
      await token.approve(crowdsale.address, crowdSaleZxcSupply, {from: tokenOwner});
      await increaseTimeTo(startTimePresale + duration.seconds(30));

      await crowdsale.buyTokens(buyerOne, {from: buyerOne, value: weiAmount});
      let actualTokens = await token.balanceOf(buyerOne);
      assert.strictEqual(actualTokens.toString(), expectedTokens.add(expectedBonus).toString());
    });

    it('buyTokens should purchase tokens for less than presale min deposit in sale period', async () => {
      const weiAmount = ether(0.01);
      const expectedTokens = weiAmount.mul(rate);

      // Set crowdsale contract ZXC allowance
      await token.approve(crowdsale.address, crowdSaleZxcSupply, {from: tokenOwner});
      await increaseTimeTo(startTimeSaleNoBonus + duration.seconds(30));

      await crowdsale.buyTokens(buyerOne, {from: buyerOne, value: weiAmount});
      let actualTokens = await token.balanceOf(buyerOne);
      assert.strictEqual(actualTokens.toString(), expectedTokens.toString());
    });

    it('buyTokens should purchase tokens if sold token amount == crowdsale cap', async () => {
      let weiAmount = ether(3);
      let crowdsaleCap = weiAmount.mul(rate);
      let expectedTokens = crowdsaleCap;

      crowdsale = await ZxcCrowdsale.new(wallet,
                                         token.address,
                                         xcertToken.address,
                                         startTimePresale,
                                         startTimeSaleWithBonus,
                                         startTimeSaleNoBonus,
                                         endTime,
                                         rate,
                                         crowdsaleCap,
                                         crowdsaleCap,
                                         bonusPresale,
                                         bonusSale,
                                         minimumWeiDeposit,
                                         {from: crowdsaleOwner});
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

      crowdsale = await ZxcCrowdsale.new(wallet,
                                         token.address,
                                         xcertToken.address,
                                         startTimePresale,
                                         startTimeSaleWithBonus,
                                         startTimeSaleNoBonus,
                                         endTime,
                                         rate,
                                         crowdsaleCap,
                                         crowdsaleCap,
                                         bonusPresale,
                                         bonusSale,
                                         minimumWeiDeposit,
                                         {from: crowdsaleOwner});

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

    it('buyTokens should fail if sender does not have Xcert KYC token', async () => {
      const weiAmount = ether(2.1);

      // Set crowdsale contract ZXC allowance
      await token.approve(crowdsale.address, crowdSaleZxcSupply, {from: tokenOwner});
      await increaseTimeTo(startTimeSaleNoBonus + duration.seconds(30));

      // buyerOne has KYC token
      await crowdsale.buyTokens(buyerOne, {from: buyerOne, value: weiAmount});
      // buyerTwo doesn't have KYC token
      await assertRevert(crowdsale.buyTokens(buyerTwo, {from: buyerTwo, value: weiAmount}));
    });

    it('fallback function should fail if sender does not have Xcert KYC token', async () => {
      const weiAmount = ether(2.1);

      // Set crowdsale contract ZXC allowance
      await token.approve(crowdsale.address, crowdSaleZxcSupply, {from: tokenOwner});
      await increaseTimeTo(startTimeSaleNoBonus + duration.seconds(30));

      // buyerOne has KYC token
      await crowdsale.sendTransaction({from: buyerOne, value: weiAmount});
      // buyerTwo doesn't have KYC token
      await assertRevert(crowdsale.sendTransaction({from: buyerTwo, value: weiAmount}));
    });

    it('fallback function should purchase tokens', async () => {
      let weiAmount = ether(8.05113);
      let expectedSoldTokens = weiAmount.mul(rate);
      let startWalletBalance = await web3.eth.getBalance(wallet);

      // Set crowdsale contract ZXC allowance
      await token.approve(crowdsale.address, crowdSaleZxcSupply, {from: tokenOwner});
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
