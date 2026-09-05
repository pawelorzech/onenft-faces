// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {DataStore} from "../src/DataStore.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// Writes the sprite stores and the meta blob from test/fixtures/faces_data.json.
/// FaceRenderer and OneNFT are deployed by contracts/deploy.sh with `forge create`:
/// forge script cannot decode the renderer's address[] constructor argument and
/// skips the broadcast when it is in the script.
contract Deploy is Script {
    using Strings for uint256;

    function run() external {
        string memory d = vm.readFile("test/fixtures/faces_data.json");
        uint256 sprites = vm.parseJsonUint(d, "$.sprites");
        uint256 n = (sprites + 62) / 63;
        vm.startBroadcast();
        for (uint256 i = 0; i < n; i++) {
            address s = DataStore.write(vm.parseJsonBytes(d, string.concat("$.stores[", i.toString(), "]")));
            console.log(string.concat("store", i.toString()), s);
        }
        address m = DataStore.write(vm.parseJsonBytes(d, "$.meta"));
        vm.stopBroadcast();
        console.log("meta", m);
        console.log("sprites", sprites);
    }
}
