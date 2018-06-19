pragma solidity ^0.4.24;

import "../../contracts/crowdsale/ZxcCrowdsale.sol";


/**
  * @title This contract adds additional test functions to the crowdsale contract.
  * Used to properly test internal functions and contract states which would otherwise be
  * hard to set up. There are two types of functions; one change contract state and other
  * visibility of contract functions. Both have their own naming pattern:
  * 1. Ones that change values of contract variables: `_testSet<variableName>()`.
  * 2. Ones that change function visibility: `<functionName>Wrapper()`.
  */
contract ZxcCrowdsaleTestable is ZxcCrowdsale {
  /**
   * @dev Tester's address who gains access to super powers.
   */
  address public contractTesterAddr;

  /**
   * @dev check tester's address who is the only one allowed to call _test functions
   */
  modifier onlyTester() {
    require(msg.sender == contractTesterAddr);
    _;
  }

  constructor(
    address _walletAddress,
    address _tokenAddress,
    address _xcertKycAddress,
    uint256 _startTimePresale,
    uint256 _startTimeSaleWithBonus,
    uint256 _startTimeSaleNoBonus,
    uint256 _endTime,
    uint256 _rate,
    uint256 _presaleZxcCap,
    uint256 _crowdSaleZxcSupply,
    uint256 _bonusPresale,
    uint256 _bonusSale,
    uint256 _minimumPresaleWeiDeposit,
    address _contractTesterAddr
  )
    ZxcCrowdsale(
      _walletAddress,
      _tokenAddress,
      _xcertKycAddress,
      _startTimePresale,
      _startTimeSaleWithBonus,
      _startTimeSaleNoBonus,
      _endTime,
      _rate,
      _presaleZxcCap,
      _crowdSaleZxcSupply,
      _bonusPresale,
      _bonusSale,
      _minimumPresaleWeiDeposit
    )
    public
  {
    contractTesterAddr = _contractTesterAddr;
  }

  /**
   * @dev Sets zxcSold value.
   * @param amount New amount.
   */
  function _testSetZxcSold(
    uint256 amount
  )
    external
  {
    zxcSold = amount;
  }

  /**
   * @dev Modify visibility for internal isInTimeRange function.
   */
  function isInTimeRangeWrapper(uint256 _startTime, uint256 _endTime)
    external
    view
    returns (bool)
  {
    return super.isInTimeRange(_startTime, _endTime);
  }

  /**
   * @dev Modify visibility for internal getTokenAmount function.
   * @param weiAmount amount of wei
   */
  function getTokenAmountWrapper(
    uint256 weiAmount,
    uint256 bonusPercent
  )
    external
    view
    returns (uint256)
  {
    return super.getTokenAmount(weiAmount, bonusPercent);
  }

}
