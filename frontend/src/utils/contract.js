import { ethers } from 'ethers'
import InvoiceTokenABI  from './abis/InvoiceToken.json'
import InvoiceEscrowABI from './abis/InvoiceEscrow.json'

export const TOKEN_ADDRESS  = import.meta.env.VITE_TOKEN_CONTRACT_ADDRESS  || '0x5FbDB2315678afecb367f032d93F642f64180aa3'
export const ESCROW_ADDRESS = import.meta.env.VITE_ESCROW_CONTRACT_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'

export async function connectWallet() {
  if (!window.ethereum) throw new Error('MetaMask is not installed')
  await window.ethereum.request({ method: 'eth_requestAccounts' })
  const provider = new ethers.BrowserProvider(window.ethereum)
  const signer   = await provider.getSigner()
  const address  = await signer.getAddress()
  return { provider, signer, address }
}


export function getContracts(signerOrProvider) {
  return {
    token:  new ethers.Contract(TOKEN_ADDRESS,  InvoiceTokenABI,  signerOrProvider),
    escrow: new ethers.Contract(ESCROW_ADDRESS, InvoiceEscrowABI, signerOrProvider),
  }
}

export async function listInvoice(signer, { invoiceAmountEth, dueDateUnix, invoiceHash, riskScore, advanceRateBps }) {
  const { escrow } = getContracts(signer)
  const invoiceAmountWei = ethers.parseEther(String(invoiceAmountEth))
  const tx = await escrow.listInvoice(
    invoiceAmountWei,
    dueDateUnix,
    invoiceHash,
    riskScore,
    advanceRateBps,
    ESCROW_ADDRESS,
  )
  const receipt = await tx.wait()
  const iface  = new ethers.Interface(InvoiceEscrowABI)
  let tokenId  = null
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log)
      if (parsed?.name === 'InvoiceListed') tokenId = parsed.args.tokenId
    } catch {}
  }
  return { receipt, tokenId, txHash: receipt.hash }
}

export async function fundInvoice(signer, tokenId, advanceAmountWei) {
  const { escrow } = getContracts(signer)
  const tx = await escrow.fundInvoice(BigInt(tokenId), { value: BigInt(advanceAmountWei) })
  return tx.wait()
}

export async function simulateBuyerPayment(signer, tokenId, invoiceAmountWei) {
  const { escrow } = getContracts(signer)
  const tx = await escrow.simulateBuyerPayment(BigInt(tokenId), { value: BigInt(invoiceAmountWei) })
  return tx.wait()
}

export async function getTotalSupply(provider) {
  const { token } = getContracts(provider)
  return Number(await token.totalSupply())
}

export async function getInvoiceData(provider, tokenId) {
  const { token, escrow } = getContracts(provider)
  const [inv, entry] = await Promise.all([
    token.getInvoice(BigInt(tokenId)),
    escrow.escrowEntries(BigInt(tokenId)),
  ])
  return { inv, entry }
}

export async function getExpectedReturnBps(provider, tokenId) {
  const { escrow } = getContracts(provider)
  return Number(await escrow.expectedReturnBps(BigInt(tokenId)))
}

export function makeInvoiceHash(buyer, amountEth, dueDateUnix) {
  return ethers.keccak256(ethers.toUtf8Bytes(`${buyer}:${amountEth}:${dueDateUnix}`))
}

export const STATUS_LABELS = ['LISTED', 'FUNDED', 'SETTLED', 'DEFAULTED']
