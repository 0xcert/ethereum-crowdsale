pragma solidity ^0.4.24;

import "@0xcert/ethereum-zxc/contracts/tokens/Zxc.sol";
import "@0xcert/ethereum-utils/contracts/math/SafeMath.sol";


contract ZxcBigDecimals is Zxc {
  using SafeMath for uint256;

  constructor()
  Zxc()
  public
  {
    tokenDecimals = 50;
  }
}
