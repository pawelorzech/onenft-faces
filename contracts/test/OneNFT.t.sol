// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {OneNFT} from "../src/OneNFT.sol";
import {FaceRenderer} from "../src/FaceRenderer.sol";
import {DataStore} from "../src/DataStore.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract OneNFTTest is Test {
    using Strings for uint256;

    uint256 constant EB = 86400;
    address author = address(0xA11CE);
    address alice = address(0xA1);
    address bob = address(0xB0B);
    FaceRenderer renderer;
    OneNFT nft;

    function setUp() public {
        vm.warp(20701 * EB + 100);
        string memory d = vm.readFile("test/fixtures/faces_data.json");
        uint256 sprites = vm.parseJsonUint(d, "$.sprites");
        uint256 n = (sprites + 62) / 63;
        address[] memory s = new address[](n);
        for (uint256 i = 0; i < n; i++) s[i] = DataStore.write(vm.parseJsonBytes(d, string.concat("$.stores[", i.toString(), "]")));
        renderer = new FaceRenderer(s, DataStore.write(vm.parseJsonBytes(d, "$.meta")), sprites);
        nft = new OneNFT("faces.onenft.click", "FACE", author, address(renderer));
        vm.deal(alice, 1 ether);
        vm.deal(bob, 1 ether);
    }

    function test_FreeRollMintsToCallerOncePerDay() public {
        vm.prank(alice);
        uint256 id = nft.roll(0xffffffff);
        assertEq(id, 1);
        assertEq(nft.ownerOf(1), alice);
        assertFalse(nft.canRoll(alice));
        uint256 next = (nft.currentEpoch() + 1) * EB;
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(OneNFT.OneRollADay.selector, alice, next));
        nft.roll(0xffffffff);
        vm.warp(block.timestamp + EB);
        assertTrue(nft.canRoll(alice));
        vm.prank(alice);
        assertEq(nft.roll(0xffffffff), 2);
    }

    function test_PinnedRollCostsByCountAndPaysTheAuthor() public {
        uint32 pins = 0x0001ffff; // background 0, top 1
        assertEq(nft.priceOf(pins), 0.0015 ether);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(OneNFT.WrongPrice.selector, 0.0015 ether, 0));
        nft.roll(pins);
        uint256 before = author.balance;
        vm.prank(alice);
        nft.roll{value: 0.0015 ether}(pins);
        assertEq(author.balance - before, 0.0015 ether);
        (, uint32 stored,,) = nft.faces(1);
        assertEq(stored, pins);
        assertEq(nft.priceOf(0x00ffffff), 0.0005 ether);
        assertEq(nft.priceOf(0x000102ff), 0.004 ether);
        assertEq(nft.priceOf(0x00010203), 0.004 ether);
    }

    function test_PinOnRareItemOrUnknownIndexReverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(OneNFT.BadPins.selector, uint32(0xffff0dff)));
        nft.roll{value: 0.0005 ether}(0xffff0dff);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(OneNFT.BadPins.selector, uint32(0xff63ffff)));
        nft.roll{value: 0.0005 ether}(0xff63ffff);
    }

    function test_TreasuryRollIsPermissionlessAndDaily() public {
        vm.prank(bob);
        uint256 id = nft.rollForTreasury();
        assertEq(nft.ownerOf(id), author);
        vm.prank(alice);
        vm.expectRevert();
        nft.rollForTreasury();
        vm.warp(block.timestamp + EB);
        nft.rollForTreasury();
        assertEq(nft.balanceOf(author), 2);
    }

    function test_TokenUriComesFromThePinnedRenderer() public {
        vm.prank(alice);
        nft.roll(0xffffffff);
        string memory uri = nft.tokenURI(1);
        assertEq(bytes(uri).length > 200, true);
        assertEq(keccak256(bytes(substr(uri, 0, 29))), keccak256("data:application/json;base64,"));
        vm.expectRevert();
        nft.tokenURI(2);
    }

    function test_OneOfOnePoolDrainsOnLuckyRolls() public {
        assertEq(nft.poolLeft(), renderer.oneOfOneCount());
        // Force luck: keep rolling fresh wallets until a 1/1 lands or we give up.
        uint256 hits = 0;
        for (uint256 i = 1; i < 2000 && hits == 0; i++) {
            address w = address(uint160(0x1000 + i));
            vm.prevrandao(bytes32(uint256(i * 7919)));
            vm.prank(w);
            uint256 id = nft.roll(0xffffffff);
            (,, uint8 one,) = nft.faces(id);
            if (one != 255) hits++;
        }
        assertEq(hits, 1);
        assertEq(nft.poolLeft(), renderer.oneOfOneCount() - 1);
    }

    function test_SupplyCap() public {
        // MAX_SUPPLY is 10,000; exhaust it with fresh wallets is too slow, so check the guard via storage.
        vm.store(address(nft), bytes32(uint256(8)), bytes32(uint256(10000)));
        assertEq(nft.totalSupply(), 10000);
        vm.prank(alice);
        vm.expectRevert(OneNFT.SoldOut.selector);
        nft.roll(0xffffffff);
    }

    function test_RendererLockAndOwnership() public {
        vm.prank(alice);
        vm.expectRevert();
        nft.setRenderer(address(renderer));
        vm.prank(author);
        vm.expectRevert(OneNFT.OwnershipIsPermanent.selector);
        nft.renounceOwnership();
        vm.prank(author);
        nft.lockRenderer();
        vm.prank(author);
        vm.expectRevert(OneNFT.RendererIsLocked.selector);
        nft.setRenderer(address(renderer));
    }

    function substr(string memory s, uint256 from, uint256 len) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory out = new bytes(len);
        for (uint256 i = 0; i < len; i++) out[i] = b[from + i];
        return string(out);
    }
}
