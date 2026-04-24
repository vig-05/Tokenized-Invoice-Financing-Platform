import { ethers } from 'ethers'
import InvoiceTokenABI  from './abis/InvoiceToken.json'
import InvoiceEscrowABI from './abis/InvoiceEscrow.json'

export const TOKEN_ADDRESS  = '0x9039ada3C6e1FcEb8c05Af9Ea7e45771580042DF'
export const ESCROW_ADDRESS = '0x2DBbc84b6455bc1F8F0e9aF715503330DECeCC6c'
export const AMOY_CHAIN_ID  = 80002

export async function connectWallet() {
  if (!window.ethereum) throw new Error('MetaMask is not installed')
  await window.ethereum.request({ method: 'eth_requestAccounts' })
  const provider = new ethers.BrowserProvider(window.ethereum)
  const network  = await provider.getNetwork()
  if (Number(network.chainId) !== AMOY_CHAIN_ID) {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x' + AMOY_CHAIN_ID.toString(16) }],
    }).catch(() => {
      throw new Error('Please switch MetaMask to Polygon Amoy testnet (chainId 80002)')
    })
  }
  const signer  = await provider.getSigner()
  const address = await signer.getAddress()
  return { provider, signer, address }
}

// Amoy requires a minimum priority fee of 25 gwei. Use 30 gwei tip + 60 gwei max
// to stay safely above the floor while keeping costs low on testnet.
const AMOY_GAS = {
  maxPriorityFeePerGas: ethers.parseUnits('30', 'gwei'),
  maxFeePerGas:         ethers.parseUnits('60', 'gwei'),
}

export function getContracts(signerOrProvider) {
  return {
    token:  new ethers.Contract(TOKEN_ADDRESS,  InvoiceTokenABI,  signerOrProvider),
    escrow: new ethers.Contract(ESCROW_ADDRESS, InvoiceEscrowABI, signerOrProvider),
  }
}

export async function listInvoice(signer, { invoiceAmountEth, dueDateUnix, invoiceHash, riskScore, advanceRateBps }) {
  const { escrow } = getContracts(signer)
  const tx = await escrow.listInvoice(
    ethers.parseEther(String(invoiceAmountEth)),
    dueDateUnix,
    invoiceHash,
    riskScore,
    advanceRateBps,
    ESCROW_ADDRESS,
    AMOY_GAS,
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
  const tx = await escrow.fundInvoice(BigInt(tokenId), { value: BigInt(advanceAmountWei), ...AMOY_GAS })
  return tx.wait()
}

export async function simulateBuyerPayment(signer, tokenId, invoiceAmountWei) {
  const { escrow } = getContracts(signer)
  const tx = await escrow.simulateBuyerPayment(BigInt(tokenId), { value: BigInt(invoiceAmountWei), ...AMOY_GAS })
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
