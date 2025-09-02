import { EndpointId } from "@layerzerolabs/lz-definitions";

import type { OAppOmniGraphHardhat, OmniPointHardhat } from "@layerzerolabs/toolbox-hardhat";

/**
 *  WARNING: ONLY 1 NativeOFTAdapter should exist for a given global mesh.
 */
const nexusContract: OmniPointHardhat = {
  eid: EndpointId.APEXFUSIONNEXUS_V2_MAINNET,
  contractName: "MyNativeOFTAdapter",
};

const baseContract: OmniPointHardhat = {
  eid: EndpointId.BASE_V2_MAINNET,
  contractName: "MyOFT",
};

const config: OAppOmniGraphHardhat = {
  contracts: [
    {
      contract: nexusContract,
    },
    {
      contract: baseContract,
    },
  ],
  connections: [
    {
      from: nexusContract,
      to: baseContract,
    },
    {
      from: baseContract,
      to: nexusContract,
    },
  ],
};

export default config;
