#!/usr/bin/env bash
# Deploys the data stores, FaceRenderer and OneNFT. Usage: contracts/deploy.sh sepolia|mainnet
# Deployer uses the encrypted onenft-deployer Foundry keystore, author address from ~/.config/onenft/author.json.
set -euo pipefail
source "$(dirname "$0")/../scripts/operator-safe.sh"
NET="${1:?sepolia|mainnet}"
case "$NET" in
  sepolia) RPC=https://sepolia.base.org; CHAIN=84532;;
  mainnet) RPC=https://mainnet.base.org; CHAIN=8453;;
  *) echo "sepolia|mainnet"; exit 1;;
esac
cd "$(dirname "$0")"
(cd .. && bun run contracts/fixtures.ts)
AUTHOR=$(operator_json_address "$HOME/.config/onenft/author.json" address)
operator_signer deployer
DEPLOYER=$(operator_address "$(cast wallet address "${SIGNER_ARGS[@]}")")
BAL=$(cast balance "$DEPLOYER" --rpc-url "$RPC" --ether)
echo "network $NET  deployer $DEPLOYER  balance $BAL ETH  author $AUTHOR"
LOG="$OPERATOR_TMP_DIR/onenft-faces-deploy-$NET.log"
# Stores and meta through the script; renderer and token through forge create (see Deploy.s.sol for why).
forge script script/Deploy.s.sol --rpc-url "$RPC" --broadcast "${SIGNER_ARGS[@]}" 2>&1 | tee "$LOG"
get() { operator_log_address "$LOG" "$1"; }
N=$(jq -r '.stores | length' test/fixtures/faces_data.json)
SPRITES=$(jq .sprites test/fixtures/faces_data.json)
STORES=$(for i in $(seq 0 $((N-1))); do get "store$i" || exit 1; done | jq -R . | jq -s -c .)
META=$(get meta)
[ -n "$META" ] || { echo "no meta address in $LOG"; exit 1; }
ARR=$(echo "$STORES" | jq -r 'join(",")')
# The RPC can lag a few seconds behind the script's own receipts; the renderer constructor reads every store's code, so wait for it.
for a in $(echo "$STORES" | jq -r '.[]') "$META"; do
  for i in $(seq 1 30); do [ "$(cast code "$a" --rpc-url "$RPC")" != "0x" ] && break; sleep 2; done
done
REN=$(operator_create src/FaceRenderer.sol:FaceRenderer --constructor-args "[$ARR]" "$META" "$SPRITES")
echo "FaceRenderer $REN"
NFT=$(operator_create src/OneNFT.sol:OneNFT --constructor-args "faces.onenft.click" "FACE" "$AUTHOR" "$DEPLOYER" "$REN")
echo "OneNFT $NFT"
mkdir -p "$HOME/.config/onenft-faces"
jq -n --arg net "$NET" --argjson chain "$CHAIN" --arg nft "$NFT" --arg ren "$REN" --argjson stores "$STORES" --arg m "$META" \
  --arg author "$AUTHOR" --arg deployer "$DEPLOYER" --arg at "$(date -u +%FT%TZ)" --argjson sprites "$SPRITES" \
  '{network:$net,chainId:$chain,OneNFT:$nft,FaceRenderer:$ren,stores:$stores,meta:$m,sprites:$sprites,author:$author,deployer:$deployer,at:$at}' | operator_write_json "$HOME/.config/onenft-faces/deploy-$NET.json"
cat "$HOME/.config/onenft-faces/deploy-$NET.json"
