#!/usr/bin/env bash
# One screen of state: chain, wallets, site. Read-only. Usage: scripts/status.sh [mainnet|sepolia]
set -euo pipefail
NET="${1:-mainnet}"
case "$NET" in
  mainnet) RPC=https://mainnet.base.org; SITE=https://faces.onenft.click;;
  sepolia) RPC=https://sepolia.base.org; SITE=https://faces-test.onenft.click;;
  *) echo "mainnet|sepolia"; exit 1;;
esac
D="$HOME/.config/onenft-faces/deploy-$NET.json"
NFT=$(jq -r .OneNFT "$D"); AUTHOR=$(jq -r .author "$D"); DEPLOYER=$(jq -r .deployer "$D")
left=$(cast call "$NFT" 'secondsLeft()(uint256)' --rpc-url "$RPC" | awk '{print $1}')
echo "network   $NET"
echo "contract  $NFT"
echo "rolled    $(cast call "$NFT" 'totalSupply()(uint256)' --rpc-url "$RPC") of 10000   pool $(cast call "$NFT" 'poolLeft()(uint256)' --rpc-url "$RPC")   ($((left/3600)) h $(((left%3600)/60)) min to midnight UTC)"
echo "renderer  $(cast call "$NFT" 'renderer()(address)' --rpc-url "$RPC")   locked=$(cast call "$NFT" 'rendererLocked()(bool)' --rpc-url "$RPC")"
echo "treasury  can roll today: $(cast call "$NFT" 'canRoll(address)(bool)' "$AUTHOR" --rpc-url "$RPC")"
echo "deployer  $DEPLOYER  $(cast balance "$DEPLOYER" --rpc-url "$RPC" --ether) ETH"
echo "author    $AUTHOR  $(cast balance "$AUTHOR" --rpc-url "$RPC" --ether) ETH"
echo "site      $(curl -s -m 8 "$SITE/health" | head -c 90)"
