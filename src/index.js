import React from 'react'
import ReactDOM from 'react-dom'
import Contract from './contract'
import BN from 'bn.js'

const DECIMALS = 18;
const CARRY_OVER = 2;
const coinMultiplier = new BN(10).pow(new BN(DECIMALS - CARRY_OVER));

const Index = class Index extends React.Component {
  constructor(props) {
    super(props)

    this.contract = new Contract()

    this.state = {
      isSending: false,
      tx: null,
    }
  }

  async componentWillMount() {
    await this.contract.loadContract()
    const fullBalance = await this.contract.getBalance();
    const balance = Number(new BN(fullBalance).div(coinMultiplier).toString()) / (10 ** CARRY_OVER).toFixed(2);
    this.setState({ balance })
  }

  async confirmTransfer() {
    this.setState({isSending: true})
    try {
      const tx = await this.contract.tip(this.state.address, this.state.amount)
      this.setState({ tx })
    } catch (err) {
      console.error('Oops, some error happened:', err)
    }

    this.setState({isSending: false})
  }

  render() {
    return (
      <div className="container" style={{ marginTop: 10 }}>
        <form onSubmit={e => { e.preventDefault(); }}>
          <div className="form-group">
            <label>Tip a user account</label>
            <small className="form-text text-muted">Address to tip</small>
            <input type="text" className="form-control" onChange={(e) => this.setState({ address: e.target.value })} />
            <small className="form-text text-muted">Amount</small>
            <input type="number" className="form-control" onChange={(e) => this.setState({ amount: e.target.value })} />
          </div>
          <button type="button" disabled={ !this.state.address && !this.state.amount } className="btn btn-primary" onClick={() => this.confirmTransfer()}>Confirm</button>
        </form>
        <div className="alert alert-success">
          Your balance is { this.state.balance }
        </div>
        <hr />
        <pre>
          {this.state.tx && JSON.stringify(this.state.tx, null, 2)}
        </pre>
      </div>
    )
  }
}

ReactDOM.render(<Index />, document.getElementById('root'))

