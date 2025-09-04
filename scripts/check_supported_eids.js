// scripts/check_supported_eids.js
require("dotenv").config();
const { ethers } = require("ethers");

const OFT_ABI = [
  "function peers(uint32 eid) external view returns (bytes32)",
  "function endpoint() external view returns (address)",
];

async function main() {
  const { RPC_URL_NEXUS_MAINNET, RPC_URL_BASE, ADDR_NEXUS_NATIVE_OFT, ADDR_BASE_OFT, EID_NEXUS, EID_BASE } =
    process.env;
  if (!RPC_URL_NEXUS_MAINNET || !RPC_URL_BASE || !ADDR_NEXUS_NATIVE_OFT || !ADDR_BASE_OFT || !EID_NEXUS || !EID_BASE) {
    throw new Error(
      "Missing RPC_URL_NEXUS_MAINNET or RPC_URL_BASE or ADDR_BASE_OFT or ADDR_NEXUS_NATIVE_OFT or EID_NEXUS or EID_BASE in env"
    );
  }

  const providerNexus = new ethers.providers.JsonRpcProvider(RPC_URL_NEXUS_MAINNET);
  const providerBase = new ethers.providers.JsonRpcProvider(RPC_URL_BASE);

  const oftNexusNative = new ethers.Contract(ADDR_NEXUS_NATIVE_OFT, OFT_ABI, providerNexus);
  const oftBase = new ethers.Contract(ADDR_BASE_OFT, OFT_ABI, providerBase);

  function bytes32ToAddress(bytes32) {
    return ethers.utils.getAddress("0x" + bytes32.slice(26));
  }

  const peerNexus = await oftNexusNative.peers(EID_BASE);
  if (bytes32ToAddress(peerNexus) == ADDR_BASE_OFT) {
    console.log(`  ✅ EID ${EID_BASE} BASE supported on NEXUS, peer: ${bytes32ToAddress(peerNexus)}`);
  } else {
    console.log(`  ❌ EID ${EID_BASE} BASE not set on NEXUS`);
  }

  const peerBase = await oftBase.peers(EID_NEXUS);
  if (bytes32ToAddress(peerBase) == ADDR_NEXUS_NATIVE_OFT) {
    console.log(`  ✅ EID ${EID_NEXUS} NEXUS supported on Base, peer: ${bytes32ToAddress(peerBase)}`);
  } else {
    console.log(`  ❌ EID ${EID_NEXUS} NEXUS not set on Base`);
  }

  const EP_addressBase = await oftBase.endpoint();
  const EP_addressNexus = await oftNexusNative.endpoint();

  console.log(`  - Base OFT Endpoint: ${EP_addressBase}`);
  console.log(`  - Nexus OFT Endpoint: ${EP_addressNexus}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
