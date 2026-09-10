/* Code Created by: Zaki Amin Ahmad
* 2026-09-06
* loadtest.js
* Fires a bunch of orders at the TRX order engine and measures throughput and latency
*/

// this is the url of the order engine route that actually creates a trade
// the ledger service listens on 8080 when you run it locally, and a new buy
// order is a POST to /api/buy, there is no /api/orders route, that was a guess
const ENDPOINT = "http://localhost:8080/api/buy";

// the listing we keep buying over and over for the whole test
// every order hits this same repo on purpose, so every request fights for the
// same row lock, which is the whole thing we are trying to put under contention
const TICKER = "facebook/react";

// the engine checks a supabase login token on every trade before it does anything
// so we have to send one, put a valid token in this env var before you run
// like this: TRX_TOKEN="the-token" node loadtest.js
const TOKEN = process.env.TRX_TOKEN || "";

// total number of orders we want to send during the whole test
const TOTAL_ORDERS = 5000;

// how many orders we allow to be in flight at the same time
// this is the setting that actually tests the row level locking
// you can override it without editing the file, like CONCURRENCY=200 node loadtest.js
const CONCURRENCY = Number(process.env.CONCURRENCY) || 100;

// the real price of the ticker right now, we fill this in once at the start
// the engine rejects a buy if our price is more than 1% off its real price
// (that is the slippage check in the buy handler), so we read the real one first
let livePrice = 0;

// asks the engine what the price is right now so our expectedPrice will pass
// this route is a public read, it does not need the login token
async function fetchLivePrice() {
  const [owner, repo] = TICKER.split("/");                                     // the history route wants owner and repo split apart
  const res = await fetch(`http://localhost:8080/api/history/${owner}/${repo}`); // hit the public price history endpoint
  const data = await res.json();                                              // pull the json body out of the response
  return Number(data.asset.current_price);                                    // the asset block carries the current price
}

// this builds one order payload for a given index
// these are the exact three fields the buy handler reads off req.body, nothing else
function makeOrder(i) {
  return {
    ticker: TICKER,           // which listing we are buying
    shares: 1,                // one whole share per order, the handler needs an integer
    expectedPrice: livePrice, // the price we think it is, has to be within 1% of the real one
  };
}

// sends one order and returns how long it took in milliseconds
// also tells us if it succeeded so we can count failures
async function sendOne(i) {
  const start = performance.now(); // grab the time right before the request
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",                                    // orders are created with a POST
      headers: {
        "Content-Type": "application/json",              // tell the server we are sending json
        Authorization: `Bearer ${TOKEN}`,               // the login token the engine checks on every trade
        // the engine sits behind a proxy so it reads the client ip from this header, and
        // its rate limiter counts requests per ip. one machine sending everything would
        // share a single ip and get throttled after 30, so we hand each order its own
        // made up ip to look like a fleet of separate clients, which is what a real load
        // test would be. this is what lets the concurrency actually stress the row locks.
        "X-Forwarded-For": `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`, // a unique 10.x.x.x ip built from the order index
      },
      body: JSON.stringify(makeOrder(i)),                // turn our order object into a json string
    });
    const ms = performance.now() - start; // time taken is now minus start
    return { ok: res.ok, ms };            // res.ok is true for a 2xx status
  } catch (err) {
    const ms = performance.now() - start; // still record the time even on a crash
    return { ok: false, ms };             // mark it as failed
  }
}

// runs the whole test
async function run() {
  const latencies = []; // we store every request time here so we can do stats later
  let failures = 0;     // running count of orders that did not succeed
  let nextIndex = 0;    // the index of the next order that still needs to be sent

  // bail out early if there is no token, since every single order would just be a 401
  if (!TOKEN) {
    console.error("no TRX_TOKEN set, the engine will reject every order with a 401");
    return;
  }

  // read the real price once up front and stash it so every order clears slippage
  livePrice = await fetchLivePrice();
  console.log(`using live price ${livePrice} for ${TICKER}`);

  // this is one worker, it keeps grabbing the next order until there are none left
  async function worker() {
    while (nextIndex < TOTAL_ORDERS) {
      const i = nextIndex++;        // claim an order index and move the counter forward
      const result = await sendOne(i); // actually send that order and wait for it
      latencies.push(result.ms);    // save how long it took
      if (!result.ok) failures++;   // bump the failure count if it did not succeed
    }
  }

  const wallStart = performance.now(); // start the clock for the full run

  // make an array of workers, one per allowed concurrent request
  const workers = [];
  for (let w = 0; w < CONCURRENCY; w++) {
    workers.push(worker()); // start a worker, it runs on its own
  }

  // wait for every worker to finish draining the queue
  await Promise.all(workers);

  const wallSeconds = (performance.now() - wallStart) / 1000; // total time in seconds

  // sort the latencies so we can pull out percentiles
  latencies.sort((a, b) => a - b);

  // helper that grabs the value at a given percentile
  function percentile(p) {
    const idx = Math.floor((p / 100) * latencies.length); // find the position in the sorted list
    return latencies[Math.min(idx, latencies.length - 1)]; // clamp so we never go out of bounds
  }

  // add up all the latencies so we can get an average
  const sum = latencies.reduce((a, b) => a + b, 0);
  const avg = sum / latencies.length; // average latency in ms

  // print the results in a clean block
  console.log("\n--- TRX order engine load test ---");
  console.log(`total orders sent:   ${TOTAL_ORDERS}`);
  console.log(`concurrency:         ${CONCURRENCY}`);
  console.log(`failures:            ${failures}`);
  console.log(`total time:          ${wallSeconds.toFixed(2)} s`);
  console.log(`throughput:          ${(TOTAL_ORDERS / wallSeconds).toFixed(0)} orders/sec`);
  console.log(`avg latency:         ${avg.toFixed(1)} ms`);
  console.log(`p50 latency:         ${percentile(50).toFixed(1)} ms`);
  console.log(`p95 latency:         ${percentile(95).toFixed(1)} ms`);
  console.log(`p99 latency:         ${percentile(99).toFixed(1)} ms`);
  console.log("----------------------------------\n");
}

// kick the whole thing off
run();
