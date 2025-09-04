import { EndpointId } from "@layerzerolabs/lz-definitions";
import { ExecutorOptionType } from "@layerzerolabs/lz-v2-utilities";
import { TwoWayConfig, generateConnectionsConfig } from "@layerzerolabs/metadata-tools";
import { OAppEnforcedOption, OmniPointHardhat } from "@layerzerolabs/toolbox-hardhat";

const nexusContract: OmniPointHardhat = {
  eid: EndpointId.APEXFUSIONNEXUS_V2_MAINNET,
  contractName: "MyNativeOFTAdapter",
};

const baseContract: OmniPointHardhat = {
  eid: EndpointId.BASE_V2_MAINNET,
  contractName: "MyOFT",
};

const EVM_ENFORCED_OPTIONS: OAppEnforcedOption[] = [
  {
    msgType: 1,
    optionType: ExecutorOptionType.LZ_RECEIVE,
    gas: 80000,
    value: 0,
  },
];

export default async function () {
  const connections = await generateConnectionsConfig([
    [nexusContract, baseContract, [["LayerZero Labs"], []], [5, 10], [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS]],
  ]);

  return {
    contracts: [{ contract: nexusContract }, { contract: baseContract }],
    connections,
  };
}
