// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Draws a face from its seed, its pins and its 1/1 index (255 for none).
/// `pins` is one byte per pinnable slot, high byte first, 255 for no pin.
interface IFaceRenderer {
    function tokenURI(uint256 tokenId, uint64 seed, uint32 pins, uint8 one) external view returns (string memory);
    function svg(uint64 seed, uint32 pins, uint8 one) external view returns (string memory);
    /// @return true when every set pin names a common or uncommon item of a pinnable slot
    function pinsOk(uint32 pins) external view returns (bool);
    function pinCount(uint32 pins) external pure returns (uint256);
    function oneOfOneCount() external view returns (uint256);
    /// @return the 1/1 pool index a seed takes, or 255
    function luckyFor(uint64 seed, uint256 poolLength) external view returns (uint256);
}
