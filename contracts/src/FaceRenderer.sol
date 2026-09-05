// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Base64} from "./lib/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IFaceRenderer} from "./IFaceRenderer.sol";
import {DataStore} from "./DataStore.sol";

/// @title FaceRenderer
/// @notice A one-to-one port of `src/faces.ts`: the same draws, the same weight
/// tables, the same role-to-colour maps, the same rim light, the same SVG and
/// JSON strings. The equality test compares against fixtures generated from
/// TypeScript. Changing anything here without the same change in TS is a bug.
///
/// Sprites are 384 bytes each (32x32 pixels, three bits per pixel, a role not a
/// colour) in data contracts, PER_STORE per contract. `meta` holds the slot
/// table, weights, tiers, colour swatches and names; see contracts/fixtures.ts
/// for the byte layout.
contract FaceRenderer is IFaceRenderer {
    using Strings for uint256;

    uint256 public constant RECORD = 384;
    uint256 public constant PER_STORE = 63;
    uint8 public constant NO_PIN = 255;

    address public immutable meta;
    address[] internal stores;
    uint256 public immutable spriteCount;

    error BadData(string which, uint256 length);

    constructor(address[] memory stores_, address meta_, uint256 spriteCount_) {
        uint256 left = spriteCount_;
        for (uint256 i = 0; i < stores_.length; i++) {
            uint256 want = left > PER_STORE ? PER_STORE : left;
            if (stores_[i].code.length != want * RECORD + 1) revert BadData("store", stores_[i].code.length);
            left -= want;
        }
        if (left != 0) revert BadData("stores", stores_.length);
        if (meta_.code.length < 64) revert BadData("meta", meta_.code.length);
        stores = stores_;
        meta = meta_;
        spriteCount = spriteCount_;
        Layout memory L = layout(DataStore.read(meta_));
        if (L.totalItems + L.ones != spriteCount_) revert BadData("sprites", L.totalItems + L.ones);
    }

    function store(uint256 i) external view returns (address) {
        return stores[i];
    }

    // ---- meta ----

    struct Layout {
        uint256 slots; // S
        uint256 totalItems; // sum of item counts
        uint256 weights; // offset of slot 0's block (u16 weights then u8 tiers, 3 bytes per item)
        uint256 skins; // offset of the skin count byte
        uint256 hairs;
        uint256 tops;
        uint256 grounds;
        uint256 accents;
        uint256 onesAt; // offset of the 1/1 count byte
        uint256 ones;
        uint256 names; // offset of the first name
    }

    function u8(bytes memory m, uint256 p) internal pure returns (uint256) {
        return uint8(m[p]);
    }

    function u16(bytes memory m, uint256 p) internal pure returns (uint256) {
        return (uint256(uint8(m[p])) << 8) | uint8(m[p + 1]);
    }

    function layout(bytes memory m) public pure returns (Layout memory L) {
        L.slots = u8(m, 0);
        for (uint256 k = 0; k < L.slots; k++) L.totalItems += u8(m, 1 + 3 * k);
        L.weights = 1 + 3 * L.slots;
        L.skins = L.weights + 3 * L.totalItems;
        L.hairs = L.skins + 1 + 12 * u8(m, L.skins);
        L.tops = L.hairs + 1 + 9 * u8(m, L.hairs);
        L.grounds = L.tops + 1 + 9 * u8(m, L.tops);
        L.accents = L.grounds + 1 + 9 * u8(m, L.grounds);
        L.onesAt = L.accents + 1 + 9 * u8(m, L.accents);
        L.ones = u8(m, L.onesAt);
        L.names = L.onesAt + 1 + 18 * L.ones;
    }

    function itemCount(bytes memory m, uint256 slot) internal pure returns (uint256) {
        return u8(m, 1 + 3 * slot);
    }

    function pinnable(bytes memory m, uint256 slot) internal pure returns (bool) {
        return u8(m, 2 + 3 * slot) == 1;
    }

    function groupOf(bytes memory m, uint256 slot) internal pure returns (uint256) {
        return u8(m, 3 + 3 * slot);
    }

    /// @dev Offset of slot k's block: weights first, tiers after.
    function slotBlock(bytes memory m, Layout memory L, uint256 slot) internal pure returns (uint256 p) {
        p = L.weights;
        for (uint256 k = 0; k < slot; k++) p += 3 * itemCount(m, k);
    }

    function tierOf(bytes memory m, Layout memory L, uint256 slot, uint256 item) internal pure returns (uint256) {
        uint256 b = slotBlock(m, L, slot);
        return u8(m, b + 2 * itemCount(m, slot) + item);
    }

    /// @dev Walks the length-prefixed names to the n-th one.
    function nameAt(bytes memory m, Layout memory L, uint256 n) internal pure returns (string memory) {
        uint256 p = L.names;
        for (uint256 k = 0; k < n; k++) p += 1 + u8(m, p);
        uint256 len = u8(m, p);
        bytes memory out = new bytes(len);
        for (uint256 k = 0; k < len; k++) out[k] = m[p + 1 + k];
        return string(out);
    }

    /// @dev Global sprite number of (slot, item): items are stored slot by slot.
    function spriteOf(bytes memory m, uint256 slot, uint256 item) internal pure returns (uint256 g) {
        for (uint256 k = 0; k < slot; k++) g += itemCount(m, k);
        g += item;
    }

    function spriteData(uint256 g) public view returns (bytes memory) {
        return DataStore.read(stores[g / PER_STORE], (g % PER_STORE) * RECORD, RECORD);
    }

    function rgb(bytes memory m, uint256 p) internal pure returns (uint256) {
        return (uint256(uint8(m[p])) << 16) | (uint256(uint8(m[p + 1])) << 8) | uint8(m[p + 2]);
    }

    // ---- draws ----

    /// @dev splitmix64 finalizer, wrapping at 64 bits.
    function mix64(uint64 x) public pure returns (uint64 z) {
        unchecked {
            z = x + 0x9e3779b97f4a7c15;
            z = (z ^ (z >> 30)) * 0xbf58476d1ce4e5b9;
            z = (z ^ (z >> 27)) * 0x94d049bb133111eb;
            z = z ^ (z >> 31);
        }
    }

    /// @notice Draw i is mix64(seed + i) mod 10000.
    function draw(uint64 seed, uint256 i) public pure returns (uint256) {
        unchecked {
            return mix64(seed + uint64(i)) % 10000;
        }
    }

    function pickWeighted(bytes memory m, uint256 at, uint256 n, uint256 roll) internal pure returns (uint256) {
        uint256 acc = 0;
        for (uint256 i = 0; i < n; i++) {
            acc += u16(m, at + 2 * i);
            if (roll < acc) return i;
        }
        return n - 1;
    }

    /// @notice The 1/1 index a seed takes from a pool of `poolLength` with `tokensLeft` still to roll, or 255.
    /// Odds are poolLength / tokensLeft, so on average the pool empties with the supply.
    function luckyOf(uint64 seed, uint256 slots, uint256 poolLength, uint256 tokensLeft) public pure returns (uint8) {
        if (poolLength == 0 || tokensLeft == 0) return NO_PIN;
        if (draw(seed, slots + 5) >= (poolLength * 10000) / tokensLeft) return NO_PIN;
        return uint8(draw(seed, slots + 6) % poolLength);
    }

    /// @notice `luckyOf` with the slot count read from meta, for the token contract.
    function luckyFor(uint64 seed, uint256 poolLength, uint256 tokensLeft) external view returns (uint256) {
        return luckyOf(seed, u8(DataStore.read(meta), 0), poolLength, tokensLeft);
    }

    /// @dev Byte k of the pins, high byte first: the pinnable slots in order, then the skin, then spare bytes.
    function pinByte(uint64 pins, uint256 k) internal pure returns (uint8) {
        return uint8(pins >> (8 * (7 - k)));
    }

    function pinCount(uint64 pins) public pure returns (uint256 n) {
        for (uint256 k = 0; k < 8; k++) if (pinByte(pins, k) != NO_PIN) n++;
    }

    /// @notice Every set pin names a common or uncommon item of a pinnable slot, or a common or uncommon skin; spare bytes are empty.
    function pinsOk(uint64 pins) public view returns (bool) {
        bytes memory m = DataStore.read(meta);
        Layout memory L = layout(m);
        uint256 k = 0;
        for (uint256 slot = 0; slot < L.slots; slot++) {
            if (!pinnable(m, slot)) continue;
            uint8 p = pinByte(pins, k++);
            if (p == NO_PIN) continue;
            if (p >= itemCount(m, slot)) return false;
            if (tierOf(m, L, slot, p) > 1) return false;
        }
        uint8 sk = pinByte(pins, k++);
        if (sk != NO_PIN) {
            if (sk >= u8(m, L.skins)) return false;
            if (u8(m, L.skins + 1 + 12 * sk + 2) > 1) return false;
        }
        for (; k < 8; k++) if (pinByte(pins, k) != NO_PIN) return false;
        return true;
    }

    struct Traits {
        uint256[] items;
        uint256 skin;
        uint256 hair;
        uint256 top;
        uint256 ground;
        uint256 accent;
        uint8 one;
    }

    function traitsOf(bytes memory m, Layout memory L, uint64 seed, uint64 pins, uint8 one) public pure returns (Traits memory t) {
        t.items = new uint256[](L.slots);
        uint256 k = 0;
        for (uint256 slot = 0; slot < L.slots; slot++) {
            uint256 n = itemCount(m, slot);
            uint256 rolled = pickWeighted(m, slotBlock(m, L, slot), n, draw(seed, slot));
            if (pinnable(m, slot)) {
                uint8 p = pinByte(pins, k++);
                if (p != NO_PIN) rolled = p;
            }
            t.items[slot] = rolled;
        }
        uint8 skinPin = pinByte(pins, k);
        uint256 S = L.slots;
        uint256 skinCount = u8(m, L.skins);
        // skin weights sit at 12-byte stride: u16 weight, u8 tier, 9 bytes rgb
        uint256 acc = 0;
        uint256 roll = draw(seed, S);
        t.skin = skinCount - 1;
        for (uint256 i = 0; i < skinCount; i++) {
            acc += u16(m, L.skins + 1 + 12 * i);
            if (roll < acc) { t.skin = i; break; }
        }
        if (skinPin != NO_PIN) t.skin = skinPin;
        t.hair = draw(seed, S + 1) % u8(m, L.hairs);
        t.top = draw(seed, S + 2) % u8(m, L.tops);
        t.ground = draw(seed, S + 3) % u8(m, L.grounds);
        t.accent = draw(seed, S + 4) % u8(m, L.accents);
        t.one = one;
    }

    // ---- pixels ----

    /// @dev Role to palette index per group: 0 bg, 1 top, 2 skin, 3 eyes, 4 mouth, 5 hair, 6 acc.
    /// Roles: 0 none, 1 K, 2 A, 3 a, 4 L, 5 B, 6 b, 7 W. Palette: 1 outline, 2 white, 3 red,
    /// 4..6 skin, 7..9 hair, 10..12 top, 13..15 ground, 16..18 accent, 19..24 the 1/1's own.
    function roleMap(uint256 group) public pure returns (uint8[8] memory m) {
        m[1] = 1;
        m[7] = 2;
        if (group == 0) { m[2] = 13; m[3] = 14; m[4] = 15; m[5] = 16; m[6] = 17; }
        else if (group == 1) { m[2] = 10; m[3] = 11; m[4] = 12; m[5] = 4; m[6] = 5; }
        else if (group == 2) { m[2] = 4; m[3] = 5; m[4] = 6; m[5] = 16; m[6] = 17; }
        else if (group == 3) { m[2] = 4; m[3] = 5; m[5] = 16; m[6] = 17; }
        else if (group == 4) { m[2] = 4; m[3] = 5; m[5] = 3; m[6] = 3; }
        else if (group == 5) { m[2] = 7; m[3] = 8; m[4] = 9; m[5] = 16; m[6] = 17; }
        else { m[2] = 4; m[3] = 5; m[5] = 16; m[6] = 17; }
    }

    /// @dev Paints one sprite into the index map through a role map. Three bits per
    /// pixel, eight pixels per three bytes, high bits first; a zero role leaves the
    /// pixel alone, any other role writes its mapped index, even a zero one.
    function paint(uint8[1024] memory px, bytes memory d, uint8[8] memory map) internal pure {
        assembly {
            let base := add(d, 32)
            for { let g := 0 } lt(g, 128) { g := add(g, 1) } {
                let bits := shr(232, mload(add(base, mul(g, 3))))
                for { let j := 0 } lt(j, 8) { j := add(j, 1) } {
                    let role := and(shr(sub(21, mul(3, j)), bits), 7)
                    if role {
                        let off := mul(add(mul(g, 8), j), 32)
                        mstore(add(px, off), mload(add(map, mul(role, 32))))
                    }
                }
            }
        }
    }

    function compose(bytes memory m, Layout memory L, Traits memory t) public view returns (uint8[1024] memory px) {
        if (t.one != NO_PIN) {
            paint(px, spriteData(spriteOf(m, 0, t.items[0])), roleMap(groupOf(m, 0)));
            uint8[8] memory om = [0, 1, 19, 20, 21, 22, 23, 2];
            paint(px, spriteData(L.totalItems + t.one), om);
            for (uint256 y = 0; y < 32; y++) for (uint256 x = 1; x < 32; x++) {
                uint256 v = px[y * 32 + x];
                if ((v == 19 || v == 22) && px[y * 32 + x - 1] == 1) px[y * 32 + x] = uint8(v + 2);
            }
            return px;
        }
        for (uint256 slot = 0; slot < L.slots; slot++) {
            paint(px, spriteData(spriteOf(m, slot, t.items[slot])), roleMap(groupOf(m, slot)));
        }
        for (uint256 y = 0; y < 32; y++) for (uint256 x = 1; x < 32; x++) {
            uint256 v = px[y * 32 + x];
            if ((v == 4 || v == 7 || v == 10) && px[y * 32 + x - 1] == 1) px[y * 32 + x] = uint8(v + 2);
        }
    }

    function paletteOf(bytes memory m, Layout memory L, Traits memory t) public pure returns (uint256[25] memory pal) {
        pal[1] = 0x1c1a19;
        pal[2] = 0xf6f4ee;
        pal[3] = 0xd9534f;
        uint256 p = L.skins + 1 + 12 * t.skin + 3;
        for (uint256 i = 0; i < 3; i++) pal[4 + i] = rgb(m, p + 3 * i);
        p = L.hairs + 1 + 9 * t.hair;
        for (uint256 i = 0; i < 3; i++) pal[7 + i] = rgb(m, p + 3 * i);
        p = L.tops + 1 + 9 * t.top;
        for (uint256 i = 0; i < 3; i++) pal[10 + i] = rgb(m, p + 3 * i);
        p = L.grounds + 1 + 9 * t.ground;
        for (uint256 i = 0; i < 3; i++) pal[13 + i] = rgb(m, p + 3 * i);
        p = L.accents + 1 + 9 * t.accent;
        for (uint256 i = 0; i < 3; i++) pal[16 + i] = rgb(m, p + 3 * i);
        if (t.one != NO_PIN) {
            p = L.onesAt + 1 + 18 * t.one;
            for (uint256 i = 0; i < 6; i++) pal[19 + i] = rgb(m, p + 3 * i);
        }
    }

    /// @notice One rect per horizontal run of one palette index, skipping index 0.
    /// Written in Yul into one 64 kB buffer, as the sisters do.
    function svgOf(uint8[1024] memory px, uint256[25] memory pal) public pure returns (string memory out) {
        out = new string(65536);
        assembly {
            let dst := add(out, 32)
            let hexTable := "0123456789abcdef"
            function num(d, n, v) -> n2 {
                if gt(v, 9) {
                    mstore8(add(d, n), add(48, div(v, 10)))
                    n := add(n, 1)
                }
                mstore8(add(d, n), add(48, mod(v, 10)))
                n2 := add(n, 1)
            }
            function hex7(d, n, c, t) -> n2 {
                mstore8(add(d, n), 0x23)
                for { let k := 0 } lt(k, 3) { k := add(k, 1) } {
                    let v := and(shr(sub(16, mul(8, k)), c), 0xff)
                    mstore8(add(d, add(n, add(1, mul(2, k)))), byte(shr(4, v), t))
                    mstore8(add(d, add(n, add(2, mul(2, k)))), byte(and(v, 15), t))
                }
                n2 := add(n, 7)
            }
            let n := 0
            mstore(add(dst, n), "<svg xmlns=\"http://www.w3.org/20") n := add(n, 32)
            mstore(add(dst, n), "00/svg\" viewBox=\"0 0 32 32\" widt") n := add(n, 32)
            mstore(add(dst, n), "h=\"512\" height=\"512\" shape-rende") n := add(n, 32)
            mstore(add(dst, n), "ring=\"crispEdges\">") n := add(n, 18)
            for { let y := 0 } lt(y, 32) { y := add(y, 1) } {
                let x := 0
                for {} lt(x, 32) {} {
                    let p := add(mul(y, 32), x)
                    let c := mload(add(px, mul(p, 32)))
                    if iszero(c) {
                        x := add(x, 1)
                        continue
                    }
                    let w := 1
                    for {} and(lt(add(x, w), 32), eq(mload(add(px, mul(add(p, w), 32))), c)) {} { w := add(w, 1) }
                    mstore(add(dst, n), "<rect x=\"") n := add(n, 9)
                    n := num(dst, n, x)
                    mstore(add(dst, n), "\" y=\"") n := add(n, 5)
                    n := num(dst, n, y)
                    mstore(add(dst, n), "\" width=\"") n := add(n, 9)
                    n := num(dst, n, w)
                    mstore(add(dst, n), "\" height=\"1\" fill=\"") n := add(n, 19)
                    n := hex7(dst, n, mload(add(pal, mul(c, 32))), hexTable)
                    mstore(add(dst, n), "\"/>") n := add(n, 3)
                    x := add(x, w)
                }
            }
            mstore(add(dst, n), "</svg>") n := add(n, 6)
            mstore(out, n)
        }
    }

    // ---- IFaceRenderer ----

    function oneOfOneCount() external view returns (uint256) {
        return layout(DataStore.read(meta)).ones;
    }

    function svg(uint64 seed, uint64 pins, uint8 one) public view returns (string memory) {
        bytes memory m = DataStore.read(meta);
        Layout memory L = layout(m);
        Traits memory t = traitsOf(m, L, seed, pins, one);
        return svgOf(compose(m, L, t), paletteOf(m, L, t));
    }

    /// @dev Highest tier among the items and the skin; a 1/1 is legendary.
    function rarityOf(bytes memory m, Layout memory L, Traits memory t) internal pure returns (string memory) {
        if (t.one != NO_PIN) return "legendary";
        uint256 best = u8(m, L.skins + 1 + 12 * t.skin + 2);
        for (uint256 slot = 0; slot < L.slots; slot++) {
            uint256 tier = tierOf(m, L, slot, t.items[slot]);
            if (tier > best) best = tier;
        }
        return best == 0 ? "common" : best == 1 ? "uncommon" : best == 2 ? "rare" : "legendary";
    }

    function attr(string memory k, string memory v) internal pure returns (string memory) {
        return string.concat('{"trait_type":"', k, '","value":"', v, '"}');
    }

    /// @notice The attributes as one JSON array body, in the TypeScript order.
    function attributesOf(bytes memory m, Layout memory L, Traits memory t) public pure returns (string memory out) {
        uint256 skins = u8(m, L.skins);
        uint256 hairs = u8(m, L.hairs);
        uint256 tops = u8(m, L.tops);
        uint256 grounds = u8(m, L.grounds);
        uint256 accents = u8(m, L.accents);
        uint256 colourNames = L.slots + L.totalItems; // index of the first skin name
        if (t.one != NO_PIN) {
            out = attr("One of one", nameAt(m, L, colourNames + skins + hairs + tops + grounds + accents + t.one));
            out = string.concat(out, ",", attr(nameAt(m, L, 0), nameAt(m, L, L.slots + t.items[0])));
            out = string.concat(out, ",", attr("Ground", nameAt(m, L, colourNames + skins + hairs + tops + t.ground)));
        } else {
            uint256 base = L.slots;
            for (uint256 slot = 0; slot < L.slots; slot++) {
                out = string.concat(out, slot == 0 ? "" : ",", attr(nameAt(m, L, slot), nameAt(m, L, base + t.items[slot])));
                base += itemCount(m, slot);
            }
            out = string.concat(out, ",", attr("Skin", nameAt(m, L, colourNames + t.skin)));
            out = string.concat(out, ",", attr("Hair colour", nameAt(m, L, colourNames + skins + t.hair)));
            out = string.concat(out, ",", attr("Top colour", nameAt(m, L, colourNames + skins + hairs + t.top)));
            out = string.concat(out, ",", attr("Ground", nameAt(m, L, colourNames + skins + hairs + tops + t.ground)));
            out = string.concat(out, ",", attr("Accent", nameAt(m, L, colourNames + skins + hairs + tops + grounds + t.accent)));
        }
        out = string.concat(out, ",", attr("Rarity", rarityOf(m, L, t)));
    }

    function json(uint256 tokenId, uint64 seed, uint64 pins, uint8 one) public view returns (string memory) {
        bytes memory m = DataStore.read(meta);
        Layout memory L = layout(m);
        Traits memory t = traitsOf(m, L, seed, pins, one);
        string memory image = string.concat("data:image/svg+xml;base64,", Base64.encode(bytes(svgOf(compose(m, L, t), paletteOf(m, L, t)))));
        return string.concat(
            '{"name":"Face #', tokenId.toString(),
            '","description":"One face a day per wallet, rolled on chain. Pin what you want, luck does the rest. faces.onenft.click","image":"', image,
            '","attributes":[', attributesOf(m, L, t), "]}"
        );
    }

    function tokenURI(uint256 tokenId, uint64 seed, uint64 pins, uint8 one) external view returns (string memory) {
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json(tokenId, seed, pins, one))));
    }
}
