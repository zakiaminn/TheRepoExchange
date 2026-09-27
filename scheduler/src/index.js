// starts trx's hourly jobs on time. github actions' own cron ran hours late, so cloudflare
// keeps the schedule and this starts the workflows through github's api and pings the ledger

export default {
    async scheduled(controller, env) {
        switch (controller.cron) {
            case "0 * * * *":
                return dispatch(env, "ingestion.yml");
            case "30 * * * *":
                return dispatch(env, "settle-calls.yml");
            case "*/10 * * * *":
                return ping(env);
            default:
                throw new Error(`No job for cron ${controller.cron}`);
        }
    },
};

// starts a workflow on main. github answers 204 when the run is queued
async function dispatch(env, workflow) {
    const url = `https://api.github.com/repos/${env.REPO}/actions/workflows/${workflow}/dispatches`;
    const init = {
        method: "POST",
        headers: {
            Authorization: `Bearer ${env.GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "trx-scheduler",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main" }),
    };

    // server errors and dropped connections get two more tries, 10s then 20s apart.
    // anything else (a bad token, a renamed workflow) fails straight away
    for (let attempt = 1; ; attempt++) {
        let res;
        try {
            res = await fetch(url, init);
        } catch (err) {
            if (attempt === 3) throw err;
        }
        if (res?.ok) return;
        if (res && (res.status < 500 || attempt === 3)) {
            throw new Error(`Starting ${workflow} failed: ${res.status} ${await res.text()}`);
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 10_000));
    }
}

// a request to the health check, so the ledger's host doesn't put it to sleep
async function ping(env) {
    const res = await fetch(`${env.LEDGER_URL}/`, { signal: AbortSignal.timeout(90_000) });
    if (!res.ok) throw new Error(`Ledger health check returned ${res.status}`);
}
