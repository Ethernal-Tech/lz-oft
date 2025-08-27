// scripts/lzv2_wire_and_send.js
// Usage: node scripts/lzv2_wire_and_send.js
//
// .env needed:
//   PRIVATE_KEY=0x...
//   RPC_URL_SEPOLIA=...
//   RPC_URL_AMOY=...
//   ADDR_SEPOLIA_NATIVE_OFT=0x...   // NativeOFTAdapter on Sepolia
//   ADDR_AMOY_OFT=0x...             // OFT on Amoy
// Optional:
//   SEND_AMOUNT=0.01                // amount of native to bridge (in ETH units)
//   LZV2_DVNS_JSON=[ "0x...", ... ]
//   LZV2_EXECUTOR=0x...
require('dotenv').config();
const { ethers } = require('ethers');
const NativeOFTAdapterArtifact = require('../artifacts/contracts/MyNativeOFTAdapter.sol/MyNativeOFTAdapter.json');
const OFTArtifact = require('../artifacts/contracts/MyOFT.sol/MyOFT.json');
const { Options } = require('@layerzerolabs/lz-v2-utilities');

// Minimal ABIs (OFT v2-ish)
const NATIVE_OFT_ADAPTER_ABI = NativeOFTAdapterArtifact.abi;
const OFT_ABI = OFTArtifact.abi;

const toBytes32Address = (addr) => ethers.utils.hexZeroPad(ethers.utils.getAddress(addr), 32);
const fmt = (bn, d = 18) => ethers.utils.formatUnits(bn, d);

async function main() {
    const {
        OWNER_ADDRESS,
        PRIVATE_KEY,
        RPC_URL_SEPOLIA,
        RPC_URL_AMOY,
        ADDR_SEPOLIA_NATIVE_OFT,
        ADDR_AMOY_OFT,
        SEND_AMOUNT,
        EID_AMOY,
        EID_SEPOLIA,
    } = process.env;

    if (
        !OWNER_ADDRESS ||
        !PRIVATE_KEY ||
        !RPC_URL_SEPOLIA ||
        !RPC_URL_AMOY ||
        !ADDR_SEPOLIA_NATIVE_OFT ||
        !ADDR_AMOY_OFT
    ) {
        throw new Error('Missing one of the required env vars');
    }

    const amount = ethers.utils.parseUnits(SEND_AMOUNT || '0.5', 18);

    const provSepolia = new ethers.providers.JsonRpcProvider(RPC_URL_SEPOLIA);
    const provAmoy = new ethers.providers.JsonRpcProvider(RPC_URL_AMOY);
    const walletSepolia = new ethers.Wallet(PRIVATE_KEY, provSepolia);
    const walletAmoy = new ethers.Wallet(PRIVATE_KEY, provAmoy);

    const nativeOFT_Sepolia = new ethers.Contract(ADDR_SEPOLIA_NATIVE_OFT, NATIVE_OFT_ADAPTER_ABI, walletSepolia);
    const oft_Amoy = new ethers.Contract(ADDR_AMOY_OFT, OFT_ABI, walletAmoy);

    console.log('Sepolia NativeOFTAdapter:', nativeOFT_Sepolia.address);
    console.log('Amoy OFT:', oft_Amoy.address);

    // 1) Wire peers
    console.log('\n[1/4] Connecting peers...');
    const wantPeerOnSepolia = toBytes32Address(ADDR_AMOY_OFT);
    const wantPeerOnAmoy = toBytes32Address(ADDR_SEPOLIA_NATIVE_OFT);

    const currentPeerOnSepolia = await nativeOFT_Sepolia.peers(EID_AMOY);
    if (currentPeerOnSepolia.toLowerCase() !== wantPeerOnSepolia.toLowerCase()) {
        const tx = await nativeOFT_Sepolia.setPeer(EID_AMOY, wantPeerOnSepolia);
        console.log('  → setPeer on Sepolia:', tx.hash);
        await tx.wait();
    } else {
        console.log('  ✓ Sepolia already wired to Amoy: ', currentPeerOnSepolia.toLowerCase());
    }

    // Amoy sometimes needs a higher gas price
    // Amoy sometimes needs a higher gas price
    const forceAmoyGas = async (prov) => {
        const base = await prov.getGasPrice();
        const min = ethers.utils.parseUnits('30', 'gwei');
        return base.lt(min) ? min : base;
    };

    const amoyGasPrice = await forceAmoyGas(provAmoy);
    const currentPeerOnAmoy = await oft_Amoy.peers(EID_SEPOLIA);

    if (currentPeerOnAmoy.toLowerCase() !== wantPeerOnAmoy.toLowerCase()) {
        const tx = await oft_Amoy.setPeer(EID_SEPOLIA, wantPeerOnAmoy, { gasPrice: amoyGasPrice });
        console.log('  → setPeer on Amoy:', tx.hash);
        await tx.wait();
    } else {
        console.log('  ✓ Amoy already wired to Sepolia: ', currentPeerOnAmoy.toLowerCase());
    }

    // 2) (Optional) DVNs / Executor -> Currently not doing anything
    console.log('\n[2/4] Configuring DVNs & Executor (optional)...');
    // if (LZV2_DVNS_JSON) {
    //     console.log('  (skipped here; ensure your contract exposes setConfig if you enable this)');
    // } else {
    //     console.log('  (DVNs) skipped — using defaults');
    // }
    // if (LZV2_EXECUTOR) {
    //     console.log('  (skipped here; ensure your contract exposes setConfig if you enable this)');
    // } else {
    //     console.log('  (Executor) skipped — using defaults');
    // }

    // 3) Send native Sepolia -> Amoy

    const recipientOnAmoy = '0xd2711A49Ff4A2EDF1e6b9D7b10e56A4592c1Efc6';

    const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString();

    const sendParam = {
        dstEid: 40267,
        to: toBytes32Address(recipientOnAmoy),
        amountLD: ethers.utils.parseUnits('2', 18),
        minAmountLD: 0,
        extraOptions: options,
        composeMsg: '0x',
        oftCmd: '0x',
    };

    // 3) Quote the fee
    let nativeFee;
    try {
        const feeResponse = await nativeOFT_Sepolia.quoteSend(sendParam, false);
        nativeFee = feeResponse.nativeFee;
        console.log('Quoted fee:', fmt(nativeFee), 'ETH');
    } catch (e) {
        console.warn('Quote failed, using fallback fee 0.3 ETH');
        nativeFee = ethers.utils.parseEther('0.3');
    }

    const value = nativeFee.add(amount);

    // // Dry-run with callStatic
    // try {
    //     const [msgReceipt, oftReceipt] = await nativeOFT_Sepolia.callStatic.send(
    //         sendParam,
    //         { nativeFee, lzTokenFee: 0 },
    //         walletSepolia.address, // refund address
    //         {
    //             value: nativeFee.add(sendParam.amountLD), // tokens + fee
    //         }
    //     );

    //     console.log('✅ CallStatic succeeded!');
    //     console.log('Message GUID:', msgReceipt.guid);
    //     console.log('Expected fee:', msgReceipt.fee.toString());
    //     console.log('Amount to be bridged:', oftReceipt.amountReceivedLD.toString());
    // } catch (err) {
    //     console.error('❌ CallStatic reverted:', err.reason || err);
    // }

    // // 4) Send
    // let txSend;
    // try {
    //     txSend = await nativeOFT_Sepolia.send(sendParam, { nativeFee, lzTokenFee: 0 }, walletSepolia.address, {
    //         value: sendParam.amountLD.add(nativeFee), // only once!
    //         gasLimit: 1_500_000,
    //     });
    //     await txSend.wait();
    //     console.log('Send tx hash:', txSend.hash);
    // } catch (e) {
    //     console.error('Send failed:', e);
    //     process.exit(1);
    // }

    // 5) Verify balance on Amoy
    const balBefore = await oft_Amoy.balanceOf(walletAmoy.address);
    console.log('Balance after send:', fmt(balBefore));
    // const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    // let ok = false;
    // for (let i = 0; i < 20; i++) {
    //     await sleep(6000);
    //     const now = await oft_Amoy.balanceOf(walletAmoy.address);
    //     if (now.gt(balBefore)) {
    //         console.log(`Balance increased: ${fmt(balBefore)} → ${fmt(now)}`);
    //         ok = true;
    //         break;
    //     } else {
    //         process.stdout.write('.');
    //     }
    // }
    // if (!ok) console.log('\nBalance not updated yet — delivery may be in-flight.');
    // console.log('All steps done ✅');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
