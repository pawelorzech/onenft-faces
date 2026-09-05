// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Draws a face from its seed, its pins and its 1/1 index (255 for none).
/// `pins` is one byte per pin key, high byte first: the slots, then skin, hair colour, ground, top colour, accent, then spare bytes; 255 for no pin.
interface IFaceRenderer {
    function tokenURI(uint256 tokenId, uint64 seed, uint128 pins, uint8 one) external view returns (string memory);
    function svg(uint64 seed, uint128 pins, uint8 one) external view returns (string memory);
    /// @return the attributes JSON array body; cheap (no pixels), exercises the meta reads of that path
    function attributes(uint64 seed, uint128 pins, uint8 one) external view returns (string memory);
    /// @return true when every set pin names a common or uncommon item of a pinnable slot
    function pinsOk(uint128 pins) external view returns (bool);
    function pinCount(uint128 pins) external pure returns (uint256);
    function oneOfOneCount() external view returns (uint256);
    /// @return the 1/1 pool index a seed takes with odds poolLength / tokensLeft, or 255
    function luckyFor(uint64 seed, uint256 poolLength, uint256 tokensLeft) external view returns (uint256);
}
