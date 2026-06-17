import { JsonStore } from "@/lib/storage/json-store";
import { PostgresStore } from "@/lib/storage/postgres-store";

type Store = JsonStore | PostgresStore;

let store: Store | null = null;

export function getStore(): Store {
  if (!store) {
    store = process.env.DATABASE_URL ? new PostgresStore(process.env.DATABASE_URL) : new JsonStore();
  }
  return store;
}
