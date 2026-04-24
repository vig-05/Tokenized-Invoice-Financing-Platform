const { ethers, network } = require("hardhat");
const fs   = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\nDeploying on network: ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} MATIC\n`);

  // ── 1. Deploy InvoiceToken ──────────────────────────────────────────────
  console.log("Deploying InvoiceToken...");
  const InvoiceToken = await ethers.getContractFactory("InvoiceToken");
  const invoiceToken = await InvoiceToken.deploy();
  await invoiceToken.waitForDeployment();
  const tokenAddress = await invoiceToken.getAddress();
  console.log(`  InvoiceToken deployed → ${tokenAddress}`);

  // ── 2. Deploy InvoiceEscrow (passes token address) ─────────────────────
  console.log("Deploying InvoiceEscrow...");
  const InvoiceEscrow = await ethers.getContractFactory("InvoiceEscrow");
  const invoiceEscrow = await InvoiceEscrow.deploy(tokenAddress);
  await invoiceEscrow.waitForDeployment();
  const escrowAddress = await invoiceEscrow.getAddress();
  console.log(`  InvoiceEscrow deployed → ${escrowAddress}`);

  // ── 3. Wire escrow into token ───────────────────────────────────────────
  console.log("\nSetting escrow contract on InvoiceToken...");
  const tx = await invoiceToken.setEscrowContract(escrowAddress);
  await tx.wait();
  console.log("  Done.");

  // ── 4. Persist addresses ────────────────────────────────────────────────
  const deployment = {
    network:              network.name,
    chainId:              network.config.chainId ?? 31337,
    deployer:             deployer.address,
    deployedAt:           new Date().toISOString(),
    InvoiceToken:         tokenAddress,
    InvoiceEscrow:        escrowAddress,
  };

  const outDir  = path.join(__dirname, "..", "deployments");
  const outFile = path.join(outDir, `${network.name}.json`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2));
  console.log(`\nDeployment saved → deployments/${network.name}.json`);

  // ── 5. Copy ABIs for frontend ───────────────────────────────────────────
  const abiDir = path.join(__dirname, "..", "frontend", "src", "utils", "abis");
  fs.mkdirSync(abiDir, { recursive: true });

  const tokenArtifact  = require(`../artifacts/contracts/InvoiceToken.sol/InvoiceToken.json`);
  const escrowArtifact = require(`../artifacts/contracts/InvoiceEscrow.sol/InvoiceEscrow.json`);

  fs.writeFileSync(path.join(abiDir, "InvoiceToken.json"),  JSON.stringify(tokenArtifact.abi,  null, 2));
  fs.writeFileSync(path.join(abiDir, "InvoiceEscrow.json"), JSON.stringify(escrowArtifact.abi, null, 2));
  console.log(`ABIs written → frontend/src/utils/abis/`);

  // ── 6. Summary ──────────────────────────────────────────────────────────
  console.log("\n════════════════════════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("════════════════════════════════════════════════════════");
  console.log(`  TOKEN_CONTRACT_ADDRESS  = ${tokenAddress}`);
  console.log(`  ESCROW_CONTRACT_ADDRESS = ${escrowAddress}`);
  console.log("════════════════════════════════════════════════════════");
  console.log("\nNext steps:");
  console.log("  1. Copy the two addresses above into your .env");
  console.log("  2. Copy them into frontend/src/utils/contract.js");
  console.log("  3. ABIs are already at frontend/src/utils/abis/");
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log(`  4. Verify on Polygonscan:\n     npx hardhat verify --network ${network.name} ${tokenAddress}`);
    console.log(`     npx hardhat verify --network ${network.name} ${escrowAddress} "${tokenAddress}"`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
