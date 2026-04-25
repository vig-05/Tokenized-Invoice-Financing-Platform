require("@nomicfoundation/hardhat-toolbox");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const POLYGONSCAN_API_KEY  = process.env.POLYGONSCAN_API_KEY  || "";
const AMOY_RPC_URL         = process.env.AMOY_RPC_URL         || "https://rpc-amoy.polygon.technology";

// Strip whitespace and surrounding quotes that Windows editors / copy-paste often add.
// A valid key is exactly "0x" + 64 hex chars = 66 characters.
function loadPrivateKey() {
  const raw = process.env.DEPLOYER_PRIVATE_KEY;
  if (!raw) {
    throw new Error(
      "\n\nMissing DEPLOYER_PRIVATE_KEY.\n" +
      "  1. Copy .env.example → .env\n" +
      "  2. Paste your test wallet private key (with 0x prefix) into DEPLOYER_PRIVATE_KEY\n"
    );
  }
  const key = raw.trim().replace(/^["']|["']$/g, "");
  const normalized = key.startsWith("0x") ? key : "0x" + key;
  const hexPart = normalized.slice(2);
  console.log(
    `[hardhat.config] DEPLOYER_PRIVATE_KEY: raw.length=${raw.length} ` +
    `stripped.length=${normalized.length} hexBytes=${hexPart.length / 2}`
  );
  if (hexPart.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hexPart)) {
    throw new Error(
      `\n\nDEPLOYER_PRIVATE_KEY is invalid.\n` +
      `  Expected 32 hex bytes (64 hex chars + optional 0x prefix).\n` +
      `  Got ${hexPart.length / 2} bytes after stripping whitespace/quotes.\n` +
      `  Raw value length from .env: ${raw.length} chars.\n` +
      `  Hint: the key must be exactly 64 hex characters (0–9, a–f).\n`
    );
  }
  return normalized;
}

// Only load private key when deploying to a real network
const isLocalNetwork = !process.env.HARDHAT_NETWORK ||
  ["hardhat", "localhost"].includes(process.env.HARDHAT_NETWORK);
const DEPLOYER_PRIVATE_KEY = isLocalNetwork
  ? "0x" + "0".repeat(64)  // dummy key — never used locally
  : loadPrivateKey();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
    },
  },

  networks: {
    // Local dev
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
    },

    // Polygon Amoy testnet (Mumbai was deprecated April 2024)
    amoy: {
      url:      AMOY_RPC_URL,
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId:  80002,
      maxFeePerGas:         35000000000,  // 35 gwei
      maxPriorityFeePerGas: 25000000000,  // 25 gwei — Amoy minimum tip cap
    },

    // Polygon mainnet (production — not used in hackathon)
    polygon: {
      url:      process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId:  137,
    },
  },

  etherscan: {
    apiKey: {
      polygonAmoy: POLYGONSCAN_API_KEY,
      polygon:     POLYGONSCAN_API_KEY,
    },
    customChains: [
      {
        network:  "polygonAmoy",
        chainId:  80002,
        urls: {
          apiURL:     "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com",
        },
      },
    ],
  },

  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
};
