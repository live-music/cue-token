pragma solidity 0.5.2;

import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';
import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';

contract CUETips is Ownable {
  using SafeMath for uint256;

  address public CUEWallet = 0xe347570Ff1689326a3FB6CE43b29A727EAf87d31;

  address CUETokenAddress;
  ERC20 public CUEToken;

  constructor(address _CUETokenAddress) public {
    CUETokenAddress = _CUETokenAddress;
  }

  event TransferSuccessful(address indexed _from, address indexed _to, uint256 _amount, string _room);
  event TransferFailed(address indexed _from, address indexed _to, uint256 _amount, string _room);

  function calculateCueShare(uint256 _amount) internal pure returns (uint256) {
    uint256 share = _amount.div(2);
    return share;
  }

  function calculateUserShare(uint256 _amount, uint256 _cueShare) internal pure returns (uint256) {
    uint256 share = _amount.sub(_cueShare);
    return share;
  }

  function tip(address _to, uint256 _amount, string memory _room) public {
    CUEToken = ERC20(CUETokenAddress);
    require(_amount > 0);

    address _from = msg.sender;
    if(_amount > CUEToken.allowance(_from, address(this))) {
      emit TransferFailed(_from, _to, _amount, _room);
      revert();
    }

    uint256 _cueShare = calculateCueShare(_amount);
    uint256 _userShare = calculateUserShare(_amount, _cueShare);

    CUEToken.transferFrom(_from, CUEWallet, _cueShare);
    CUEToken.transferFrom(_from, _to, _userShare);
    emit TransferSuccessful(_from, _to, _amount, _room);
  }
}