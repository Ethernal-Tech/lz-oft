// scripts/check_supported_eids.js
require("dotenv").config();
const { ethers } = require("ethers");

const OFT_ABI = [
  "function peers(uint32 eid) external view returns (bytes32)",
  "function endpoint() external view returns (address)",
];

async function main() {
  const { RPC_URL_SEPOLIA, RPC_URL_NEXUS, ADDR_NEXUS_NATIVE_OFT, ADDR_SEPOLIA_OFT, EID_NEXUS, EID_SEPOLIA } =
    process.env;
  if (!RPC_URL_SEPOLIA || !RPC_URL_NEXUS || !ADDR_NEXUS_NATIVE_OFT || !ADDR_SEPOLIA_OFT || !EID_NEXUS || !EID_SEPOLIA) {
    throw new Error(
      "Missing RPC_URL_SEPOLIA or RPC_URL_NEXUS or ADDR_SEPOLIA_NATIVE_OFT or ADDR_NEXUS_NATIVE_OFT or EID_NEXUS or EID_SEPOLIA in env"
    );
  }

  const providerNexus = new ethers.providers.JsonRpcProvider(RPC_URL_NEXUS);
  const providerSepolia = new ethers.providers.JsonRpcProvider(RPC_URL_SEPOLIA);

  const oftNexusNative = new ethers.Contract(ADDR_NEXUS_NATIVE_OFT, OFT_ABI, providerNexus);
  const oftSepolia = new ethers.Contract(ADDR_SEPOLIA_OFT, OFT_ABI, providerSepolia);

  function bytes32ToAddress(bytes32) {
    return ethers.utils.getAddress("0x" + bytes32.slice(26));
  }

  const peerSepolia = await oftSepolia.peers(EID_NEXUS);
  if (bytes32ToAddress(peerSepolia) == ADDR_NEXUS_NATIVE_OFT) {
    console.log(`  ✅ EID ${EID_NEXUS} NEXUS supported on SEPOLIA, peer: ${bytes32ToAddress(peerSepolia)}`);
  } else {
    console.log(`  ❌ EID ${EID_AMOY} NEXUS not set on SEPOLIA`);
  }

  const peerNexus = await oftNexusNative.peers(EID_SEPOLIA);
  if (bytes32ToAddress(peerNexus) == ADDR_SEPOLIA_OFT) {
    console.log(`  ✅ EID ${EID_SEPOLIA} SEPOLIA supported on NEXUS, peer: ${bytes32ToAddress(peerNexus)}`);
  } else {
    console.log(`  ❌ EID ${EID_SEPOLIA} SEPOLIA not set on NEXUS`);
  }

  const EP_addressSepolia = await oftSepolia.endpoint();
  const EP_addressNexus = await oftNexusNative.endpoint();

  console.log(`  - Sepolia OFT Endpoint: ${EP_addressSepolia}`);
  console.log(`  - Nexus OFT Endpoint: ${EP_addressNexus}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
