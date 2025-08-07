import {
  db,
  app,
  info,
  onFinalizeTransaction,
  type DBHandle,
  type ExpressContext,
  type ServerContext,
} from "./lib/utils.ts";
function main(): void {
  const dbHandle: DBHandle = db();
  app()
    .then((api) => {
      const server: ServerContext = api
        .listen(443, "127.0.0.1")
        .once("close", () => {
          for (const closer of [dbHandle, server]) closer.close();
        });
      return Promise.resolve<{
        api: ExpressContext;
        server: ServerContext;
      }>({
        api: api,
        server: server,
      });
    })
    .then(({ api, server }) => {
      api
        .post<
          "/task.new",
          {},
          {},
          {
            name: string;
            priority: number;
          }
        >("/task.new", function (peer, connection): void {
          //peer.once("readable", () => {
          const { name, priority } = peer.body;
          dbHandle
            .prepare("INSERT INTO main.task (name, priority) VALUES (?, ?)")
            .bind(name, priority)
            .run()
            .finalize()
            .once("change", () => connection.sendStatus(201));
          //});
        })
        .get<
          "/task.get",
          {},
          {
            name: string;
            priority: number;
          }
        >("/task.get", function (peer, connection): void {
          peer.once("readable", () => {
            dbHandle
              .prepare(
                "SELECT main.task.name, main.task.priority FROM main.task WHERE main.task.id = ?",
              )
              .bind(peer.query.id || 1)
              .get<{ name: string; priority: number }>((error, record) => {
                if (error) connection.sendStatus(404);
                else connection.status(200).json(record);
              })
              .finalize();
          });
        })
        .put<
          "/task.set",
          {},
          {},
          {
            name: string;
            priority: number;
          }
        >("/task.set", function (peer, connection): void {
          //peer.once("readable", () => {
          dbHandle
            .prepare("UPDATE main.task SET name = ?, priority = ? WHERE id = ?")
            .bind(peer.body.name, peer.body.priority, peer.query.id || 1)
            .run()
            .finalize((error) => onFinalizeTransaction(error, connection, 204));
          //});
        })
        .delete<"/task.delete", {}, { message: string } | null>(
          "/task.delete",
          function (peer, connection): void {
            peer.once("readable", () => {
              dbHandle
                .prepare("DELETE FROM main.task WHERE id = ?")
                .bind(peer.query.id || 1)
                .run()
                .finalize((error) =>
                  onFinalizeTransaction(error, connection, 204),
                );
            });
          },
        )
        .get("/server.close", function (peer, connection): void {
          peer.once("readable", () => {
            connection.sendStatus(204);
            server.emit("close");
          });
        });
      throw undefined;
    })
    .catch(() => info("end"));
}
main();
