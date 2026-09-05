// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {OneNFT} from "../src/OneNFT.sol";
import {FaceRenderer} from "../src/FaceRenderer.sol";
import {DataStore} from "../src/DataStore.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title What the seed of a roll depends on, block by block (second contract).
/// @notice The reveal is allowed from block B + 2 to B + 256, where B is the commit
/// block; the seed is blockhash(B + 1), the wallet, the pins and B, nothing else.
/// Inside that window the hash always exists; outside it the reveal reverts and
/// anyone may renew the commit, which moves B to the current block.
contract RevealWindowTest is Test {
    using Strings for uint256;

    uint256 constant EB = 86400;
    uint128 constant NONE = type(uint128).max;
    address author = address(0xA11CE);
    address alice = address(0xA1);
    address bob = address(0xB0B);
    address keeper = address(0xCAFE);
    FaceRenderer renderer;
    OneNFT nft;
    /// @dev The commit block, kept in storage: with via_ir a local copy of block.number is re-read after vm.roll.
    uint256 base;

    function setUp() public {
        vm.warp(20701 * EB + 100);
        vm.roll(1000);
        string memory d = vm.readFile("test/fixtures/faces_data.json");
        uint256 sprites = vm.parseJsonUint(d, "$.sprites");
        uint256 n = (sprites + 62) / 63;
        address[] memory s = new address[](n);
        for (uint256 i = 0; i < n; i++) s[i] = DataStore.write(vm.parseJsonBytes(d, string.concat("$.stores[", i.toString(), "]")));
        renderer = new FaceRenderer(s, DataStore.write(vm.parseJsonBytes(d, "$.meta")), sprites);
        nft = new OneNFT("faces.onenft.click", "FACE", author, keeper, address(renderer));
        base = block.number;
    }

    function seedOf(bytes32 hash, address wallet, uint128 pins, uint256 commitBlock) internal pure returns (uint64) {
        return uint64(uint256(keccak256(abi.encodePacked(hash, wallet, pins, uint64(commitBlock)))));
    }
    function storedSeed(uint256 id) internal view returns (uint64 seed) {
        (seed,,,) = nft.faces(id);
    }
    function hashFor(uint256 n) internal pure returns (bytes32) {
        return keccak256(abi.encode("block", n));
    }
    /// Rolls to `to` and gives block B + 1 a hash, as the chain would.
    function go(uint256 to) internal {
        vm.roll(to);
        if (to > base + 1) vm.setBlockhash(base + 1, hashFor(base + 1));
    }

    function test_RevealInBlocksBAndBPlus1_Reverts() public {
        uint256 B = base;
        vm.prank(alice);
        nft.commit(NONE);
        assertEq(nft.revealBlockOf(alice), B + 2);
        assertEq(nft.lastRevealBlockOf(alice), B + 256);
        vm.expectRevert(abi.encodeWithSelector(OneNFT.TooEarly.selector, alice, B + 2));
        nft.reveal(alice);
        vm.roll(B + 1);
        vm.expectRevert(abi.encodeWithSelector(OneNFT.TooEarly.selector, alice, B + 2));
        nft.reveal(alice);
    }

    /// From block B + 2 on the real hash of B + 1 is in the seed, and the token id is not.
    function test_RevealInBlockBPlus2_UsesRealHashAndNoTokenId() public {
        uint256 B = base;
        vm.prank(alice);
        nft.commit(NONE);
        go(B + 2);
        nft.reveal(alice);
        assertEq(storedSeed(1), seedOf(hashFor(B + 1), alice, NONE, B));
    }

    /// Block B + 256 is the last block a reveal is allowed in.
    function test_RevealInBlockBPlus256_LastAllowed() public {
        uint256 B = base;
        vm.prank(alice);
        nft.commit(NONE);
        go(B + 256);
        nft.reveal(alice);
        assertEq(storedSeed(1), seedOf(hashFor(B + 1), alice, NONE, B));
    }

    /// From B + 257 the reveal reverts; renew moves the commit to the current block and the wait starts again.
    function test_RevealAfterTheWindow_RevertsAndRenewRestarts() public {
        uint256 B = base;
        vm.prank(alice);
        nft.commit(NONE);
        vm.roll(B + 100);
        vm.expectRevert(abi.encodeWithSelector(OneNFT.NotExpired.selector, alice, B + 256));
        nft.renew(alice);
        vm.roll(B + 257);
        vm.expectRevert(abi.encodeWithSelector(OneNFT.Expired.selector, alice, B + 256));
        nft.reveal(alice);
        vm.prank(bob); // anyone may renew
        nft.renew(alice);
        assertEq(nft.revealBlockOf(alice), B + 259);
        assertEq(nft.pending(), 1);
        vm.expectRevert(abi.encodeWithSelector(OneNFT.TooEarly.selector, alice, B + 259));
        nft.reveal(alice);
        vm.roll(B + 259);
        vm.setBlockhash(B + 258, hashFor(B + 258));
        nft.reveal(alice);
        assertEq(storedSeed(1), seedOf(hashFor(B + 258), alice, NONE, B + 257));
        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.pending(), 0);
    }

    /// Two commits in one block: whoever reveals first, each wallet's face is the same.
    function test_RevealOrderDoesNotChangeTheSeed() public {
        uint256 B = base;
        vm.prank(alice);
        nft.commit(NONE);
        vm.prank(bob);
        nft.commit(NONE);
        go(B + 2);
        uint256 snap = vm.snapshotState();
        nft.reveal(alice);
        nft.reveal(bob);
        uint64 aliceFirst = storedSeed(1);
        uint64 bobSecond = storedSeed(2);
        vm.revertToState(snap);
        nft.reveal(bob);
        nft.reveal(alice);
        assertEq(storedSeed(2), aliceFirst, "alice's face does not depend on the order");
        assertEq(storedSeed(1), bobSecond, "bob's face does not depend on the order");
        assertTrue(aliceFirst != bobSecond);
    }

    /// The commit block is chosen by the roller, but blockhash(B + 1) is not known when the commit is mined.
    function test_SeedNeedsTheHashOfTheBlockAfterTheCommit() public {
        uint256 B = base;
        vm.prank(alice);
        nft.commit(NONE);
        assertEq(blockhash(B + 1), bytes32(0), "at commit time the next block has no hash yet");
        go(B + 2);
        nft.reveal(alice);
        assertTrue(storedSeed(1) != seedOf(bytes32(0), alice, NONE, B), "a zero hash never makes a face");
    }

    /// The 1/1 draw runs on every reveal, pins or none.
    function test_OneOfOneDrawRunsWithPinsToo() public {
        uint128 onePin = 0x00ffffffffffffffffffffffffffffff; // background item 0
        uint256 price = nft.priceOf(onePin);
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        nft.commit{value: price}(onePin);
        go(base + 2);
        uint256 id = nft.reveal(alice);
        (uint64 seed,, uint8 one,) = nft.faces(id);
        uint256 lucky = renderer.luckyFor(seed, nft.oneOfOnes(), 10000);
        if (lucky < nft.oneOfOnes()) assertTrue(one != 255, "a hit is recorded even with pins");
        else assertEq(one, 255);
    }
}
