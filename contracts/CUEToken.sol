pragma solidity 0.5.2;

import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';

contract CUEToken is ERC20 {
  string public name = "CUE Token";
  string public symbol = "CUE";
  uint8 public decimals = 18;
  uint public INITIAL_SUPPLY = 1000000000;

  constructor() public {
    _mint(msg.sender, INITIAL_SUPPLY.mul(10 ** uint256(decimals)));
  }
}