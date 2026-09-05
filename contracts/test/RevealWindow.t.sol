// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {OneNFT} from "../src/OneNFT.sol";
import {FaceRenderer} from "../src/FaceRenderer.sol";
import {DataStore} from "../src/DataStore.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title What the seed of a roll depends on, block by block.
/// @notice These tests document the deployed contract as it is. They change nothing.
/// The reveal may be sent from block B + 1 on, where B is the commit block, and
/// the seed mixes `blockhash(B + 1)`. Inside block B + 1 that hash reads as zero
/// (the EVM has no hash for the current block); from B + 2 to B + 257 it is the
/// real hash; from B + 258 on it reads as zero again (the 256-block window).
/// The token id, which depends on the order of reveals, is part of the seed too.
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

    function seedOf(bytes32 hash, address wallet, uint128 pins, uint256 commitBlock, uint256 tokenId) internal pure returns (uint64) {
        return uint64(uint256(keccak256(abi.encodePacked(hash, wallet, pins, uint64(commitBlock), tokenId))));
    }
    function storedSeed(uint256 id) internal view returns (uint64 seed) {
        (seed,,,) = nft.faces(id);
    }

    function test_RevealInBlockB_Reverts() public {
        vm.prank(alice);
        nft.commit(NONE);
        vm.expectRevert(abi.encodeWithSelector(OneNFT.TooEarly.selector, alice, block.number + 1));
        nft.reveal(alice);
    }

    /// In block B + 1 the hash the seed reads is zero: the seed is a function of public inputs only.
    function test_RevealInBlockBPlus1_UsesZeroHash() public {
        uint256 B = base;
        vm.prank(alice);
        nft.commit(NONE);
        vm.roll(B + 1);
        assertEq(blockhash(B + 1), bytes32(0), "the current block has no hash");
        uint256 id = nft.reveal(alice);
        assertEq(id, 1);
        assertEq(storedSeed(1), seedOf(bytes32(0), alice, NONE, B, 1), "seed computed from a zero hash");
    }

    /// From block B + 2 on the real hash of B + 1 is in the seed.
    function test_RevealInBlockBPlus2_UsesRealHash() public {
        uint256 B = base;
        vm.prank(alice);
        nft.commit(NONE);
        vm.roll(B + 2);
        vm.setBlockhash(B + 1, keccak256("block B+1"));
        bytes32 h = blockhash(B + 1);
        assertTrue(h != bytes32(0), "the previous block has a hash");
        nft.reveal(alice);
        assertEq(storedSeed(1), seedOf(h, alice, NONE, B, 1));
        assertTrue(storedSeed(1) != seedOf(bytes32(0), alice, NONE, B, 1), "differs from the zero-hash seed");
    }

    /// Block B + 257 is the last block in which blockhash(B + 1) is still available.
    function test_RevealInBlockBPlus257_LastRealHash() public {
        uint256 B = base;
        vm.prank(alice);
        nft.commit(NONE);
        vm.roll(B + 257);
        vm.setBlockhash(B + 1, keccak256("block B+1"));
        bytes32 h = blockhash(B + 1);
        assertTrue(h != bytes32(0), "256 blocks back is still in the window");
        nft.reveal(alice);
        assertEq(storedSeed(1), seedOf(h, alice, NONE, B, 1));
    }

    /// From block B + 258 on the hash reads as zero again, as the NatSpec says.
    function test_RevealInBlockBPlus258_ZeroHashAgain() public {
        uint256 B = base;
        vm.prank(alice);
        nft.commit(NONE);
        vm.roll(B + 258);
        vm.setBlockhash(B + 1, keccak256("block B+1"));
        assertEq(blockhash(B + 1), bytes32(0), "257 blocks back is outside the window");
        nft.reveal(alice);
        assertEq(storedSeed(1), seedOf(bytes32(0), alice, NONE, B, 1));
    }

    /// The token id is in the seed, and the id depends on who reveals first.
    /// Two commits in one block; revealing alice first or second gives her a different face.
    function test_RevealOrderChangesTheSeed() public {
        uint256 B = base;
        vm.prank(alice);
        nft.commit(NONE);
        vm.prank(bob);
        nft.commit(NONE);
        vm.roll(B + 2);
        vm.setBlockhash(B + 1, keccak256("block B+1"));
        bytes32 h = blockhash(B + 1);
        uint256 snap = vm.snapshotState();
        nft.reveal(alice);
        nft.reveal(bob);
        uint64 aliceFirst = storedSeed(1);
        assertEq(aliceFirst, seedOf(h, alice, NONE, B, 1));
        vm.revertToState(snap);
        nft.reveal(bob);
        nft.reveal(alice);
        uint64 aliceSecond = storedSeed(2);
        assertEq(aliceSecond, seedOf(h, alice, NONE, B, 2));
        assertTrue(aliceFirst != aliceSecond, "the same commit gives two different faces depending on reveal order");
    }

    /// Once the hash is known (B + 2 on) every candidate seed can be computed ahead of the reveal, one per token id.
    function test_SeedIsComputableBeforeTheRevealOnceTheHashExists() public {
        uint256 B = base;
        vm.prank(alice);
        nft.commit(NONE);
        vm.roll(B + 2);
        vm.setBlockhash(B + 1, keccak256("block B+1"));
        uint64 predicted = seedOf(blockhash(B + 1), alice, NONE, B, nft.totalSupply() + 1);
        nft.reveal(alice);
        assertEq(storedSeed(1), predicted, "the seed was known before the reveal transaction");
    }

    /// The 1/1 draw runs on every reveal, pins or none.
    function test_OneOfOneDrawRunsWithPinsToo() public {
        uint128 onePin = 0x00ffffffffffffffffffffffffffffff; // background item 0
        uint256 price = nft.priceOf(onePin);
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        nft.commit{value: price}(onePin);
        vm.roll(block.number + 2);
        uint256 id = nft.reveal(alice);
        (uint64 seed,, uint8 one,) = nft.faces(id);
        uint256 lucky = renderer.luckyFor(seed, nft.oneOfOnes(), 10000);
        // Whether or not this seed hit, the contract consulted the draw: `one` agrees with the renderer's answer.
        if (lucky < nft.oneOfOnes()) assertTrue(one != 255, "a hit is recorded even with pins");
        else assertEq(one, 255);
    }
}
