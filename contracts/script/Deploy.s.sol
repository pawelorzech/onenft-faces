// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {FaceRenderer} from "../src/FaceRenderer.sol";
import {DataStore} from "../src/DataStore.sol";
import {OneNFT} from "../src/OneNFT.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
/// env: AUTHOR (owner, fee recipient, daily treasury roll)
/// Data blobs come from test/fixtures/faces_data.json (bun run contracts/fixtures.ts).
contract Deploy is Script {
    using Strings for uint256;

    function run() external {
        address author = vm.envAddress("AUTHOR");
        string memory d = vm.readFile("test/fixtures/faces_data.json");
        uint256 sprites = vm.parseJsonUint(d, "$.sprites");
        uint256 n = (sprites + 62) / 63;
        vm.startBroadcast();
        address[] memory s = new address[](n);
        for (uint256 i = 0; i < n; i++) {
            s[i] = DataStore.write(vm.parseJsonBytes(d, string.concat("$.stores[", i.toString(), "]")));
            console.log(string.concat("store", i.toString()), s[i]);
        }
        address m = DataStore.write(vm.parseJsonBytes(d, "$.meta"));
        FaceRenderer renderer = new FaceRenderer(s, m, sprites);
        OneNFT nft = new OneNFT("faces.onenft.click", "FACE", author, address(renderer));
        vm.stopBroadcast();
        console.log("meta", m);
        console.log("FaceRenderer", address(renderer));
        console.log("OneNFT", address(nft));
    }
}
