---
title: "Developer Endpoints & NIF Safety"
---

# Developer Endpoints & NIF Safety

Developing native Organelles for Karyon requires strict adherence to memory safety and BEAM scheduler sympathy.

## FFI Architecture

Karyon uses `Rustler` for FFI. The goal is to maximize performance without compromising the stability of the Erlang VM.

### Resource Objects

All persistent native state must be wrapped in `ResourceArc`.

- **Safety**: Resource Objects are trackable by the BEAM Garbage Collector.
- **Implementation**: See `app/rhizome/native/rhizome_nif/src/resource.rs`.

### Cache Alignment & NUMA

Native structs for the Rhizome must be cache-aligned to prevent false sharing and NUMA bus bottlenecks.

```rust
#[repr(C)]
#[repr(align(64))]
pub struct GraphPointer { ... }
```

## Scheduler Sympathy

### Dirty Schedulers

Any operation taking longer than 1ms (I/O, heavy math, graph traversals) MUST use a Dirty Scheduler.

- **DirtyIo**: For database calls (Memgraph, XTDB).
- **DirtyCpu**: For compute-heavy algorithms (Louvain, Tree-sitter parsing).

```elixir
#[rustler::nif(schedule = "DirtyIo")]
pub fn native_operation() { ... }
```

## Integrating New Organelles

To add a new native capability (e.g., a new Tree-sitter language):

1. **Cargo.toml**: Add the grammar dependency.
2. **lib.rs**: Export the language function in the `sensory_nif`.
3. **native.ex**: Update the Elixir bridge signature.
4. **Makefile**: Ensure the `build` target includes the new application directory.

## Known Constraints

- **Zero-Copy**: Favor sub-binary references for large code strings to avoid FFI serialization overhead.
- **Memory Leaks**: Always run `make test-native` under Valgrind after significant NIF changes.
