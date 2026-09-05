// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IFaceRenderer} from "./IFaceRenderer.sol";

/// @title OneNFT, one face a day per wallet
/// @notice Every wallet may roll one face per UTC day, free. A roll may pin up to
/// any of the twelve things (seven layers, skin, hair colour, ground, top colour, accent)
/// to a common or uncommon item for a fee that doubles with every pin; the rest is luck.
/// Any roll may land on a 1/1, once each, with odds of pool left over tokens
/// left, so the pool empties with the supply. The author's wallet gets one free
/// roll a day too, which anyone may trigger. Supply stops at MAX_SUPPLY.
///
/// A roll is two steps so nobody can try, look and revert: `commit` spends the
/// wallet's day and the fee and fixes the pins; `reveal`, one block later, mixes
/// the hash of the block after the commit into the seed and mints. Anyone may
/// reveal for anyone, so the site does it and the roller signs once.
///
/// The image is drawn by a separate renderer from the seed, the pins and the
/// 1/1 index stored per token. The renderer address is stored per token at
/// reveal time, so `setRenderer` touches future rolls only. `lockRenderer`
/// closes even that door, one way.
contract OneNFT is ERC721, Ownable {
    uint256 public constant EPOCH_SECONDS = 86400;
    uint256 public constant MAX_SUPPLY = 10000;
    uint8 public constant NO_ONE = 255;
    uint128 public constant NO_PINS = type(uint128).max;

    address public immutable author;
    /// @notice The wallet that pays gas for reveals and treasury rolls; it takes KEEPER_BPS of every fee.
    address public immutable keeper;
    uint256 public constant KEEPER_BPS = 500;
    /// @dev Size of the 1/1 pool at deploy; a new renderer must know at least this many.
    uint256 public immutable oneOfOnes;

    address public renderer;
    bool public rendererLocked;
    uint256 public totalSupply;
    /// @dev Commits not yet revealed; they hold a place in the supply.
    uint256 public pending;

    struct Face {
        uint64 seed;
        uint128 pins;
        uint8 one;
        address renderer;
    }
    struct Commit {
        uint128 pins;
        uint64 blockNumber;
        uint64 paid;
    }

    mapping(uint256 tokenId => Face) public faces;
    mapping(address wallet => uint256 epoch) public lastRollEpoch;
    mapping(address wallet => Commit) public commits;
    /// @dev Indices of the 1/1s still unrolled; swap-and-pop on a hit.
    uint8[] public pool;

    event Committed(address indexed wallet, uint128 pins, uint256 blockNumber, uint256 paid);
    event Rolled(uint256 indexed tokenId, address indexed to, uint64 seed, uint128 pins, uint8 one, uint256 paid);
    event RendererSet(address indexed renderer);
    event RendererLocked();

    error SoldOut();
    error OneRollADay(address wallet, uint256 nextRollAt);
    error BadPins(uint128 pins);
    error WrongPrice(uint256 want, uint256 got);
    error PayoutFailed();
    error NothingToReveal(address wallet);
    error TooEarly(address wallet, uint256 revealBlock);
    error RendererIsLocked();
    error BadRenderer(address renderer);
    error OwnershipIsPermanent();

    constructor(string memory name_, string memory symbol_, address author_, address keeper_, address renderer_) ERC721(name_, symbol_) Ownable(author_) {
        uint256 n = _checkRenderer(renderer_, 0);
        oneOfOnes = n;
        author = author_;
        keeper = keeper_;
        renderer = renderer_;
        for (uint256 i = 0; i < n; i++) pool.push(uint8(i));
        emit RendererSet(renderer_);
    }

    /// @dev A renderer address is pinned per token forever, so before anyone rolls
    /// against it every entrypoint `reveal` and `tokenURI` depend on must answer: one
    /// full tokenURI, the meta reads of the 1/1 path and of a pinned path (attributes,
    /// cheap: no pixels, so the deploy stays under the RPC gas cap), and the pin, count
    /// and luck helpers. It must also know every 1/1 still in the pool.
    /// @return ones how many 1/1s the renderer knows
    function _checkRenderer(address renderer_, uint256 minOnes) internal view returns (uint256 ones) {
        if (renderer_.code.length == 0) revert BadRenderer(renderer_);
        IFaceRenderer r = IFaceRenderer(renderer_);
        ones = r.oneOfOneCount();
        if (ones < minOnes) revert BadRenderer(renderer_);
        if (!r.pinsOk(NO_PINS) || r.pinCount(NO_PINS) != 0 || r.luckyFor(1, 0, 1) != NO_ONE) revert BadRenderer(renderer_);
        if (bytes(r.tokenURI(1, 1, NO_PINS, NO_ONE)).length < 64) revert BadRenderer(renderer_);
        if (ones > 0 && bytes(r.attributes(1, NO_PINS, uint8(ones - 1))).length < 16) revert BadRenderer(renderer_);
        uint128 onePin = 0x00ffffffffffffffffffffffffffffff; // background item 0
        if (!r.pinsOk(onePin) || r.pinCount(onePin) != 1 || bytes(r.attributes(1, onePin, NO_ONE)).length < 16) revert BadRenderer(renderer_);
    }

    // ---- clock and price ----

    function currentEpoch() public view returns (uint256) {
        return block.timestamp / EPOCH_SECONDS;
    }

    /// @return Seconds until midnight UTC, when every wallet may roll again.
    function secondsLeft() public view returns (uint256) {
        return (currentEpoch() + 1) * EPOCH_SECONDS - block.timestamp;
    }

    function canRoll(address wallet) public view returns (bool) {
        return lastRollEpoch[wallet] < currentEpoch() && totalSupply + pending < MAX_SUPPLY;
    }

    /// @notice The price doubles with every pin: 0.0005 ETH for one, 1.024 ETH for all twelve.
    function priceOf(uint128 pins) public view returns (uint256) {
        uint256 n = IFaceRenderer(renderer).pinCount(pins);
        if (n == 0) return 0;
        return 0.0005 ether << (n - 1);
    }

    function poolLeft() external view returns (uint256) {
        return pool.length;
    }

    // ---- rolling: commit, then reveal ----

    /// @notice Spend today's roll: fix the pins, pay the fee, hold a place. Reveal one block later.
    /// The fee splits 95 to the author and 5 to the keeper, in basis points KEEPER_BPS.
    /// @param pins one byte per pin key, high byte first: background, top, head, eyes, mouth, accessory, hair, skin, hair colour, ground, top colour, accent, four spare; 255 for none
    function commit(uint128 pins) external payable {
        uint256 price = priceOf(pins);
        if (msg.value != price) revert WrongPrice(price, msg.value);
        if (pins != NO_PINS && !IFaceRenderer(renderer).pinsOk(pins)) revert BadPins(pins);
        _commit(msg.sender, pins, price);
        if (price > 0) {
            uint256 tip = (price * KEEPER_BPS) / 10000;
            (bool ok,) = author.call{value: price - tip}("");
            if (!ok) revert PayoutFailed();
            (ok,) = keeper.call{value: tip}("");
            if (!ok) revert PayoutFailed();
        }
    }

    /// @notice The author's daily roll, free and unpinned. Anyone may commit it; the seed comes from a later block, so nobody can pick the outcome.
    function commitForTreasury() external {
        _commit(author, NO_PINS, 0);
    }

    function _commit(address wallet, uint128 pins, uint256 price) internal {
        if (totalSupply + pending >= MAX_SUPPLY) revert SoldOut();
        uint256 epoch = currentEpoch();
        if (lastRollEpoch[wallet] >= epoch) revert OneRollADay(wallet, (lastRollEpoch[wallet] + 1) * EPOCH_SECONDS);
        lastRollEpoch[wallet] = epoch;
        commits[wallet] = Commit(pins, uint64(block.number), uint64(price));
        pending++;
        emit Committed(wallet, pins, block.number, price);
    }

    /// @notice Mint the committed face for `wallet`. Anyone may call, from the block after the commit on.
    /// The seed mixes the hash of that block; past 256 blocks the hash reads as zero, still one seed, still one face.
    function reveal(address wallet) external returns (uint256 tokenId) {
        Commit memory c = commits[wallet];
        if (c.blockNumber == 0) revert NothingToReveal(wallet);
        if (block.number <= c.blockNumber) revert TooEarly(wallet, c.blockNumber + 1);
        delete commits[wallet];
        pending--;
        tokenId = ++totalSupply;
        uint64 seed = uint64(uint256(keccak256(abi.encodePacked(blockhash(c.blockNumber + 1), wallet, c.pins, c.blockNumber, tokenId))));
        uint8 one = NO_ONE;
        if (pool.length > 0) {
            uint256 lucky = IFaceRenderer(renderer).luckyFor(seed, pool.length, MAX_SUPPLY - tokenId + 1);
            if (lucky < pool.length) {
                one = pool[lucky];
                pool[lucky] = pool[pool.length - 1];
                pool.pop();
            }
        }
        faces[tokenId] = Face(seed, c.pins, one, renderer);
        // _mint, not _safeMint: after EIP-7702 a normal wallet can carry delegation
        // code that does not answer onERC721Received.
        _mint(wallet, tokenId);
        emit Rolled(tokenId, wallet, seed, c.pins, one, c.paid);
    }

    /// @return revealBlock the first block a wallet's commit can be revealed in, 0 when there is none
    function revealBlockOf(address wallet) external view returns (uint256 revealBlock) {
        Commit memory c = commits[wallet];
        return c.blockNumber == 0 ? 0 : c.blockNumber + 1;
    }

    // ---- renderer ----

    function setRenderer(address renderer_) external onlyOwner {
        if (rendererLocked) revert RendererIsLocked();
        _checkRenderer(renderer_, oneOfOnes);
        renderer = renderer_;
        emit RendererSet(renderer_);
    }

    /// @dev Giving up ownership would freeze the renderer while `rendererLocked`
    /// still reads false. `lockRenderer` is the one sanctioned way to freeze.
    function renounceOwnership() public pure override {
        revert OwnershipIsPermanent();
    }

    /// @notice One way. After this no renderer bug can be fixed, for rolling or for metadata.
    function lockRenderer() external onlyOwner {
        rendererLocked = true;
        emit RendererLocked();
    }

    /// @notice ETH forced into the contract (nothing in the normal flow leaves any) goes to the author.
    function sweep() external {
        (bool ok,) = author.call{value: address(this).balance}("");
        if (!ok) revert PayoutFailed();
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Face memory f = faces[tokenId];
        return IFaceRenderer(f.renderer).tokenURI(tokenId, f.seed, f.pins, f.one);
    }

    function svgOf(uint256 tokenId) external view returns (string memory) {
        _requireOwned(tokenId);
        Face memory f = faces[tokenId];
        return IFaceRenderer(f.renderer).svg(f.seed, f.pins, f.one);
    }
}
