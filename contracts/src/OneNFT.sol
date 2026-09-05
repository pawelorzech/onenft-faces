// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IFaceRenderer} from "./IFaceRenderer.sol";

/// @title OneNFT, one face a day per wallet
/// @notice Every wallet may roll one face per UTC day, free. A roll may pin up to
/// three of the pinnable things (background, top, eyes, hair, skin) to a common or
/// uncommon item for a fee that rises with the number of pins; the rest is luck.
/// A roll with no pins may land on a 1/1, once each, with odds of pool left over
/// tokens left, so the pool empties with the supply.
/// The author's wallet gets one free roll a day too, which anyone may trigger.
/// Supply stops at MAX_SUPPLY.
///
/// The image is drawn by a separate renderer from the seed, the pins and the
/// 1/1 index stored per token. The renderer address is stored per token at
/// roll time, so `setRenderer` touches future rolls only. `lockRenderer`
/// closes even that door, one way.
contract OneNFT is ERC721, Ownable {
    uint256 public constant EPOCH_SECONDS = 86400;
    uint256 public constant MAX_SUPPLY = 10000;
    uint8 public constant NO_ONE = 255;
    uint64 public constant NO_PINS = type(uint64).max;

    address public immutable author;
    address public renderer;
    bool public rendererLocked;
    uint256 public totalSupply;

    struct Face {
        uint64 seed;
        uint64 pins;
        uint8 one;
        address renderer;
    }

    mapping(uint256 tokenId => Face) public faces;
    mapping(address wallet => uint256 epoch) public lastRollEpoch;
    /// @dev Indices of the 1/1s still unrolled; swap-and-pop on a hit.
    uint8[] public pool;

    event Rolled(uint256 indexed tokenId, address indexed to, uint64 seed, uint64 pins, uint8 one, uint256 paid);
    event RendererSet(address indexed renderer);
    event RendererLocked();

    error SoldOut();
    error OneRollADay(address wallet, uint256 nextEpoch);
    error BadPins(uint64 pins);
    error WrongPrice(uint256 want, uint256 got);
    error PayoutFailed();
    error RendererIsLocked();
    error BadRenderer(address renderer);
    error OwnershipIsPermanent();

    constructor(string memory name_, string memory symbol_, address author_, address renderer_) ERC721(name_, symbol_) Ownable(author_) {
        _checkRenderer(renderer_);
        author = author_;
        renderer = renderer_;
        uint256 n = IFaceRenderer(renderer_).oneOfOneCount();
        for (uint256 i = 0; i < n; i++) pool.push(uint8(i));
        emit RendererSet(renderer_);
    }

    /// @dev A renderer address is pinned per token forever, so it must be a live
    /// contract that answers tokenURI() before we let anyone roll against it.
    function _checkRenderer(address renderer_) internal view {
        if (renderer_.code.length == 0) revert BadRenderer(renderer_);
        (bool ok, bytes memory out) = renderer_.staticcall(abi.encodeCall(IFaceRenderer.tokenURI, (1, 1, NO_PINS, NO_ONE)));
        if (!ok || out.length < 96) revert BadRenderer(renderer_);
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
        return lastRollEpoch[wallet] < currentEpoch() && totalSupply < MAX_SUPPLY;
    }

    /// @notice 0, 0.0005, 0.0015 or 0.004 ETH for zero to three pins.
    function priceOf(uint64 pins) public view returns (uint256) {
        uint256 n = IFaceRenderer(renderer).pinCount(pins);
        if (n == 0) return 0;
        if (n == 1) return 0.0005 ether;
        if (n == 2) return 0.0015 ether;
        return 0.004 ether;
    }

    function poolLeft() external view returns (uint256) {
        return pool.length;
    }

    // ---- rolling ----

    /// @notice Roll today's face for yourself. Free with no pins; pinned rolls cost `priceOf(pins)`, sent to the author.
    /// @param pins one byte per pin key, high byte first: background, top, eyes, hair, skin, then spare; 255 for none
    function roll(uint64 pins) external payable returns (uint256 tokenId) {
        uint256 price = priceOf(pins);
        if (msg.value != price) revert WrongPrice(price, msg.value);
        if (pins != NO_PINS && (IFaceRenderer(renderer).pinCount(pins) > 3 || !IFaceRenderer(renderer).pinsOk(pins))) revert BadPins(pins);
        tokenId = _roll(msg.sender, pins);
        if (price > 0) {
            (bool ok,) = author.call{value: price}("");
            if (!ok) revert PayoutFailed();
        }
    }

    /// @notice The author's daily roll. Anyone may call; the face goes to the author.
    function rollForTreasury() external returns (uint256 tokenId) {
        tokenId = _roll(author, NO_PINS);
    }

    function _roll(address to, uint64 pins) internal returns (uint256 tokenId) {
        if (totalSupply >= MAX_SUPPLY) revert SoldOut();
        uint256 epoch = currentEpoch();
        if (lastRollEpoch[to] >= epoch) revert OneRollADay(to, (lastRollEpoch[to] + 1) * EPOCH_SECONDS);
        lastRollEpoch[to] = epoch;
        tokenId = ++totalSupply;
        uint64 seed = uint64(uint256(keccak256(abi.encodePacked(block.prevrandao, to, tokenId, block.number))));
        uint8 one = NO_ONE;
        if (pins == NO_PINS && pool.length > 0) {
            uint8 lucky = uint8(IFaceRenderer(renderer).luckyFor(seed, pool.length, MAX_SUPPLY - tokenId + 1));
            if (lucky != NO_ONE) {
                one = pool[lucky];
                pool[lucky] = pool[pool.length - 1];
                pool.pop();
            }
        }
        faces[tokenId] = Face(seed, pins, one, renderer);
        // _mint, not _safeMint: after EIP-7702 a normal wallet can carry delegation
        // code that does not answer onERC721Received.
        _mint(to, tokenId);
        emit Rolled(tokenId, to, seed, pins, one, msg.value);
    }

    // ---- renderer ----

    function setRenderer(address renderer_) external onlyOwner {
        if (rendererLocked) revert RendererIsLocked();
        _checkRenderer(renderer_);
        renderer = renderer_;
        emit RendererSet(renderer_);
    }

    /// @dev Giving up ownership would freeze the renderer while `rendererLocked`
    /// still reads false. `lockRenderer` is the one sanctioned way to freeze.
    function renounceOwnership() public pure override {
        revert OwnershipIsPermanent();
    }

    function lockRenderer() external onlyOwner {
        rendererLocked = true;
        emit RendererLocked();
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

