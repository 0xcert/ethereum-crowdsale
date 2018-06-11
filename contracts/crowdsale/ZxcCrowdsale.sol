pragma solidity ^0.4.24;

import "@0xcert/ethereum-utils/contracts/math/SafeMath.sol";
import "@0xcert/ethereum-utils/contracts/ownership/Ownable.sol";
import "@0xcert/ethereum-zxc/contracts/tokens/Zxc.sol";


/**
 * @title ZXC crowdsale contract.
 * @dev Crowdsale contract for distributing ZXC tokens.
 */
contract ZxcCrowdsale is Ownable {
  using SafeMath for uint256;

  /**
   * @dev Token being sold.
   */
  Zxc public token;

  /**
   * @dev Start timestamps for the following stages (start dates are inclusive, end exclusive):
   * - Token pre-sale with 10% bonus: 2018/06/26 - 2018/07/04
   * - Token sale with 5% bonus: 2018/07/04 - 2018/07/05
   * - Token sale with 0% bonus: 2018/07/05 - 2018/07/18
   */
  uint256 public startTimePresale;
  uint256 public startTimeSaleWithBonus;
  uint256 public startTimeSaleNoBonus;

  uint256 public bonusPresale;
  uint256 public bonusSale;

  /**
   * @dev End timestamp to end the crowdsale.
   */
  uint256 public endTime;

  /**
   * @dev Minimum required wei deposit.
   */
  uint256 public minimumWeiDeposit;

  /**
   * @dev Crowdsale cap in ZXC.
   */
  uint256 public crowdSaleZxcCap;

  /**
   * @dev Amount of ZXC tokens sold.
   */
  uint256 public zxcSold;

  /**
   * @dev Address where funds are collected.
   */
  address public wallet;

  /**
   * @dev How many token units buyer gets per wei.
   */
  uint256 public rate;

  /**
   * @dev An event which is triggered when tokens are bought.
   * @param _from The address sending tokens.
   * @param _to The address recieving tokens.
   * @param _weiAmount Purchase amount in wei.
   * @param _tokenAmount The amount of purchased tokens.
   */
  event TokenPurchase(
    address indexed _from,
    address indexed _to,
    uint256 _weiAmount,
    uint256 _tokenAmount
  );

  /**
   * @dev Contract constructor.
   * @param _walletAddress Address of the wallet which collects funds.
   * @param _tokenAddress Address of the ZXC token contract.
   * @param _startTimePresale Start time of presale stage.
   * @param _startTimeSaleWithBonus Start time of public sale stage with bonus.
   * @param _startTimeSaleNoBonus Start time of public sale stage with no bonus.
   * @param _endTime Time when sale ends.
   * @param _rate ZXC/ETH exchange rate.
   * @param _crowdSaleZxcCap Number of ZXC tokens offered during the sale.
   * @param _bonusPresale Bonus token percentage for presale.
   * @param _bonusSale Bonus token percentage for public sale stage with bonus.
   * @param _minimumWeiDeposit Minimum required deposit in wei.
   */
  constructor(address _walletAddress,
    address _tokenAddress,
    uint256 _startTimePresale,  // 1529971200: date -d '2018-06-26 00:00:00 UTC' +%s
    uint256 _startTimeSaleWithBonus, // 1530662400: date -d '2018-07-04 00:00:00 UTC' +%s
    uint256 _startTimeSaleNoBonus,  //1530748800: date -d '2018-07-05 00:00:00 UTC' +%s
    uint256 _endTime,  // 1531872000: date -d '2018-07-18 00:00:00 UTC' +%s
    uint256 _rate,  // 10000: 1 ETH = 10,000 ZXC
    uint256 _crowdSaleZxcCap, // 250M
    uint256 _bonusPresale,  // 10 (%)
    uint256 _bonusSale,  // 5 (%)
    uint256 _minimumWeiDeposit  // 1 ether;
  )
    public
  {
    uint256 _bonusDividend = 100; // 100%

    require(_walletAddress != address(0));
    require(_tokenAddress != address(0));
    require(_tokenAddress != _walletAddress);

    token = Zxc(_tokenAddress);

    uint8 _tokenDecimals = token.decimals();
    require(_tokenDecimals == 18);  // Sanity check.
    wallet = _walletAddress;

    require(_bonusPresale > 0);
    require(_bonusSale > 0);
    // 100% / _bonusPresale = bonusPresale -> bonus: tokenAmount / bonusPresale
    bonusPresale = _bonusDividend.div(_bonusPresale);
    // 100% / _bonusSale = bonusSale -> bonus: tokenAmount / bonusSale
    bonusSale = _bonusDividend.div(_bonusSale);

    require(_startTimePresale >= now);
    require(_startTimeSaleWithBonus > _startTimePresale);
    require(_startTimeSaleNoBonus > _startTimeSaleWithBonus);

    startTimePresale = _startTimePresale;
    startTimeSaleWithBonus = _startTimeSaleWithBonus;
    startTimeSaleNoBonus = _startTimeSaleNoBonus;
    endTime = _endTime;

    require(_rate > 0);
    rate = _rate;

    require(_crowdSaleZxcCap > 0);
    require(token.totalSupply() >= _crowdSaleZxcCap);

    crowdSaleZxcCap = _crowdSaleZxcCap;
    zxcSold = 0;

    require(_minimumWeiDeposit > 0);
    minimumWeiDeposit = _minimumWeiDeposit;
  }

  /**
   * @dev Fallback function can be used to buy tokens.
   */
  function()
    external
    payable
  {
    buyTokens(msg.sender);
  }

  /**
   * @dev Low level token purchase function.
   * @param beneficiary Address which is buying tokens.
   */
  function buyTokens(address beneficiary)
    public
    payable
  {
    uint256 weiAmount = msg.value;

    require(beneficiary != address(0));
    require(weiAmount >= minimumWeiDeposit);

    //NOTE: this reverts if NOT in any of the sale time periods!
    uint256 tokens = getTokenAmount(weiAmount);

    require(zxcSold.add(tokens) <= crowdSaleZxcCap);
    zxcSold = zxcSold.add(tokens);

    forwardFunds();
    require(token.transferFrom(token.owner(), beneficiary, tokens));
    emit TokenPurchase(msg.sender, beneficiary, weiAmount, tokens);
  }

  /**
   * @return true if crowdsale event has ended
   */
  function hasEnded()
    external
    view
    returns (bool)
  {
    bool capReached = zxcSold >= crowdSaleZxcCap;
    bool endTimeReached = now >= endTime;
    return capReached || endTimeReached;
  }

  /**
   * @dev Send wei to the collection wallet.
   */
  function forwardFunds()
    internal
  {
    wallet.transfer(msg.value);
  }

  /**
   * @dev Check if currently active period is private pre-sale with bonuses.
   * @return bool
   */
  function isPrivatePresale()
    internal
    view
    returns(bool)
  {
    if (now >= startTimePresale && now < startTimeSaleWithBonus)
      return true;
    else
      return false;
  }

  /**
   * @dev Check if currently active period is public sale with bonuses.
   * @return bool
   */
  function isPublicSaleWithBonus()
    internal
    view
    returns(bool)
  {
    if (now >= startTimeSaleWithBonus && now < startTimeSaleNoBonus)
      return true;
    else
      return false;
  }

  /**
   * @dev Check if currently active period is public sale without bonuses.
   * @return bool
   */
  function isPublicSaleNoBonus()
    internal
    view
    returns(bool)
  {
    if (now >= startTimeSaleNoBonus && now < endTime)
      return true;
    else
      return false;
  }


  /**
   * @dev Calculate amount of tokens for a given wei amount. Apply special bonuses depending on
   * @param weiAmount Amount of wei for token purchase.
   * the time of the purchase. If purchase is outside of every token sale window then revert.
   * @return number of tokens per wei amount with possible token bonus
   */
  function getTokenAmount(uint256 weiAmount)
    internal
    view
    returns(uint256)
  {
    uint256 tokens = weiAmount.mul(rate);
    uint256 bonus = 0;

    if (isPrivatePresale()) {
      bonus = tokens.div(bonusPresale);
    }
    else if (isPublicSaleWithBonus()) {
      bonus = tokens.div(bonusSale);
    }
    else if (isPublicSaleNoBonus()) {
      // No bonus
    }
    else {
      revert("Purchase outside of token sale time windows");
    }
    return tokens.add(bonus);
  }
}
