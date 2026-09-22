# Kernel V3.3 Evidence

This file records the external dependency boundary for the EIP-7702 delegation implementation. It is not a substitute for the release-time chain certification.

## Upstream source

- Repository: <https://github.com/zerodevapp/kernel>
- Tag: `v3.3`
- Resolved tag commit: `cd697c7e21715d015e0643af22310a99aa17433b`
- Address source: upstream `README.md` `v3.3` Addresses table
- Execution source: upstream `src/Kernel.sol`, `execute(ExecMode,bytes)`
- Production implementation address: `0xd6CEDDe84be40893d153Be9d467CD6aD37875b28`

The tag commit and upstream source are the authority for the Kernel implementation and ABI. The six runtime codehashes in `docs/architecture.md` are dated local observations and must be re-read from each target chain before write operations are enabled.

## Release-time verification

For each configured chain, the release Agent must run the following with that chain's production RPC and record the output in the ABI/deployment manifest:

```bash
cast chain-id --rpc-url "$RPC_URL"
cast code "$KERNEL_ADDRESS" --rpc-url "$RPC_URL"
cast codehash "$KERNEL_ADDRESS" --rpc-url "$RPC_URL"
```

The result must match the chain-specific `kernel7702Implementation`, `kernel7702Codehash`, and `chainId` in the manifest. A missing RPC result, mismatched address, mismatched codehash, or missing Type-4 simulation keeps that chain read-only.
