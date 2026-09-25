// fires a bunch of buy orders at a local ledger and measures throughput and latency

// the ledger's buy route, running locally on 8080
const ENDPOINT = "http://localhost:8080/api/buy";

// every order buys this same repo on purpose, so every request fights for the same row
// lock, which is the thing we're putting under contention
const TICKER = "facebook/react";

// buys need a supabase access token, read from TRX_TOKEN
const TOKEN = process.env.TRX_TOKEN || "";

const TOTAL_ORDERS = 5000;

// how many orders are in flight at the same time, which is what actually tests the row
// locking. CONCURRENCY overrides it
const CONCURRENCY = Number(process.env.CONCURRENCY) || 100;

// the ledger rejects a buy more than 1% off its real price (the slippage check), so the
// real price gets read once at the start
let livePrice = 0;

// reads the current price off the public history route, no token needed
async function fetchLivePrice() {
  const [owner, repo] = TICKER.split("/");
  const res = await fetch(`http://localhost:8080/api/history/${owner}/${repo}`);
  const data = await res.json();
  return Number(data.asset.current_price);
}

// one order payload, with the three fields the buy handler reads off req.body
function makeOrder(i) {
  return {
    ticker: TICKER,
    shares: 1,                // the handler only takes whole shares
    expectedPrice: livePrice, // has to be within 1% of the real price
  };
}

// sends one order and returns whether it succeeded and how long it took in ms
async function sendOne(i) {
  const start = performance.now();
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
        // the ledger reads the client ip from this header and rate limits per ip, so one
        // machine would get throttled after 30 orders. each order gets its own made up
        // 10.x.x.x ip built from its index, like a fleet of separate clients, so the
        // concurrency actually reaches the row locks
        "X-Forwarded-For": `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`,
      },
      body: JSON.stringify(makeOrder(i)),
    });
    const ms = performance.now() - start;
    return { ok: res.ok, ms };
  } catch (err) {
    const ms = performance.now() - start; // still record the time on a network error
    return { ok: false, ms };
  }
}

// runs the whole test and prints the stats
async function run() {
  const latencies = [];
  let failures = 0;
  let nextIndex = 0;

  // without a token every order would just be a 401
  if (!TOKEN) {
    console.error("no TRX_TOKEN set, the engine will reject every order with a 401");
    return;
  }

  livePrice = await fetchLivePrice();
  console.log(`using live price ${livePrice} for ${TICKER}`);

  // each worker keeps claiming the next order index until there are none left
  async function worker() {
    while (nextIndex < TOTAL_ORDERS) {
      const i = nextIndex++;
      const result = await sendOne(i);
      latencies.push(result.ms);
      if (!result.ok) failures++;
    }
  }

  const wallStart = performance.now();

  // one worker per concurrent request
  const workers = [];
  for (let w = 0; w < CONCURRENCY; w++) {
    workers.push(worker());
  }

  await Promise.all(workers);

  const wallSeconds = (performance.now() - wallStart) / 1000;

  latencies.sort((a, b) => a - b);

  function percentile(p) {
    const idx = Math.floor((p / 100) * latencies.length);
    return latencies[Math.min(idx, latencies.length - 1)]; // clamp to the last entry
  }

  const sum = latencies.reduce((a, b) => a + b, 0);
  const avg = sum / latencies.length;

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

run();
