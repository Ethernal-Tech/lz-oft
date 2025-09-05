// scripts/lzv2_wire_and_send.js
// Usage: node scripts/lzv2_wire_and_send.js
//
// .env needed:
//   OWNER_ADDRESS=0x...  // your address
//   PRIVATE_KEY=0x...
//   RPC_URL_NEXUS_MAINNET=...
//   RPC_URL_BASE_MAINNET=...
//   RPC_URL_BNB_MAINNET=...
//   ADDR_NEXUS_NATIVE_OFT=0x...   // NativeOFTAdapter on Nexus
//   ADDR_BASE_OFT=0x...           // OFT on Base
//   ADDR_BNB_OFT=0x...            // OFT on BNB
//   EID_NEXUS=30384                 // Nexus Mainnet EID
//   EID_BASE=30184                  // Base Mainnet EID
//   EID_BNB=204                     // BNB Mainnet EID
// Optional:
//   SEND_AMOUNT=0.1                // amount of native to bridge (in ETH units)

require("dotenv").config();
const { ethers, utils } = require("ethers");
const NativeOFTAdapterArtifact = require("../artifacts/contracts/MyNativeOFTAdapter.sol/MyNativeOFTAdapter.json");
const OFTArtifact = require("../artifacts/contracts/MyOFT.sol/MyOFT.json");
const { Options } = require("@layerzerolabs/lz-v2-utilities");

// Minimal ABIs (OFT v2-ish)
const NATIVE_OFT_ADAPTER_ABI = NativeOFTAdapterArtifact.abi;
const OFT_ABI = OFTArtifact.abi;

const toBytes32Address = (addr) => ethers.utils.hexZeroPad(ethers.utils.getAddress(addr), 32);
const fmt = (bn, d = 18) => ethers.utils.formatUnits(bn, d);

async function main() {
  const {
    OWNER_ADDRESS,
    PRIVATE_KEY,
    RPC_URL_NEXUS_MAINNET,
    RPC_URL_BASE_MAINNET,
    RPC_URL_BNB_MAINNET,
    ADDR_NEXUS_NATIVE_OFT,
    ADDR_BASE_OFT,
    ADDR_BNB_OFT,
    EID_NEXUS,
    EID_BASE,
    EID_BNB,
  } = process.env;

  if (
    !OWNER_ADDRESS ||
    !PRIVATE_KEY ||
    !RPC_URL_NEXUS_MAINNET ||
    !RPC_URL_BASE_MAINNET ||
    !RPC_URL_BNB_MAINNET ||
    !ADDR_NEXUS_NATIVE_OFT ||
    !ADDR_BASE_OFT ||
    !ADDR_BNB_OFT ||
    !EID_NEXUS ||
    !EID_BASE ||
    !EID_BNB
  ) {
    throw new Error("Missing one of the required env vars");
  }

  // const amount = ethers.utils.parseUnits(SEND_AMOUNT || "0.5", 18);

  const provNexus = new ethers.providers.JsonRpcProvider(RPC_URL_NEXUS_MAINNET);
  const provBase = new ethers.providers.JsonRpcProvider(RPC_URL_BASE_MAINNET);
  const provBnb = new ethers.providers.JsonRpcProvider(RPC_URL_BNB_MAINNET);

  const walletNexus = new ethers.Wallet(PRIVATE_KEY, provNexus);
  const walletBase = new ethers.Wallet(PRIVATE_KEY, provBase);
  const walletBnb = new ethers.Wallet(PRIVATE_KEY, provBnb);

  const nativeOFT_Nexus = new ethers.Contract(ADDR_NEXUS_NATIVE_OFT, NATIVE_OFT_ADAPTER_ABI, walletNexus);
  const oft_Base = new ethers.Contract(ADDR_BASE_OFT, OFT_ABI, walletBase);
  const oft_Bnb = new ethers.Contract(ADDR_BNB_OFT, OFT_ABI, walletBnb);

  console.log("Nexus NativeOFTAdapter:", nativeOFT_Nexus.address);
  console.log("Base OFT:", oft_Base.address);
  console.log("BNB OFT:", oft_Bnb.address);

  // 1) Wire peers
  // console.log("\n[1/4] Connecting peers...");
  // const wantPeerOnNexus = toBytes32Address(ADDR_BASE_OFT);

  // const currentPeerOnNexus = await nativeOFT_Nexus.peers(EID_BASE);
  // if (currentPeerOnNexus.toLowerCase() !== wantPeerOnNexus.toLowerCase()) {
  //   const tx = await nativeOFT_Nexus.setPeer(EID_BASE, wantPeerOnNexus);
  //   console.log("  → setPeer on Nexus transaction:", tx.hash);
  //   console.log("  → setPeer on Nexus address:", wantPeerOnNexus);
  //   await tx.wait();
  // } else {
  //   console.log("  ✓ Base already wired to Nexus: ", currentPeerOnNexus.toLowerCase());
  // }

  // const wantPeerOnBase = toBytes32Address(ADDR_NEXUS_NATIVE_OFT);
  // const currentPeerOnBase = await oft_Base.peers(EID_NEXUS);

  // if (currentPeerOnBase.toLowerCase() !== wantPeerOnBase.toLowerCase()) {
  //   const tx = await oft_Base.setPeer(EID_NEXUS, wantPeerOnBase);
  //   console.log("  → setPeer on Base transaction:", tx.hash);
  //   console.log("  → setPeer on Base address:", wantPeerOnBase);
  //   await tx.wait();
  // } else {
  //   console.log("  ✓ Nexus already wired to Base: ", currentPeerOnBase.toLowerCase());
  // }

  // console.log(Object.keys(oft_Base.functions));

  // 1) Send native Nexus -> Sepolia

  // const sendParamNexus = {
  //   dstEid: EID_BNB,
  //   to: toBytes32Address(OWNER_ADDRESS),
  //   amountLD: ethers.utils.parseUnits("0.01", 18),
  //   minAmountLD: ethers.utils.parseUnits("0.01", 18),
  //   extraOptions: "0x",
  //   composeMsg: "0x",
  //   oftCmd: "0x",
  // };

  // 3) Quote the fee
  // let nativeFee;
  // try {
  //   const feeResponse = await nativeOFT_Nexus.quoteSend(sendParamNexus, false);
  //   nativeFee = feeResponse.nativeFee;
  //   console.log("Quoted fee:", fmt(nativeFee), "AP3X");
  // } catch (e) {
  //   console.warn("Quote failed, using fallback fee 0.3 AP3X");
  //   nativeFee = ethers.utils.parseUnits("0.3", 18);
  // }

  // // Dry-run with callStatic
  // try {
  //   const [msgReceipt, oftReceipt] = await nativeOFT_Nexus.callStatic.send(
  //     sendParamNexus,
  //     { nativeFee, lzTokenFee: 0 },
  //     OWNER_ADDRESS, // refund address
  //     {
  //       value: nativeFee.add(sendParamNexus.amountLD), // tokens + fee
  //     }
  //   );

  //   console.log("✅ CallStatic succeeded!");
  //   console.log("Message GUID:", msgReceipt.guid);
  //   console.log("Expected fee:", msgReceipt.fee.toString());
  //   console.log("Amount to be bridged:", oftReceipt.amountReceivedLD.toString());
  // } catch (err) {
  //   console.error("❌ CallStatic reverted:", err.reason || err);
  // }

  // 4) Send
  // let txSend;
  // try {
  //   txSend = await nativeOFT_Nexus.send(sendParamNexus, { nativeFee, lzTokenFee: 0 }, OWNER_ADDRESS, {
  //     value: sendParamNexus.amountLD.add(nativeFee), // only once!
  //     gasLimit: 1_500_000,
  //   });
  //   await txSend.wait();
  //   console.log("Send tx hash:", txSend.hash);
  // } catch (e) {
  //   console.error("Send failed:", e);
  //   process.exit(1);
  // }

  // Sending Back tokens
  const sendParamBNB = {
    dstEid: EID_NEXUS,
    to: toBytes32Address(OWNER_ADDRESS),
    amountLD: ethers.utils.parseUnits("0.01", 18),
    minAmountLD: ethers.utils.parseUnits("0.01", 18),
    extraOptions: "0x",
    composeMsg: "0x",
    oftCmd: "0x",
  };

  try {
    const feeResponse = await oft_Bnb.quoteSend(sendParamBNB, false);
    nativeFee = feeResponse.nativeFee;
    console.log("Quoted fee:", fmt(nativeFee), "BNB");
  } catch (e) {
    console.warn("Quote failed, using fallback fee 0.3 BNB");
    nativeFee = ethers.utils.parseUnits("0.3", 18);
  }

  try {
    txSend = await oft_Bnb.send(sendParamBNB, { nativeFee, lzTokenFee: 0 }, walletBnb.address, {
      value: nativeFee, // only once!
      gasLimit: 1_500_000,
    });
    await txSend.wait();
    console.log("Send tx hash:", txSend.hash);
  } catch (e) {
    console.error("Send failed:", e);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
