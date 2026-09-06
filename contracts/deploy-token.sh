#!/usr/bin/env bash
# Deploys OneNFT alone against the renderer already recorded in ~/.config/onenft-faces/deploy-<net>.json.
# Usage: contracts/deploy-token.sh sepolia|mainnet. Keeps the old record as deploy-<net>.<timestamp>.json.
set -euo pipefail
source "$(dirname "$0")/../scripts/operator-safe.sh"
NET="${1:?sepolia|mainnet}"
case "$NET" in
  sepolia) RPC=https://sepolia.base.org; CHAIN=84532;;
  mainnet) RPC=https://mainnet.base.org; CHAIN=8453;;
  *) echo "sepolia|mainnet"; exit 1;;
esac
cd "$(dirname "$0")"
D="$HOME/.config/onenft-faces/deploy-$NET.json"; [ -f "$D" ] || { echo "no $D"; exit 1; }
REN=$(operator_json_address "$D" FaceRenderer)
AUTHOR=$(operator_json_address "$HOME/.config/onenft/author.json" address)
operator_signer deployer
DEPLOYER=$(operator_address "$(cast wallet address "${SIGNER_ARGS[@]}")")
BAL=$(cast balance "$DEPLOYER" --rpc-url "$RPC" --ether)
echo "network $NET  deployer $DEPLOYER  balance $BAL ETH  author $AUTHOR  renderer $REN"
LOG="$OPERATOR_TMP_DIR/onenft-faces-deploy-token-$NET.log"
NFT=$(operator_create src/OneNFT.sol:OneNFT --constructor-args "faces.onenft.click" "FACE" "$AUTHOR" "$DEPLOYER" "$REN")
echo "OneNFT $NFT"
cp "$D" "$D.$(date -u +%Y%m%dT%H%M%SZ).json"
jq --arg nft "$NFT" --arg at "$(date -u +%FT%TZ)" '. + {OneNFT: $nft, at: $at, previous: (.previous // []) + [.OneNFT]} | del(.block)' "$D" | operator_write_json "$D"
cat "$D"
