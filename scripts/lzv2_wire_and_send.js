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
require("dotenv").config();
const { ethers } = require("ethers");
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
    RPC_URL_SEPOLIA,
    RPC_URL_AMOY,
    RPC_URL_NEXUS,
    ADDR_SEPOLIA_NATIVE_OFT,
    ADDR_AMOY_OFT,
    ADDR_NEXUS_NATIVE_OFT,
    ADDR_SEPOLIA_OFT,
    SEND_AMOUNT,
    EID_AMOY,
    EID_SEPOLIA,
    EID_NEXUS,
  } = process.env;

  if (
    !OWNER_ADDRESS ||
    !PRIVATE_KEY ||
    !RPC_URL_SEPOLIA ||
    !RPC_URL_AMOY ||
    !ADDR_SEPOLIA_NATIVE_OFT ||
    !ADDR_AMOY_OFT
  ) {
    throw new Error("Missing one of the required env vars");
  }

  const amount = ethers.utils.parseUnits(SEND_AMOUNT || "0.5", 18);

  const provSepolia = new ethers.providers.JsonRpcProvider(RPC_URL_SEPOLIA);
  const provAmoy = new ethers.providers.JsonRpcProvider(RPC_URL_AMOY);
  const provNexus = new ethers.providers.JsonRpcProvider(RPC_URL_NEXUS);
  const walletSepolia = new ethers.Wallet(PRIVATE_KEY, provSepolia);
  const walletAmoy = new ethers.Wallet(PRIVATE_KEY, provAmoy);
  const walletNexus = new ethers.Wallet(PRIVATE_KEY, provNexus);

  const nativeOFT_Sepolia = new ethers.Contract(ADDR_SEPOLIA_NATIVE_OFT, NATIVE_OFT_ADAPTER_ABI, walletSepolia);
  const oft_Amoy = new ethers.Contract(ADDR_AMOY_OFT, OFT_ABI, walletAmoy);
  const nativeOFT_Nexus = new ethers.Contract(ADDR_NEXUS_NATIVE_OFT, NATIVE_OFT_ADAPTER_ABI, walletNexus);
  const oft_Sepolia = new ethers.Contract(ADDR_SEPOLIA_OFT, OFT_ABI, walletSepolia);

  console.log("Sepolia NativeOFTAdapter:", nativeOFT_Sepolia.address);
  console.log("Amoy OFT:", oft_Amoy.address);

  // 1) Wire peers
  console.log("\n[1/4] Connecting peers...");
  const wantPeerOnNexus = toBytes32Address(ADDR_SEPOLIA_OFT);
  const wantPeerOnSepolia = toBytes32Address(ADDR_NEXUS_NATIVE_OFT);

  const currentPeerOnNexus = await nativeOFT_Nexus.peers(EID_SEPOLIA);
  if (currentPeerOnNexus.toLowerCase() !== wantPeerOnNexus.toLowerCase()) {
    const tx = await nativeOFT_Nexus.setPeer(EID_SEPOLIA, wantPeerOnNexus);
    console.log("  → setPeer on Nexus:", tx.hash);
    await tx.wait();
  } else {
    console.log("  ✓ Sepolia already wired to Nexus: ", currentPeerOnNexus.toLowerCase());
  }

  // Amoy sometimes needs a higher gas price
  const forceAmoyGas = async (prov) => {
    const base = await prov.getGasPrice();
    const min = ethers.utils.parseUnits("30", "gwei");
    return base.lt(min) ? min : base;
  };

  const amoyGasPrice = await forceAmoyGas(provAmoy);
  const currentPeerOnSepolia = await oft_Sepolia.peers(EID_NEXUS);

  if (currentPeerOnSepolia.toLowerCase() !== wantPeerOnSepolia.toLowerCase()) {
    const tx = await oft_Sepolia.setPeer(EID_NEXUS, wantPeerOnSepolia, { gasPrice: amoyGasPrice });
    console.log("  → setPeer on Sepolia:", tx.hash);
    await tx.wait();
  } else {
    console.log("  ✓ Nexus already wired to Sepolia: ", currentPeerOnSepolia.toLowerCase());
  }

  // 2) (Optional) DVNs / Executor -> Currently not doing anything
  console.log("\n[2/4] Configuring DVNs & Executor (optional)...");
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

  // 1) Send native Nexus -> Sepolia

  const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex();

  const sendParamNexus = {
    dstEid: EID_SEPOLIA,
    to: toBytes32Address(OWNER_ADDRESS),
    amountLD: ethers.utils.parseUnits("2", 18),
    minAmountLD: 0,
    extraOptions: options,
    composeMsg: "0x",
    oftCmd: "0x",
  };

  // // 3) Quote the fee
  let nativeFee;
  // try {
  const feeResponse = await nativeOFT_Nexus.quoteSend(sendParamNexus, false);
  console.log(feeResponse);
  nativeFee = feeResponse.nativeFee;
  console.log("Quoted fee:", fmt(nativeFee), "tAPEX");
  // } catch (e) {
  console.warn("Quote failed, using fallback fee 0.3 tAPEX");
  nativeFee = ethers.utils.parseUnits("0.3", 18);
  // }

  // Dry-run with callStatic
  try {
    const [msgReceipt, oftReceipt] = await nativeOFT_Nexus.callStatic.send(
      sendParamNexus,
      { nativeFee, lzTokenFee: 0 },
      OWNER_ADDRESS, // refund address
      {
        value: nativeFee.add(sendParamNexus.amountLD), // tokens + fee
      }
    );

    console.log("✅ CallStatic succeeded!");
    console.log("Message GUID:", msgReceipt.guid);
    console.log("Expected fee:", msgReceipt.fee.toString());
    console.log("Amount to be bridged:", oftReceipt.amountReceivedLD.toString());
  } catch (err) {
    console.error("❌ CallStatic reverted:", err.reason || err);
  }

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

  // 5) Verify balance on Amoy
  // const balAfter = await oft_Amoy.balanceOf(walletAmoy.address);
  // let sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // let ok = false;
  // for (let i = 0; i < 20; i++) {
  //   await sleep(6000);
  //   const now = await oft_Amoy.balanceOf(walletAmoy.address);
  //   if (now.gt(balBefore)) {
  //     console.log(`Balance increased: ${fmt(balBefore)} → ${fmt(now)}`);
  //     ok = true;
  //     break;
  //   } else {
  //     process.stdout.write(".");
  //   }
  // }
  // if (!ok) console.log("\nBalance not updated yet — delivery may be in-flight.");
  // console.log("All steps done ✅");

  // // Sending Back tokens to Sepolia
  // const sendParamAmoy = {
  //   dstEid: EID_SEPOLIA,
  //   to: toBytes32Address(OWNER_ADDRESS),
  //   amountLD: ethers.utils.parseUnits("2", 18),
  //   minAmountLD: 0,
  //   extraOptions: options,
  //   composeMsg: "0x",
  //   oftCmd: "0x",
  // };

  // try {
  //   const feeResponse = await oft_Amoy.quoteSend(sendParamAmoy, false);
  //   nativeFee = feeResponse.nativeFee;
  //   console.log("Quoted fee:", fmt(nativeFee), "POL");
  // } catch (e) {
  //   console.warn("Quote failed, using fallback fee 0.3 POL");
  //   nativeFee = ethers.utils.parseUnits("0.3", 18);
  // }

  // try {
  //   txSend = await oft_Amoy.send(sendParamAmoy, { nativeFee, lzTokenFee: 0 }, walletAmoy.address, {
  //     value: sendParamAmoy.amountLD.add(nativeFee), // only once!
  //     gasLimit: 1_500_000,
  //   });
  //   await txSend.wait();
  //   console.log("Send tx hash:", txSend.hash);
  // } catch (e) {
  //   console.error("Send failed:", e);
  //   process.exit(1);
  // }

  // sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // ok = false;
  // for (let i = 0; i < 20; i++) {
  //   await sleep(6000);
  //   const now = await nativeOFT_Sepolia.balanceOf(walletAmoy.address);
  //   if (now.gt(balBefore)) {
  //     console.log(`Balance increased: ${fmt(balBefore)} → ${fmt(now)}`);
  //     ok = true;
  //     break;
  //   } else {
  //     process.stdout.write(".");
  //   }
  // }
  // if (!ok) console.log("\nBalance not updated yet — delivery may be in-flight.");
  // console.log("All steps done ✅");

  //   console.log("Balance after send:", fmt(balBefore));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
