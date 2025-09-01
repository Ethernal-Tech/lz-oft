import { EndpointId } from "@layerzerolabs/lz-definitions";

import type { OAppOmniGraphHardhat, OmniPointHardhat } from "@layerzerolabs/toolbox-hardhat";

/**
 *  WARNING: ONLY 1 NativeOFTAdapter should exist for a given global mesh.
 */
const nexusContract: OmniPointHardhat = {
  eid: EndpointId.APEXFUSIONNEXUS_V2_TESTNET,
  contractName: "MyNativeOFTAdapter",
};

const sepoliaContract: OmniPointHardhat = {
  eid: EndpointId.SEPOLIA_V2_TESTNET,
  contractName: "MyOFT",
};

const config: OAppOmniGraphHardhat = {
  contracts: [
    {
      contract: nexusContract,
    },
    {
      contract: sepoliaContract,
    },
  ],
  connections: [
    {
      from: nexusContract,
      to: sepoliaContract,
    },
    {
      from: sepoliaContract,
      to: nexusContract,
    },
  ],
};

export default config;
