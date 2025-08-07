import sqlite3 from "@appthreat/sqlite3";
import express from "express";
import http from "http";
interface DBContext {
  open: {
    path: string;
    statement: string;
    mode: number;
    listener: () => void;
  };
  close: {
    listener: () => void;
  };
  error: {
    listener: (error: Error) => void;
  };
}
export type DBHandle = sqlite3.Database;
function DBInit({ open, close, error }: DBContext): sqlite3.Database {
  const db: sqlite3.Database = sqlite3.cached.Database(open.path, open.mode);
  [
    { event: "open", listener: open.listener },
    { event: "close", listener: close.listener },
  ].forEach(function ({ event, listener }) {
    db.once(event, listener);
  });
  return db
    .on("error", error.listener)
    .prepare(open.statement)
    .run()
    .finalize();
}
export const { info, debug, warn, error } = console;
export const db: () => sqlite3.Database = () =>
  DBInit({
    open: {
      path: "db.sqlite",
      statement:
        "CREATE TABLE IF NOT EXISTS main.task (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL DEFAULT '', priority INTEGER NOT NULL CHECK(priority >= 0) DEFAULT 0)",
      mode:
        sqlite3.OPEN_CREATE | sqlite3.OPEN_READWRITE | sqlite3.OPEN_FULLMUTEX,
      listener: function (): void {
        info("opened");
      },
    },
    close: {
      listener: function (): void {
        info("close");
      },
    },
    error: {
      listener: function (error: Error): void {
        warn(error);
      },
    },
  });
export type ExpressContext = express.Express;
export async function app(): Promise<ExpressContext> {
  return await new Promise<void>((resolve) => resolve()).then(() => {
    return Promise.resolve<ExpressContext>(express().use(express.json()));
  });
}
export type ServerContext = http.Server;
export type RequestContext = express.Request;
export type ResponseContext = express.Response;
export interface Closer {
  close(): void;
}
export function onFinalizeTransaction(
  error: Error,
  connection: ResponseContext,
  successCode: number,
): void {
  if (error) connection.sendStatus(404);
  else connection.sendStatus(successCode);
}
