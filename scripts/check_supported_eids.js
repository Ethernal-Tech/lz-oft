// scripts/check_supported_eids.js
require('dotenv').config();
const { ethers } = require('ethers');

const OFT_ABI = [
    'function peers(uint32 eid) external view returns (bytes32)',
    'function endpoint() external view returns (address)',
];

async function main() {
    const { RPC_URL_SEPOLIA, RPC_URL_AMOY, ADDR_SEPOLIA_NATIVE_OFT, ADDR_AMOY_OFT, EID_AMOY, EID_SEPOLIA } =
        process.env;
    if (!RPC_URL_SEPOLIA || !RPC_URL_AMOY || !ADDR_SEPOLIA_NATIVE_OFT || !ADDR_AMOY_OFT || !EID_AMOY || !EID_SEPOLIA) {
        throw new Error(
            'Missing RPC_URL_SEPOLIA or ADDR_SEPOLIA_NATIVE_OFT or ADDR_SEPOLIA_NATIVE_OFT or ADDR_AMOY_OFT or EID_AMOY or EID_SEPOLIA in env'
        );
    }

    const providerSepolia = new ethers.providers.JsonRpcProvider(RPC_URL_SEPOLIA);
    const providerAmoy = new ethers.providers.JsonRpcProvider(RPC_URL_AMOY);

    const oftSepoliaNative = new ethers.Contract(ADDR_SEPOLIA_NATIVE_OFT, OFT_ABI, providerSepolia);
    const oftAmoy = new ethers.Contract(ADDR_AMOY_OFT, OFT_ABI, providerAmoy);

    function bytes32ToAddress(bytes32) {
        return ethers.utils.getAddress('0x' + bytes32.slice(26));
    }

    const peerSepolia = await oftSepoliaNative.peers(EID_AMOY);
    if (bytes32ToAddress(peerSepolia) == ADDR_AMOY_OFT) {
        console.log(`  ✅ EID ${EID_AMOY} AMOY supported on SEPOLIA, peer: ${bytes32ToAddress(peerSepolia)}`);
    } else {
        console.log(`  ❌ EID ${EID_AMOY} AMOY not set on SEPOLIA`);
    }

    const peerAmoy = await oftAmoy.peers(EID_SEPOLIA);
    if (bytes32ToAddress(peerAmoy) == ADDR_SEPOLIA_NATIVE_OFT) {
        console.log(`  ✅ EID ${EID_SEPOLIA} SEPOLIA supported on AMOY, peer: ${bytes32ToAddress(peerAmoy)}`);
    } else {
        console.log(`  ❌ EID ${EID_SEPOLIA} SEPOLIA not set on AMOY`);
    }

    const EP_addressSepolia = await oftSepoliaNative.endpoint();
    const EP_addressAmoy = await oftAmoy.endpoint();

    console.log(`  - Sepolia OFT Endpoint: ${EP_addressSepolia}`);
    console.log(`  - Amoy OFT Endpoint: ${EP_addressAmoy}`);
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
