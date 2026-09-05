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
# No --verify here: forge cannot decode the address[] constructor argument for verification and then skips the broadcast. Verify by hand.
AUTHOR=$AUTHOR forge script script/Deploy.s.sol --rpc-url "$RPC" --broadcast --private-key "$PK" 2>&1 | tee "$LOG" | grep -E "store|meta|FaceRenderer|OneNFT|ONCHAIN|Error" || true
unset PK
get() { grep -E "^\s*$1 " "$LOG" | head -1 | awk '{print $2}'; }
N=$(jq -r '.stores | length' test/fixtures/faces_data.json)
STORES=$(for i in $(seq 0 $((N-1))); do get "store$i"; done | jq -R . | jq -s -c .)
mkdir -p "$HOME/.config/onenft-faces"
jq -n --arg net "$NET" --argjson chain "$CHAIN" --arg nft "$(get OneNFT)" --arg ren "$(get FaceRenderer)" --argjson stores "$STORES" --arg m "$(get meta)" \
  --arg author "$AUTHOR" --arg deployer "$DEPLOYER" --arg at "$(date -u +%FT%TZ)" --argjson sprites "$(jq .sprites test/fixtures/faces_data.json)" \
  '{network:$net,chainId:$chain,OneNFT:$nft,FaceRenderer:$ren,stores:$stores,meta:$m,sprites:$sprites,author:$author,deployer:$deployer,at:$at}' > "$HOME/.config/onenft-faces/deploy-$NET.json"
cat "$HOME/.config/onenft-faces/deploy-$NET.json"
