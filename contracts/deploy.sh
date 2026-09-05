#!/usr/bin/env bash
# Deploys the data stores, FaceRenderer and OneNFT. Usage: contracts/deploy.sh sepolia|mainnet
# Deployer secret from Keychain (onenft-deployer), author address from ~/.config/onenft/author.json.
set -euo pipefail
NET="${1:?sepolia|mainnet}"
case "$NET" in
  sepolia) RPC=https://sepolia.base.org; CHAIN=84532;;
  mainnet) RPC=https://mainnet.base.org; CHAIN=8453;;
  *) echo "sepolia|mainnet"; exit 1;;
esac
cd "$(dirname "$0")"
(cd .. && bun run contracts/fixtures.ts)
AUTHOR=$(jq -r .address "$HOME/.config/onenft/author.json")
PK=$(security find-generic-password -a onenft-deployer -s onenft-deployer -w)
DEPLOYER=$(cast wallet address --private-key "$PK")
BAL=$(cast balance "$DEPLOYER" --rpc-url "$RPC" --ether)
echo "network $NET  deployer $DEPLOYER  balance $BAL ETH  author $AUTHOR"
LOG="/tmp/onenft-faces-deploy-$NET.log"
# Stores and meta through the script; renderer and token through forge create (see Deploy.s.sol for why).
forge script script/Deploy.s.sol --rpc-url "$RPC" --broadcast --private-key "$PK" 2>&1 | tee "$LOG" | grep -E "store|meta|Error" || true
get() { grep -E "^\s*$1 " "$LOG" | head -1 | awk '{print $2}'; }
N=$(jq -r '.stores | length' test/fixtures/faces_data.json)
SPRITES=$(jq .sprites test/fixtures/faces_data.json)
STORES=$(for i in $(seq 0 $((N-1))); do get "store$i"; done | jq -R . | jq -s -c .)
META=$(get meta)
[ -n "$META" ] || { echo "no meta address in $LOG"; exit 1; }
ARR=$(echo "$STORES" | jq -r 'join(",")')
# The RPC can lag a few seconds behind the script's own receipts; the renderer constructor reads every store's code, so wait for it.
for a in $(echo "$STORES" | jq -r '.[]') "$META"; do
  for i in $(seq 1 30); do [ "$(cast code "$a" --rpc-url "$RPC")" != "0x" ] && break; sleep 2; done
done
REN=""
for try in 1 2 3 4; do
  REN=$(forge create src/FaceRenderer.sol:FaceRenderer --rpc-url "$RPC" --private-key "$PK" --broadcast --constructor-args "[$ARR]" "$META" "$SPRITES" 2>&1 | tee -a "$LOG" | grep -E "Deployed to" | awk '{print $3}')
  [ -n "$REN" ] && break; echo "renderer create failed (try $try), waiting"; sleep 8
done
[ -n "$REN" ] || { echo "renderer deploy failed, see $LOG"; exit 1; }
echo "FaceRenderer $REN"
NFT=$(forge create src/OneNFT.sol:OneNFT --rpc-url "$RPC" --private-key "$PK" --broadcast --constructor-args "faces.onenft.click" "FACE" "$AUTHOR" "$REN" 2>&1 | tee -a "$LOG" | grep -E "Deployed to" | awk '{print $3}')
[ -n "$NFT" ] || { echo "token deploy failed, see $LOG"; exit 1; }
echo "OneNFT $NFT"
unset PK
mkdir -p "$HOME/.config/onenft-faces"
jq -n --arg net "$NET" --argjson chain "$CHAIN" --arg nft "$NFT" --arg ren "$REN" --argjson stores "$STORES" --arg m "$META" \
  --arg author "$AUTHOR" --arg deployer "$DEPLOYER" --arg at "$(date -u +%FT%TZ)" --argjson sprites "$SPRITES" \
  '{network:$net,chainId:$chain,OneNFT:$nft,FaceRenderer:$ren,stores:$stores,meta:$m,sprites:$sprites,author:$author,deployer:$deployer,at:$at}' > "$HOME/.config/onenft-faces/deploy-$NET.json"
cat "$HOME/.config/onenft-faces/deploy-$NET.json"
