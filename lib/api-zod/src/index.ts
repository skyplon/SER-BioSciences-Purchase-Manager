export * from "./generated/api";
// Note: `./generated/types` is NOT re-exported here because orval emits
// TypeScript interfaces with the same names as the zod schemas in `api.ts`,
// which causes ambient export conflicts. Consumers who need TS types should
// use `z.infer<typeof Schema>` instead.
