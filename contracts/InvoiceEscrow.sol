// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./InvoiceToken.sol";

/**
 * InvoiceEscrow — core logic for Nuvest invoice financing.
 *
 * Flow:
 *   SME calls listInvoice  → token minted, advance sent to SME
 *   Investor calls fundInvoice → advance locked in escrow, sent to SME
 *   Buyer pays (simulated) → invoiceAmount released to investor minus 1% fee
 *
 * Payment destination guard:
 *   listInvoice enforces paymentDest == address(this).
 *   Any invoice where the buyer's payment won't flow into this contract is rejected.
 */
contract InvoiceEscrow is Ownable, ReentrancyGuard {
    InvoiceToken public immutable invoiceToken;

    uint256 public constant FEE_BPS = 100;  // 1% platform fee in basis points
    uint256 public accumulatedFees;

    struct EscrowEntry {
        uint256 advanceAmount;   // locked by investor
        uint256 invoiceAmount;   // face value (what buyer owes)
        address payable investor;
        address payable sme;
        uint256 dueDate;
        bool    funded;
    }

    // tokenId → escrow state
    mapping(uint256 => EscrowEntry) public escrowEntries;

    event InvoiceListed(uint256 indexed tokenId, address indexed sme, uint256 invoiceAmount, uint256 advanceAmount);
    event InvoiceFunded(uint256 indexed tokenId, address indexed investor, uint256 advanceAmount);
    event InvoiceSettled(uint256 indexed tokenId, address indexed investor, uint256 payout, uint256 fee);
    event InvoiceDefaulted(uint256 indexed tokenId);
    event FeeWithdrawn(address indexed owner, uint256 amount);

    constructor(address _invoiceToken) Ownable(msg.sender) {
        invoiceToken = InvoiceToken(_invoiceToken);
    }

    /**
     * @notice SME lists an invoice and immediately receives the advance.
     * @param invoiceAmount  Face value of the invoice (in wei).
     * @param dueDate        Unix timestamp when buyer payment is due.
     * @param invoiceHash    keccak256 of the IPFS document CID.
     * @param riskScore      AI score 0–100.
     * @param advanceRateBps Advance rate in basis points (e.g. 9200 = 92%).
     * @param paymentDest    Must equal address(this) — enforces escrow routing.
     *
     * Payment destination guard: rejects any invoice where paymentDest != address(this).
     * This ensures the buyer's payment flows into escrow, not directly to the SME.
     */
    function listInvoice(
        uint256 invoiceAmount,
        uint256 dueDate,
        bytes32 invoiceHash,
        uint8   riskScore,
        uint256 advanceRateBps,
        address paymentDest
    ) external {
        require(paymentDest == address(this), "InvoiceEscrow: paymentDest must be this contract");
        require(invoiceAmount > 0, "InvoiceEscrow: invoice amount must be > 0");
        require(dueDate > block.timestamp, "InvoiceEscrow: due date must be in the future");
        require(advanceRateBps > 0 && advanceRateBps <= 10000, "InvoiceEscrow: invalid advance rate");
        require(riskScore >= 50, "InvoiceEscrow: score below minimum threshold (50)");

        uint256 advanceAmount = (invoiceAmount * advanceRateBps) / 10000;

        uint256 tokenId = invoiceToken.mint(
            msg.sender,
            invoiceAmount,
            advanceAmount,
            dueDate,
            invoiceHash,
            riskScore
        );

        escrowEntries[tokenId] = EscrowEntry({
            advanceAmount: advanceAmount,
            invoiceAmount: invoiceAmount,
            investor:      payable(address(0)),
            sme:           payable(msg.sender),
            dueDate:       dueDate,
            funded:        false
        });

        emit InvoiceListed(tokenId, msg.sender, invoiceAmount, advanceAmount);
    }

    /**
     * @notice Investor funds a listed invoice. Sends advance to the SME immediately.
     * @param tokenId The ERC721 token representing the invoice.
     */
    function fundInvoice(uint256 tokenId) external payable nonReentrant {
        EscrowEntry storage entry = escrowEntries[tokenId];
        InvoiceToken.Invoice memory inv = invoiceToken.getInvoice(tokenId);

        require(!entry.funded, "InvoiceEscrow: already funded");
        require(inv.status == InvoiceToken.InvoiceStatus.LISTED, "InvoiceEscrow: invoice not listed");
        require(msg.value == entry.advanceAmount, "InvoiceEscrow: incorrect advance amount sent");
        require(block.timestamp < entry.dueDate, "InvoiceEscrow: invoice is past due");

        entry.funded   = true;
        entry.investor = payable(msg.sender);

        invoiceToken.setInvestor(tokenId, msg.sender);
        invoiceToken.setStatus(tokenId, InvoiceToken.InvoiceStatus.FUNDED);

        // Disburse advance to SME immediately
        (bool sent, ) = entry.sme.call{value: entry.advanceAmount}("");
        require(sent, "InvoiceEscrow: SME disbursement failed");

        emit InvoiceFunded(tokenId, msg.sender, entry.advanceAmount);
    }

    /**
     * @notice Simulates buyer payment and settles the invoice.
     *         In production this is called by a Chainlink Automation job
     *         after a trusted backend co-signs off-chain payment confirmation.
     *         For the hackathon, the owner (or anyone post-dueDate) can call it.
     * @param tokenId The invoice token to settle.
     */
    function simulateBuyerPayment(uint256 tokenId) external payable nonReentrant {
        EscrowEntry storage entry = escrowEntries[tokenId];
        InvoiceToken.Invoice memory inv = invoiceToken.getInvoice(tokenId);

        require(entry.funded, "InvoiceEscrow: invoice not yet funded");
        require(inv.status == InvoiceToken.InvoiceStatus.FUNDED, "InvoiceEscrow: invoice not in FUNDED state");

        // Owner can settle anytime; anyone else can settle only after dueDate
        require(
            msg.sender == owner() || block.timestamp >= entry.dueDate,
            "InvoiceEscrow: only owner can settle before due date"
        );

        // Buyer sends invoiceAmount
        require(msg.value == entry.invoiceAmount, "InvoiceEscrow: must send full invoice amount");

        uint256 fee    = (entry.invoiceAmount * FEE_BPS) / 10000;   // 1%
        uint256 payout = entry.invoiceAmount - fee;

        accumulatedFees += fee;

        invoiceToken.setStatus(tokenId, InvoiceToken.InvoiceStatus.SETTLED);

        (bool sent, ) = entry.investor.call{value: payout}("");
        require(sent, "InvoiceEscrow: investor payout failed");

        emit InvoiceSettled(tokenId, entry.investor, payout, fee);
    }

    /**
     * @notice Owner marks an overdue invoice as defaulted.
     *         Does not slash the investor — future version integrates trade credit insurance.
     */
    function markDefault(uint256 tokenId) external onlyOwner {
        EscrowEntry storage entry = escrowEntries[tokenId];
        InvoiceToken.Invoice memory inv = invoiceToken.getInvoice(tokenId);

        require(entry.funded, "InvoiceEscrow: invoice not funded");
        require(inv.status == InvoiceToken.InvoiceStatus.FUNDED, "InvoiceEscrow: not in FUNDED state");
        require(block.timestamp > entry.dueDate, "InvoiceEscrow: due date not passed");

        invoiceToken.setStatus(tokenId, InvoiceToken.InvoiceStatus.DEFAULTED);

        emit InvoiceDefaulted(tokenId);
    }

    /**
     * @notice Owner withdraws accumulated 1% platform fees.
     */
    function withdrawFee() external onlyOwner nonReentrant {
        uint256 amount = accumulatedFees;
        require(amount > 0, "InvoiceEscrow: no fees to withdraw");
        accumulatedFees = 0;

        (bool sent, ) = payable(owner()).call{value: amount}("");
        require(sent, "InvoiceEscrow: fee withdrawal failed");

        emit FeeWithdrawn(owner(), amount);
    }

    /**
     * @notice Returns the investor's expected return in basis points above the advance.
     *         e.g., advance = 92, face = 100, fee = 1 → payout = 99, return = 7.6% ≈ 760 bps
     */
    function expectedReturnBps(uint256 tokenId) external view returns (uint256) {
        EscrowEntry memory entry = escrowEntries[tokenId];
        require(entry.advanceAmount > 0, "InvoiceEscrow: invoice not found");

        uint256 fee    = (entry.invoiceAmount * FEE_BPS) / 10000;
        uint256 payout = entry.invoiceAmount - fee;

        if (payout <= entry.advanceAmount) return 0;
        return ((payout - entry.advanceAmount) * 10000) / entry.advanceAmount;
    }

    // Accept plain ETH (for simulateBuyerPayment forwarding)
    receive() external payable {}
}
