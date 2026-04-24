// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract InvoiceToken is ERC721, Ownable {
    enum InvoiceStatus { LISTED, FUNDED, SETTLED, DEFAULTED }

    struct Invoice {
        uint256 invoiceAmount;   // face value in wei (proxy for INR via test MATIC)
        uint256 advanceAmount;   // amount disbursed to SME
        uint256 dueDate;         // unix timestamp
        address smeWallet;
        address investorWallet;
        bytes32 invoiceHash;     // keccak256 of IPFS CID
        uint8   riskScore;       // 0–100
        InvoiceStatus status;
    }

    uint256 private _nextTokenId;

    // tokenId → Invoice metadata
    mapping(uint256 => Invoice) public invoices;

    // only the escrow contract may mint / update status
    address public escrowContract;

    event InvoiceMinted(uint256 indexed tokenId, address indexed sme, uint256 invoiceAmount);
    event StatusUpdated(uint256 indexed tokenId, InvoiceStatus newStatus);

    modifier onlyEscrow() {
        require(msg.sender == escrowContract, "InvoiceToken: caller is not escrow");
        _;
    }

    constructor() ERC721("NuvestInvoice", "NVI") Ownable(msg.sender) {}

    function setEscrowContract(address _escrow) external onlyOwner {
        escrowContract = _escrow;
    }

    function mint(
        address          smeWallet,
        uint256          invoiceAmount,
        uint256          advanceAmount,
        uint256          dueDate,
        bytes32          invoiceHash,
        uint8            riskScore
    ) external onlyEscrow returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _safeMint(smeWallet, tokenId);

        invoices[tokenId] = Invoice({
            invoiceAmount:  invoiceAmount,
            advanceAmount:  advanceAmount,
            dueDate:        dueDate,
            smeWallet:      smeWallet,
            investorWallet: address(0),
            invoiceHash:    invoiceHash,
            riskScore:      riskScore,
            status:         InvoiceStatus.LISTED
        });

        emit InvoiceMinted(tokenId, smeWallet, invoiceAmount);
    }

    function setInvestor(uint256 tokenId, address investor) external onlyEscrow {
        invoices[tokenId].investorWallet = investor;
    }

    function setStatus(uint256 tokenId, InvoiceStatus newStatus) external onlyEscrow {
        invoices[tokenId].status = newStatus;
        emit StatusUpdated(tokenId, newStatus);
    }

    function getInvoice(uint256 tokenId) external view returns (Invoice memory) {
        return invoices[tokenId];
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }
}
