#!/usr/bin/env bash
# Deploys OneNFT alone against the renderer already recorded in ~/.config/onenft-faces/deploy-<net>.json.
# Usage: contracts/deploy-token.sh sepolia|mainnet. Keeps the old record as deploy-<net>.<timestamp>.json.
set -euo pipefail
NET="${1:?sepolia|mainnet}"
case "$NET" in
  sepolia) RPC=https://sepolia.base.org; CHAIN=84532;;
  mainnet) RPC=https://mainnet.base.org; CHAIN=8453;;
  *) echo "sepolia|mainnet"; exit 1;;
esac
cd "$(dirname "$0")"
D="$HOME/.config/onenft-faces/deploy-$NET.json"; [ -f "$D" ] || { echo "no $D"; exit 1; }
REN=$(jq -r .FaceRenderer "$D")
AUTHOR=$(jq -r .address "$HOME/.config/onenft/author.json")
PK=$(security find-generic-password -a onenft-deployer -s onenft-deployer -w)
DEPLOYER=$(cast wallet address --private-key "$PK")
BAL=$(cast balance "$DEPLOYER" --rpc-url "$RPC" --ether)
echo "network $NET  deployer $DEPLOYER  balance $BAL ETH  author $AUTHOR  renderer $REN"
LOG="/tmp/onenft-faces-deploy-token-$NET.log"
NFT=""
for try in 1 2 3; do
  NFT=$( (forge create src/OneNFT.sol:OneNFT --rpc-url "$RPC" --private-key "$PK" --broadcast --constructor-args "faces.onenft.click" "FACE" "$AUTHOR" "$DEPLOYER" "$REN" 2>&1 || true) | tee -a "$LOG" | grep -E "Deployed to" | awk '{print $3}' || true)
  [ -n "$NFT" ] && break; echo "token create failed (try $try), waiting"; sleep 8
done
unset PK
[ -n "$NFT" ] || { echo "token deploy failed, see $LOG"; exit 1; }
echo "OneNFT $NFT"
cp "$D" "$D.$(date -u +%Y%m%dT%H%M%SZ).json"
jq --arg nft "$NFT" --arg at "$(date -u +%FT%TZ)" '. + {OneNFT: $nft, at: $at, previous: (.previous // []) + [.OneNFT]} | del(.block)' "$D" > "$D.tmp" && mv "$D.tmp" "$D"
cat "$D"
