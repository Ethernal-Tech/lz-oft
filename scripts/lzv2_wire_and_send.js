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
    RPC_URL_BASE,
    ADDR_NEXUS_NATIVE_OFT,
    ADDR_BASE_OFT,
    SEND_AMOUNT,
    EID_NEXUS,
    EID_BASE,
  } = process.env;

  if (
    !OWNER_ADDRESS ||
    !PRIVATE_KEY ||
    !RPC_URL_NEXUS_MAINNET ||
    !RPC_URL_BASE ||
    !ADDR_NEXUS_NATIVE_OFT ||
    !ADDR_BASE_OFT
  ) {
    throw new Error("Missing one of the required env vars");
  }

  // const amount = ethers.utils.parseUnits(SEND_AMOUNT || "0.5", 18);

  const provNexus = new ethers.providers.JsonRpcProvider(RPC_URL_NEXUS_MAINNET);
  const provBase = new ethers.providers.JsonRpcProvider(RPC_URL_BASE);

  const walletNexus = new ethers.Wallet(PRIVATE_KEY, provNexus);
  const walletBase = new ethers.Wallet(PRIVATE_KEY, provBase);

  const nativeOFT_Nexus = new ethers.Contract(ADDR_NEXUS_NATIVE_OFT, NATIVE_OFT_ADAPTER_ABI, walletNexus);
  const oft_Base = new ethers.Contract(ADDR_BASE_OFT, OFT_ABI, walletBase);

  console.log("Nexus NativeOFTAdapter:", nativeOFT_Nexus.address);
  console.log("Base OFT:", oft_Base.address);

  // 1) Wire peers
  console.log("\n[1/4] Connecting peers...");
  const wantPeerOnNexus = toBytes32Address(ADDR_BASE_OFT);

  const currentPeerOnNexus = await nativeOFT_Nexus.peers(EID_BASE);
  if (currentPeerOnNexus.toLowerCase() !== wantPeerOnNexus.toLowerCase()) {
    const tx = await nativeOFT_Nexus.setPeer(EID_BASE, wantPeerOnNexus);
    console.log("  → setPeer on Nexus transaction:", tx.hash);
    console.log("  → setPeer on Nexus address:", wantPeerOnNexus);
    await tx.wait();
  } else {
    console.log("  ✓ Base already wired to Nexus: ", currentPeerOnNexus.toLowerCase());
  }

  const wantPeerOnBase = toBytes32Address(ADDR_NEXUS_NATIVE_OFT);
  const currentPeerOnBase = await oft_Base.peers(EID_NEXUS);

  if (currentPeerOnBase.toLowerCase() !== wantPeerOnBase.toLowerCase()) {
    const tx = await oft_Base.setPeer(EID_NEXUS, wantPeerOnBase);
    console.log("  → setPeer on Base transaction:", tx.hash);
    console.log("  → setPeer on Base address:", wantPeerOnBase);
    await tx.wait();
  } else {
    console.log("  ✓ Nexus already wired to Base: ", currentPeerOnBase.toLowerCase());
  }

  const ENDPOINT_ABI = [
    "function setConfig(address _oapp, address _lib, (uint32 eid,uint32 configType,bytes config)[] params) external",
  ];

  // EndpointV2 (Nexus)
  const endpoint = new ethers.Contract("0x6F475642a6e85809B1c36Fa62763669b1b48DD5B", ENDPOINT_ABI, walletNexus);

  const params = [
    {
      eid: 30184, // Base EID
      configType: 2, // Executor config
      config: ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes"],
        ["0x4208D6E27538189bB48E603D6123A94b8Abe0A0b", "0x"] // executor + extra args
      ),
    },
  ];

  await endpoint.setConfig(
    "0x012e277911730eE56B7a738Ca306eFB338b11BD4", // your OFT/OApp
    "0xC39161c743D0307EB9BCc9FEF03eeb9Dc4802de7", // sendUln302
    params,
    { gasLimit: 500_000 } // set enough gas
  );
  console.log("DONE");

  // console.log(Object.keys(oft_Base.functions));

  // 1) Send native Nexus -> Sepolia

  const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex();

  const sendParamNexus = {
    dstEid: EID_BASE,
    to: toBytes32Address(OWNER_ADDRESS),
    amountLD: ethers.utils.parseUnits("0.01", 18),
    minAmountLD: 0,
    extraOptions: options,
    composeMsg: "0x",
    oftCmd: "0x",
  };

  // 3) Quote the fee
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
