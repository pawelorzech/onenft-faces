#!/usr/bin/env bash
# Post-deploy check. Usage: contracts/check.sh sepolia|mainnet
# Compares every data store's code and the meta with the fixture blobs byte for
# byte, and the renderer's svg() for three seeds with the TypeScript output.
set -euo pipefail
NET="${1:?sepolia|mainnet}"
case "$NET" in sepolia) RPC=https://sepolia.base.org;; mainnet) RPC=https://mainnet.base.org;; *) exit 1;; esac
cd "$(dirname "$0")/.."
D="$HOME/.config/onenft-faces/deploy-$NET.json"; F=contracts/test/fixtures/faces_data.json; ok=1
N=$(jq -r '.stores | length' $F)
for i in $(seq 0 $((N-1))); do
  want="0x00$(jq -r ".stores[$i]" $F | cut -c3-)"; got=$(cast code "$(jq -r ".stores[$i]" "$D")" --rpc-url "$RPC")
  if [ "$want" = "$got" ]; then echo "store$i: on-chain bytes == fixture"; else echo "store$i: MISMATCH"; ok=0; fi
done
want="0x00$(jq -r ".meta" $F | cut -c3-)"; got=$(cast code "$(jq -r ".meta" "$D")" --rpc-url "$RPC")
if [ "$want" = "$got" ]; then echo "meta: on-chain bytes == fixture"; else echo "meta: MISMATCH"; ok=0; fi
R=$(jq -r .FaceRenderer "$D")
for seed in 1 77 17; do
  cast call "$R" "svg(uint64,uint128,uint8)(string)" "$seed" 340282366920938463463374607431768211455 255 --rpc-url "$RPC" > /tmp/check-face.svg
  if bun -e 'import { face } from "./src/faces.ts"; let s=(await Bun.file("/tmp/check-face.svg").text()).trim(); if(s.startsWith("\"")) s=JSON.parse(s); process.exit(s===face(BigInt(process.argv[1])).svg?0:1)' "$seed"; then echo "seed $seed: svg == TypeScript"; else echo "seed $seed: MISMATCH"; ok=0; fi
done
[ $ok = 1 ] && echo "all good" || { echo "PROBLEM"; exit 1; }
