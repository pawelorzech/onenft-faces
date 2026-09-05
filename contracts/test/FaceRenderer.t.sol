// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {FaceRenderer} from "../src/FaceRenderer.sol";
import {DataStore} from "../src/DataStore.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract FaceRendererTest is Test {
    using Strings for uint256;

    FaceRenderer r;

    function deployRenderer() internal returns (FaceRenderer) {
        string memory d = vm.readFile("test/fixtures/faces_data.json");
        uint256 sprites = vm.parseJsonUint(d, "$.sprites");
        uint256 n = (sprites + 62) / 63;
        address[] memory s = new address[](n);
        for (uint256 i = 0; i < n; i++) s[i] = DataStore.write(vm.parseJsonBytes(d, string.concat("$.stores[", i.toString(), "]")));
        return new FaceRenderer(s, DataStore.write(vm.parseJsonBytes(d, "$.meta")), sprites);
    }

    function setUp() public {
        r = deployRenderer();
    }

    function parseUint(string memory s) internal pure returns (uint256 n) {
        bytes memory b = bytes(s);
        for (uint256 i = 0; i < b.length; i++) n = n * 10 + (uint8(b[i]) - 48);
    }

    function caseCount(string memory json) internal view returns (uint256 count) {
        while (vm.keyExistsJson(json, string.concat("$[", count.toString(), "].seed"))) count++;
    }

    /// Fixtures from `bun run contracts/fixtures.ts`. TypeScript is the source of truth.
    /// Split in three so one test's memory stays under the EVM limit (each case renders 64 kB twice).
    function checkCases(uint256 from, uint256 to) internal view {
        string memory json = vm.readFile("test/fixtures/faces_cases.json");
        uint256 count = caseCount(json);
        assertGt(count, 15);
        for (uint256 i = from; i < to && i < count; i++) {
            string memory k = string.concat("$[", i.toString(), "]");
            uint64 seed = uint64(parseUint(vm.parseJsonString(json, string.concat(k, ".seed"))));
            uint64 pins = uint64(parseUint(vm.parseJsonString(json, string.concat(k, ".pins"))));
            uint8 one = uint8(vm.parseJsonUint(json, string.concat(k, ".one")));
            assertEq(keccak256(bytes(r.svg(seed, pins, one))), keccak256(bytes(vm.parseJsonString(json, string.concat(k, ".svg")))), string.concat(k, " svg"));
            assertEq(keccak256(bytes(r.json(1, seed, pins, one))), keccak256(bytes(vm.parseJsonString(json, string.concat(k, ".json")))), string.concat(k, " json"));
        }
    }

    function test_SvgAndJsonMatchTypeScriptByteForByte_A() public view { checkCases(0, 22); }
    function test_SvgAndJsonMatchTypeScriptByteForByte_B() public view { checkCases(22, 44); }
    function test_SvgAndJsonMatchTypeScriptByteForByte_C() public view { checkCases(44, 100); }

    /// Every item, every colour and every 1/1 through tokenURI, from test/fixtures/faces_coverage.json.
    function coverage(uint256 from, uint256 to) internal view {
        string memory json = vm.readFile("test/fixtures/faces_coverage.json");
        uint256 count = caseCount(json);
        for (uint256 i = from; i < to && i < count; i++) {
            string memory k = string.concat("$[", i.toString(), "]");
            uint64 seed = uint64(parseUint(vm.parseJsonString(json, string.concat(k, ".seed"))));
            uint8 one = uint8(vm.parseJsonUint(json, string.concat(k, ".one")));
            assertGt(bytes(r.tokenURI(1, seed, type(uint64).max, one)).length, 100, vm.parseJsonString(json, string.concat(k, ".what")));
        }
    }
    function test_EveryIndexRenders_A() public view { coverage(0, 30); }
    function test_EveryIndexRenders_B() public view { coverage(30, 60); }
    function test_EveryIndexRenders_C() public view { coverage(60, 90); }
    function test_EveryIndexRenders_D() public view { coverage(90, 120); }
    function test_EveryIndexRenders_E() public view { coverage(120, 200); }

    function test_LuckySeedFromFixturesHitsThePool() public view {
        string memory json = vm.readFile("test/fixtures/faces_cases.json");
        uint256 count = caseCount(json);
        string memory k = string.concat("$[", (count - 1).toString(), "]");
        uint64 seed = uint64(parseUint(vm.parseJsonString(json, string.concat(k, ".seed"))));
        uint256 one = vm.parseJsonUint(json, string.concat(k, ".one"));
        assertEq(r.luckyFor(seed, r.oneOfOneCount(), 10000), one);
        assertEq(r.luckyFor(seed, 0, 10000), 255);
        assertEq(r.luckyFor(seed, r.oneOfOneCount(), 0), 255);
        assertEq(r.luckyFor(1, r.oneOfOneCount(), 10000), 255);
        // at the end the odds are certain: 3 left in the pool, 3 tokens left
        assertTrue(r.luckyFor(1, 3, 3) != 255);
    }

    function test_PinsAreCheckedAgainstTiersAndCounts() public view {
        assertTrue(r.pinsOk(type(uint64).max));
        assertTrue(r.pinsOk(0x00ffffffffffffff)); // background 0, Flat, common
        assertFalse(r.pinsOk(0xff0fffffffffffff)); // top 15 does not exist
        assertFalse(r.pinsOk(0xffff0dffffffffff)); // eyes 13 Cyclops, legendary
        assertTrue(r.pinsOk(0xffffffff02ffffff)); // skin 2 Tan, common
        assertFalse(r.pinsOk(0xffffffff12ffffff)); // skin 18 Gold, legendary
        assertFalse(r.pinsOk(0xffffffffff00ffff)); // a spare byte set
        assertEq(r.pinCount(type(uint64).max), 0);
        assertEq(r.pinCount(0x0001ffffffffffff), 2);
        assertEq(r.pinCount(0x00010203ffffffff), 4);
    }

    function testFuzz_EverySeedRenders(uint64 seed) public view {
        string memory s = r.svg(seed, type(uint64).max, 255);
        assertGt(bytes(s).length, 1000);
    }

    function test_TokenUriGas() public view {
        uint256 g = gasleft();
        r.tokenURI(1, 12345, type(uint64).max, 255);
        uint256 used = g - gasleft();
        assertLt(used, 10_000_000, "tokenURI gas");
    }
}
