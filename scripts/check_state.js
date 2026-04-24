const { ethers } = require("hardhat");

async function main() {
  const TOKEN  = "0xDEDc841f00d7f2D54cD8d87F184eaEe7C835dE3f";
  const ESCROW = "0x9cfFe43027C5ab57303e09f3224080672bce2A09";

  const token  = await ethers.getContractAt("InvoiceToken",  TOKEN);
  const escrow = await ethers.getContractAt("InvoiceEscrow", ESCROW);

  const setEscrow = await token.escrowContract();
  console.log("InvoiceToken.escrowContract() =", setEscrow);
  console.log("Expected ESCROW_ADDRESS       =", ESCROW);
  console.log("Wired correctly:", setEscrow.toLowerCase() === ESCROW.toLowerCase());

  const supply = await token.totalSupply();
  console.log("totalSupply:", supply.toString());

  const [signer] = await ethers.getSigners();
  const dueDate = Math.floor(Date.now() / 1000) + 60 * 86400;
  const hash = ethers.keccak256(ethers.toUtf8Bytes("test:0.1:" + dueDate));

  console.log("\n--- Simulating listInvoice via staticCall ---");
  console.log("from      :", signer.address);
  console.log("invoiceAmt:", ethers.parseEther("0.1").toString(), "wei");
  console.log("dueDate   :", dueDate, "(+60 days from now)");
  console.log("riskScore :", 85);
  console.log("advanceBps:", 9200);
  console.log("paymentDst:", ESCROW);

  try {
    await escrow.listInvoice.staticCall(
      ethers.parseEther("0.1"),
      dueDate,
      hash,
      85,
      9200,
      ESCROW,
      { from: signer.address }
    );
    console.log("\nstaticCall: SUCCESS — contract will accept this call");
  } catch (e) {
    console.log("\nstaticCall REVERT:", e.reason || e.message);
  }
}

main().catch(console.error);
