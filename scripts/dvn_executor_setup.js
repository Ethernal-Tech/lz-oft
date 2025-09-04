import { config as dotenvConfig } from "dotenv";
import { ethers } from "hardhat";

dotenvConfig(); // load .env

const DVNS = process.env.LZV2_DVNS ? process.env.LZV2_DVNS.split(",") : [];
const EXECUTOR = process.env.LZV2_EXECUTOR || "";

async function setDVNsAndExecutor(nativeOFT, localEid) {
  if (DVNS.length > 0) {
    console.log("Setting DVNs:", DVNS);
    const tx1 = await nativeOFT.setConfig(
      localEid,
      1, // configType 1 = DVNs
      ethers.utils.defaultAbiCoder.encode(["address[]"], [DVNS])
    );
    await tx1.wait();
  } else {
    console.log("No DVNs provided, skipping...");
  }

  if (EXECUTOR) {
    console.log("Setting Executor:", EXECUTOR);
    const tx2 = await nativeOFT.setConfig(
      localEid,
      2, // configType 2 = Executor
      ethers.utils.defaultAbiCoder.encode(["address"], [EXECUTOR])
    );
    await tx2.wait();
  } else {
    console.log("No Executor provided, skipping...");
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();

  const nativeOFT = await ethers.getContractAt("MyNativeOFTAdapter", "<YOUR_DEPLOYED_ADDRESS>");

  const LOCAL_EID = 1; // replace with your local Endpoint ID

  await setDVNsAndExecutor(nativeOFT, LOCAL_EID);

  console.log("DVNs and Executor configured. You can now call quoteSend/send safely.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
