import EventEmmiter from "node:events";

class AsyncQueue {
  #working = false;
  #events = new EventEmmiter();
  #queue = [];

  constructor() {
    this.#events.on("enqued", () => {
      console.log("enqued, curr len = ", this.#queue.length);
      if (this.#working || this.#queue.length === 0) {
        return;
      }
      this.#work();
    });
  }

  enqueue(pf) {
    return new Promise((rs, rj) => {
      this.#events.on("doneTask", (res) => {
        if (res.pf !== pf) {
          return;
        }
        if ("p" in res) {
          rs(res.p);
        } else {
          rj(res.e);
        }
      });
      this.#queue.push(pf);
      this.#events.emit("enqued");
    });
  }

  async #work() {
    this.#working = true;
    console.log("worker started");
    for (
      let chunk = this.#queue.splice(0, this.#queue.length);
      chunk.length > 0;
      chunk = this.#queue.splice(0, this.#queue.length)
    ) {
      console.log("processing chunk with len = ", chunk.length);
      for (let pf of chunk) {
        try {
          let p = await pf();
          this.#events.emit("doneTask", { pf, p });
        } catch (e) {
          this.#events.emit("doneTask", { pf, e });
        }
      }
    }
    this.#working = false;
    console.log("worker stopped");
  }
}

async function searchWord(s) {
  let url = new URL("https://words.qxuken.dev/api/search");
  if (s) {
    url.searchParams.set("s", s);
  }
  console.log(`Firing for ${s}`);
  if (s === "throw") {
    console.log(`Thrown ${s}`);
    throw new Error("Made to throw");
  }
  let r = await fetch(url.toString());
  console.log(`Done ${s}`);
  return await r.json();
}

const FIRST_REQUESTS = ["word", "wrong", "hello", "throw", "love"];
const SECOND_REQUESTS = ["rust", "go", "script"];

let queue = new AsyncQueue();

console.log(new Date());
setTimeout(() => {}, 1000);

Promise.allSettled(
  FIRST_REQUESTS.map((s, index) =>
    queue
      .enqueue(() =>
        searchWord(s).then((r) => {
          console.log(`Processed ${s}`);
          return r.length;
        }),
      )
      .then((d) => {
        if (index === 1) {
          Promise.allSettled(
            SECOND_REQUESTS.map((s) =>
              queue.enqueue(() =>
                searchWord(s).then((r) => {
                  console.log(`Processed ${s}`);
                  return r.length;
                }),
              ),
            ),
          ).then(console.log);
        }
        return d;
      }),
  ),
).then(console.log);
