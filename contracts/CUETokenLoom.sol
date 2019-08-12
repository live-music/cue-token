pragma solidity 0.5.2;

import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';
  
contract CUETokenLoom is ERC20 {
  string public name = "CUE Token";
  string public symbol = "CUE";
  uint8 public decimals = 18;
  uint public INITIAL_SUPPLY = 1000000000;
  address public gateway;

  constructor(address _gateway) public {
    gateway = _gateway;
  }

  function mintToGateway(uint256 _amount) public {
    require(msg.sender == gateway, "only the gateway is allowed to mint");
    _mint(msg.sender, _amount);
  }
}