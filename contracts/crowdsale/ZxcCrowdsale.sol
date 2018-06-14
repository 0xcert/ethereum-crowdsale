pragma solidity ^0.4.24;

import "@0xcert/ethereum-utils/contracts/math/SafeMath.sol";
import "@0xcert/ethereum-utils/contracts/ownership/Ownable.sol";
import "@0xcert/ethereum-zxc/contracts/tokens/Zxc.sol";
import "@0xcert/ethereum-xcert/contracts/tokens/Xcert.sol";


/**
 * @title ZXC crowdsale contract.
 * @dev Crowdsale contract for distributing ZXC tokens.
 * Start timestamps for the token sale stages (start dates are inclusive, end exclusive):
 *   - Token presale with 10% bonus: 2018/06/26 - 2018/07/04
 *   - Token sale with 5% bonus: 2018/07/04 - 2018/07/05
 *   - Token sale with 0% bonus: 2018/07/05 - 2018/07/18
 */
contract ZxcCrowdsale is
  Ownable
{
  using SafeMath for uint256;

  /**
   * @dev Token being sold.
   */
  Zxc public token;

  /**
   * @dev Xcert KYC token.
   */
  Xcert public xcertKyc;

  /**
   * @dev Start time of the presale.
   */
  uint256 public startTimePresale;

  /**
   * @dev Start time of the token sale with bonus.
   */
  uint256 public startTimeSaleWithBonus;

  /**
   * @dev Start time of the token sale with no bonus.
   */
  uint256 public startTimeSaleNoBonus;

  /**
   * @dev Presale bonus expressed as percentage integer (10% = 10).
   */
  uint256 public bonusPresale;

  /**
   * @dev Token sale bonus expressed as percentage integer (10% = 10).
   */
  uint256 public bonusSale;

  /**
   * @dev End timestamp to end the crowdsale.
   */
  uint256 public endTime;

  /**
   * @dev Minimum required wei deposit for public presale period.
   */
  uint256 public minimumWeiDeposit;

  /**
   * @dev Total amount of ZXC tokens offered for the presale.
   */
  uint256 public preSaleZxcCap;

  /**
   * @dev Total supply of ZXC tokens for the sale.
   */
  uint256 public crowdSaleZxcSupply;

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
   * @param _xcertKycAddress Address of the Xcert KYC token contract.
   * @param _startTimePresale Start time of presale stage.
   * @param _startTimeSaleWithBonus Start time of public sale stage with bonus.
   * @param _startTimeSaleNoBonus Start time of public sale stage with no bonus.
   * @param _endTime Time when sale ends.
   * @param _rate ZXC/ETH exchange rate.
   * @param _presaleZxcCap Maximum number of ZXC offered for the presale.
   * @param _crowdSaleZxcSupply Supply of ZXC tokens offered for the sale. Includes _presaleZxcCap.
   * @param _bonusPresale Bonus token percentage for presale.
   * @param _bonusSale Bonus token percentage for public sale stage with bonus.
   * @param _minimumWeiDeposit Minimum required deposit in wei.
   */
  constructor(address _walletAddress,
    address _tokenAddress,
    address _xcertKycAddress,
    uint256 _startTimePresale,  // 1529971200: date -d '2018-06-26 00:00:00 UTC' +%s
    uint256 _startTimeSaleWithBonus, // 1530662400: date -d '2018-07-04 00:00:00 UTC' +%s
    uint256 _startTimeSaleNoBonus,  //1530748800: date -d '2018-07-05 00:00:00 UTC' +%s
    uint256 _endTime,  // 1531872000: date -d '2018-07-18 00:00:00 UTC' +%s
    uint256 _rate,  // 10000: 1 ETH = 10,000 ZXC
    uint256 _presaleZxcCap, // 195M
    uint256 _crowdSaleZxcSupply, // 250M
    uint256 _bonusPresale,  // 10 (%)
    uint256 _bonusSale,  // 5 (%)
    uint256 _minimumWeiDeposit  // 1 ether;
  )
    public
  {
    require(_walletAddress != address(0));
    require(_tokenAddress != address(0));
    require(_xcertKycAddress != address(0));
    require(_tokenAddress != _walletAddress);
    require(_tokenAddress != _xcertKycAddress);
    require(_xcertKycAddress != _walletAddress);

    token = Zxc(_tokenAddress);
    xcertKyc = Xcert(_xcertKycAddress);

    uint8 _tokenDecimals = token.decimals();
    require(_tokenDecimals == 18);  // Sanity check.
    wallet = _walletAddress;

    // Bonus should be > 0% and <= 100%
    require(_bonusPresale > 0 && _bonusPresale <= 100);
    require(_bonusSale > 0 && _bonusSale <= 100);

    bonusPresale = _bonusPresale;
    bonusSale = _bonusSale;

    require(_startTimePresale >= now);
    require(_startTimeSaleWithBonus > _startTimePresale);
    require(_startTimeSaleNoBonus > _startTimeSaleWithBonus);

    startTimePresale = _startTimePresale;
    startTimeSaleWithBonus = _startTimeSaleWithBonus;
    startTimeSaleNoBonus = _startTimeSaleNoBonus;
    endTime = _endTime;

    require(_rate > 0);
    rate = _rate;

    require(_crowdSaleZxcSupply > 0);
    require(token.totalSupply() >= _crowdSaleZxcSupply);
    crowdSaleZxcSupply = _crowdSaleZxcSupply;

    require(_presaleZxcCap > 0 && _presaleZxcCap <= _crowdSaleZxcSupply);
    preSaleZxcCap = _presaleZxcCap;

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
    buyTokens();
  }

  /**
   * @dev Low level token purchase function.
   */
  function buyTokens()
    public
    payable
  {
    address beneficiary = msg.sender;
    uint256 weiAmount = msg.value;
    uint256 tokens;

    // Sender needs Xcert KYC token.
    require(xcertKyc.balanceOf(beneficiary) > 0);

    if (isPresale()) {
      require(weiAmount >= minimumWeiDeposit);
      tokens = getTokenAmount(weiAmount, bonusPresale);
      require(tokens <= preSaleZxcCap);
    }
    else if (isPublicSaleWithBonus()) {
      tokens = getTokenAmount(weiAmount, bonusSale);
    }
    else if (isPublicSaleNoBonus()) {
      tokens = getTokenAmount(weiAmount, uint256(0));
    }
    else {
      revert("Purchase outside of token sale time windows");
    }

    require(zxcSold.add(tokens) <= crowdSaleZxcSupply);
    zxcSold = zxcSold.add(tokens);

    wallet.transfer(msg.value);
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
    bool capReached = zxcSold >= crowdSaleZxcSupply;
    bool endTimeReached = now >= endTime;
    return capReached || endTimeReached;
  }

  /**
   * @dev Check if currently active period is pre-sale with bonuses.
   * @return bool
   */
  function isPresale()
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
   * @param bonusPercent Percentage of bonus tokens.
   * @return Number of tokens with possible bonus.
   */
  function getTokenAmount(uint256 weiAmount, uint256 bonusPercent)
    internal
    view
    returns(uint256)
  {
    uint256 tokens = weiAmount.mul(rate);
    uint256 bonusTokens;

    if (bonusPercent > 0) {
      bonusTokens = tokens.mul(bonusPercent).div(uint256(100)); // tokens *  bonus (%) / 100%
      tokens = tokens.add(bonusTokens);
    }

    return tokens;
  }
}
