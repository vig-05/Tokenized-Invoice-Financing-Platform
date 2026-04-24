import { ethers } from 'ethers'
import { ESCROW_ADDRESS, getContracts } from './contract'
import { postSettlement } from './api'

let _provider = null
let _filter = null
let _handler = null

export async function startSettlementListener(investorAddress, onAdvice) {
  if (!window.ethereum) return
  if (_handler) stopSettlementListener()

  _provider = new ethers.BrowserProvider(window.ethereum)
  const { escrow } = getContracts(_provider)

  _filter = escrow.filters.InvoiceSettled(null, investorAddress)

  _handler = async (tokenId, investor, amount, event) => {
    try {
      const inv = await escrow.escrowEntries(tokenId)
      const invoiceAmountInr = Number(ethers.formatEther(inv.invoiceAmount || amount))
      const payoutWei = amount ? amount.toString() : '0'

      const result = await postSettlement({
        invoice_id: Number(tokenId),
        investor_address: investor,
        payout_wei: payoutWei,
        invoice_amount_inr: invoiceAmountInr,
      })
      onAdvice(result)
    } catch (err) {
      onAdvice({
        notification: `Invoice #${Number(tokenId)} settled.`,
        advice: 'Consider reinvesting in new invoice tokens for continued yield.',
        invoice_id: Number(tokenId),
        payout_inr: 0,
      })
    }
  }

  escrow.on(_filter, _handler)
}

export function stopSettlementListener() {
  if (!_provider || !_filter || !_handler) return
  try {
    const { escrow } = getContracts(_provider)
    escrow.off(_filter, _handler)
  } catch {}
  _provider = null
  _filter = null
  _handler = null
}
