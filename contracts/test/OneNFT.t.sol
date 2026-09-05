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
    uint64 constant NONE = type(uint64).max;
    address author = address(0xA11CE);
    address alice = address(0xA1);
    address bob = address(0xB0B);
    FaceRenderer renderer;
    OneNFT nft;

    function setUp() public {
        vm.warp(20701 * EB + 100);
        vm.roll(1000);
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

    function rollFor(address who, uint64 pins, uint256 value) internal returns (uint256 id) {
        vm.prank(who);
        nft.commit{value: value}(pins);
        vm.roll(block.number + 1);
        id = nft.reveal(who);
    }

    function test_CommitThenRevealMintsOncePerDay() public {
        uint256 id = rollFor(alice, NONE, 0);
        assertEq(id, 1);
        assertEq(nft.ownerOf(1), alice);
        assertFalse(nft.canRoll(alice));
        uint256 next = (nft.currentEpoch() + 1) * EB;
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(OneNFT.OneRollADay.selector, alice, next));
        nft.commit(NONE);
        vm.warp(block.timestamp + EB);
        assertTrue(nft.canRoll(alice));
        assertEq(rollFor(alice, NONE, 0), 2);
    }

    function test_RevealNeedsTheNextBlockAndOnlyOnce() public {
        vm.prank(alice);
        nft.commit(NONE);
        assertEq(nft.pending(), 1);
        assertEq(nft.revealBlockOf(alice), block.number + 1);
        vm.expectRevert(abi.encodeWithSelector(OneNFT.TooEarly.selector, alice, block.number + 1));
        nft.reveal(alice);
        vm.roll(block.number + 1);
        vm.prank(bob); // anyone may reveal for anyone
        nft.reveal(alice);
        assertEq(nft.pending(), 0);
        assertEq(nft.ownerOf(1), alice);
        vm.expectRevert(abi.encodeWithSelector(OneNFT.NothingToReveal.selector, alice));
        nft.reveal(alice);
    }

    function test_RevertingOnTheOutcomeCannotRetry() public {
        // The outcome is fixed by the block after the commit; the day is spent at the commit.
        vm.prank(alice);
        nft.commit(NONE);
        vm.prank(alice);
        vm.expectRevert();
        nft.commit(NONE);
        vm.roll(block.number + 1);
        uint256 id = nft.reveal(alice);
        (uint64 seed,,,) = nft.faces(id);
        assertGt(seed, 0);
    }

    function test_PinnedCommitCostsByCountAndPaysTheAuthor() public {
        uint64 pins = 0x0001ffffffffffff; // background 0, top 1
        assertEq(nft.priceOf(pins), 0.0015 ether);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(OneNFT.WrongPrice.selector, 0.0015 ether, 0));
        nft.commit(pins);
        uint256 before = author.balance;
        uint256 id = rollFor(alice, pins, 0.0015 ether);
        assertEq(author.balance - before, 0.0015 ether);
        (, uint64 stored,,) = nft.faces(id);
        assertEq(stored, pins);
        assertEq(nft.priceOf(0x00ffffffffffffff), 0.0005 ether);
        assertEq(nft.priceOf(0x000102ffffffffff), 0.004 ether);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(OneNFT.BadPins.selector, uint64(0x00010203ffffffff)));
        nft.commit{value: 0.004 ether}(0x00010203ffffffff); // four pins
        uint256 id2 = rollFor(bob, 0xffffffff02ffffff, 0.0005 ether); // skin Tan
        (, uint64 sk,,) = nft.faces(id2);
        assertEq(sk, 0xffffffff02ffffff);
    }

    function test_PinOnRareItemOrUnknownIndexReverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(OneNFT.BadPins.selector, uint64(0xffff0dffffffffff)));
        nft.commit{value: 0.0005 ether}(0xffff0dffffffffff);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(OneNFT.BadPins.selector, uint64(0xff63ffffffffffff)));
        nft.commit{value: 0.0005 ether}(0xff63ffffffffffff);
    }

    function test_TreasuryRollIsPermissionlessAndDaily() public {
        vm.prank(bob);
        nft.commitForTreasury();
        vm.prank(alice);
        vm.expectRevert();
        nft.commitForTreasury();
        vm.roll(block.number + 1);
        uint256 id = nft.reveal(author);
        assertEq(nft.ownerOf(id), author);
        vm.warp(block.timestamp + EB);
        nft.commitForTreasury();
        vm.roll(block.number + 1);
        nft.reveal(author);
        assertEq(nft.balanceOf(author), 2);
    }

    function test_TokenUriComesFromThePinnedRenderer() public {
        rollFor(alice, NONE, 0);
        string memory uri = nft.tokenURI(1);
        assertEq(keccak256(bytes(substr(uri, 0, 29))), keccak256("data:application/json;base64,"));
        vm.expectRevert();
        nft.tokenURI(2);
    }

    function test_OneOfOnePoolDrainsOnLuckyRolls() public {
        assertEq(nft.poolLeft(), renderer.oneOfOneCount());
        uint256 hits = 0;
        for (uint256 i = 1; i < 3000 && hits == 0; i++) {
            address w = address(uint160(0x1000 + i));
            vm.prank(w);
            nft.commit(NONE);
            vm.roll(block.number + 1);
            uint256 id = nft.reveal(w);
            (,, uint8 one,) = nft.faces(id);
            if (one != 255) hits++;
        }
        assertEq(hits, 1);
        assertEq(nft.poolLeft(), renderer.oneOfOneCount() - 1);
    }

    function test_SupplyCapCountsPendingCommits() public {
        vm.store(address(nft), bytes32(uint256(8)), bytes32(uint256(9999)));
        assertEq(nft.totalSupply(), 9999);
        vm.prank(alice);
        nft.commit(NONE);
        assertFalse(nft.canRoll(bob));
        vm.prank(bob);
        vm.expectRevert(OneNFT.SoldOut.selector);
        nft.commit(NONE);
        vm.roll(block.number + 1);
        assertEq(nft.reveal(alice), 10000);
    }

    function test_RendererLockOwnershipAndSweep() public {
        vm.prank(alice);
        vm.expectRevert();
        nft.setRenderer(address(renderer));
        vm.prank(author);
        vm.expectRevert(OneNFT.OwnershipIsPermanent.selector);
        nft.renounceOwnership();
        vm.prank(author);
        nft.setRenderer(address(renderer)); // the same renderer passes every probe
        vm.prank(author);
        nft.lockRenderer();
        vm.prank(author);
        vm.expectRevert(OneNFT.RendererIsLocked.selector);
        nft.setRenderer(address(renderer));
        vm.deal(address(nft), 1 ether);
        uint256 before = author.balance;
        nft.sweep();
        assertEq(author.balance - before, 1 ether);
    }

    function test_RendererMustAnswerEveryProbe() public {
        vm.prank(author);
        vm.expectRevert(abi.encodeWithSelector(OneNFT.BadRenderer.selector, address(0xdead)));
        nft.setRenderer(address(0xdead));
        // a renderer that knows fewer 1/1s than the pool holds is refused
        string memory d = vm.readFile("test/fixtures/faces_data.json");
        uint256 sprites = vm.parseJsonUint(d, "$.sprites");
        address meta = DataStore.write(vm.parseJsonBytes(d, "$.meta"));
        vm.expectRevert();
        new FaceRenderer(new address[](0), meta, sprites);
    }

    function substr(string memory s, uint256 from, uint256 len) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory out = new bytes(len);
        for (uint256 i = 0; i < len; i++) out[i] = b[from + i];
        return string(out);
    }
}
