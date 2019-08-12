pragma solidity 0.5.2;

import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';
import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import './CUETips.sol';

contract CUEDisputeResolution is Ownable {
  using SafeMath for uint256;

  ERC20 public CUEToken;
  address public CUEBookingsAddress;
  address public CUEWallet = 0xe347570Ff1689326a3FB6CE43b29A727EAf87d31;

  struct Dispute {
    string status;
    address agent;
    address performer;
    uint256 pay;
    uint256 deposit;
  }

  mapping (bytes12 => Dispute) private disputes;
  mapping (address => bytes32) private arbitrators;
  address[] public arbitratorList;

  constructor(address _CUETokenAddress) public {
    CUEToken = ERC20(_CUETokenAddress);
    transferOwnership(msg.sender);
  }

  function setBookingsAddress(address _CUEBookingsAddress) public onlyOwner() {
    CUEBookingsAddress = _CUEBookingsAddress;
    transferOwnership(CUEBookingsAddress);
  }

  event NewDispute(bytes12 id, string status, address agent, address performer, uint256 pay, uint256 deposit);

  function addArbitrator(address _arbitrator, bytes32 _abitratorName) public onlyOwner() {
    arbitrators[_arbitrator] = _abitratorName;
    arbitratorList.push(_arbitrator) -1;
  }

  function removeArbitrator(address _arbitrator) public onlyOwner() {
    for (uint i = 0; i < arbitratorList.length; i++) {
      if (arbitratorList[i] == _arbitrator) {
        arbitratorList[i] = arbitratorList[arbitratorList.length - 1];
        delete arbitratorList[arbitratorList.length - 1];
        arbitratorList.length--;
      }
    }
    delete arbitrators[_arbitrator];
  }

  function getArbitratorCount() public view returns (uint count) {
    return arbitratorList.length;
  }

  function getArbitrator(address _arbitrator) public view returns (bytes32 arbitrator) {
    return arbitrators[_arbitrator];
  }

  function createDispute(bytes12 _id, address _agent, address _performer, uint256 _pay, uint256 _deposit) public onlyOwner() {
    Dispute storage dispute = disputes[_id];
    dispute.status = 'unresolved';
    dispute.agent = _agent;
    dispute.performer = _performer;
    dispute.pay = _pay;
    dispute.deposit = _deposit;

    emit NewDispute(_id, 'unresolved', _agent, _performer, _pay, _deposit);
  }

  function getDispute(bytes12 _id) public view returns (string memory status, address agent, address performer, uint256 pay, uint256 deposit) {
    return (
      disputes[_id].status,
      disputes[_id].agent,
      disputes[_id].performer,
      disputes[_id].pay,
      disputes[_id].deposit
    );
  }

  function returnOrPayout(address _beneficiary, uint256 _pay) private {
    CUEToken.transfer(_beneficiary, _pay);
  }

  function resolveDispute(bytes12 _id, bool _didPerformerWin) public {
    require(arbitrators[msg.sender].length != 0);
    Dispute storage dispute = disputes[_id];
    dispute.status = 'resolved';

    if (_didPerformerWin) {
      returnOrPayout(CUEWallet, dispute.deposit.div(2));
      returnOrPayout(dispute.performer, dispute.pay.add(dispute.deposit.div(2)));
    } else {
      returnOrPayout(CUEWallet, dispute.deposit.div(2));
      returnOrPayout(dispute.agent, dispute.pay.add(dispute.deposit.div(2)));
    }
  }
}