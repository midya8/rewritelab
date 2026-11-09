"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  { spawn, execFileSync } = require("node:child_process"),
  { waitForDebugger } = require("./chrome_support.cjs");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
test(
  "Chrome full weight box, ties, grid and membership selection",
  { timeout: 180000 },
  async () => {
    const server = require("node:http").createServer((req, res) => {
      try {
        const file = path.join(
          __dirname,
          "../docs",
          req.url === "/" ? "index.html" : req.url,
        );
        res.setHeader(
          "Content-Type",
          {
            ".html": "text/html",
            ".js": "application/javascript",
            ".css": "text/css",
            ".json": "application/json",
          }[path.extname(file)] || "text/plain",
        );
        res.end(fs.readFileSync(file));
      } catch (e) {
        res.statusCode = 404;
        res.end("not found");
      }
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "hingelab-")),
      browser = spawn(
        process.env.CHROME_BIN || "google-chrome",
        [
          "--headless",
          "--no-sandbox",
          "--disable-gpu",
          "--disable-extensions",
          "--disable-dev-shm-usage",
          "--remote-debugging-port=0",
          `--user-data-dir=${profile}`,
          "about:blank",
        ],
        { stdio: ["ignore", "ignore", "pipe"] },
      );
    let ws,
      startupError,
      diagnostics = "";
    browser.on("error", (e) => (startupError = e));
    browser.stderr.on(
      "data",
      (d) => (diagnostics = (diagnostics + d).slice(-4000)),
    );
    try {
      for (
        let i = 0;
        i < 1200 &&
        !startupError &&
        browser.exitCode === null &&
        !fs.existsSync(path.join(profile, "DevToolsActivePort"));
        i++
      )
        await delay(25);
      assert.ok(
        fs.existsSync(path.join(profile, "DevToolsActivePort")),
        startupError?.message || diagnostics || "Chrome unavailable",
      );
      const port = fs
          .readFileSync(path.join(profile, "DevToolsActivePort"), "utf8")
          .split("\n")[0],
        tab = await waitForDebugger(`http://127.0.0.1:${port}/json/list`, {
          alive: () => browser.exitCode === null && !startupError,
        });
      ws = new WebSocket(tab.webSocketDebuggerUrl);
      await new Promise((r, j) => {
        ws.onopen = r;
        ws.onerror = j;
      });
      let seq = 0;
      const pending = new Map();
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (pending.has(m.id)) {
          const { res, rej } = pending.get(m.id);
          pending.delete(m.id);
          m.error ? rej(Error(JSON.stringify(m.error))) : res(m.result);
        }
      };
      const call = (method, params = {}) =>
          new Promise((res, rej) => {
            const id = ++seq;
            pending.set(id, { res, rej });
            ws.send(JSON.stringify({ id, method, params }));
          }),
        js = async (expression) => {
          const r = await call("Runtime.evaluate", {
            expression,
            returnByValue: true,
            awaitPromise: true,
          });
          if (r.exceptionDetails)
            throw Error(JSON.stringify(r.exceptionDetails));
          return r.result.value;
        };

      await call("Page.enable");
      await call("Page.navigate", {
        url:
          process.env.REWRITELAB_WEIGHTS_URL ||
          `http://127.0.0.1:${server.address().port}/weights.html`,
      });
      for (let i = 0; i < 1000; i++) {
        if (await js("Boolean(window.weightReport)")) break;
        await delay(20);
      }
      assert.ok(await js("window.weightReport"));
      const controls = JSON.parse(
          fs.readFileSync(
            path.join(__dirname, "../docs/weights-controls.json"),
          ),
        ),
        inputs = controls.map((c) => c.input),
        native = JSON.parse(
          execFileSync(
            process.env.PYTHON || "python",
            [
              "-c",
              "import json,sys;from rewritelab import weights;print(json.dumps([weights(r) for r in json.load(sys.stdin)]))",
            ],
            { input: JSON.stringify(inputs), maxBuffer: 128 << 20 },
          ),
        ),
        reports = [];
      const set = (id, value, event = "change") =>
        js(
          `document.getElementById(${JSON.stringify(id)}).value=${JSON.stringify(String(value))};document.getElementById(${JSON.stringify(id)}).dispatchEvent(new Event(${JSON.stringify(event)}))`,
        );
      async function shot(name) {
        if (!process.env.REWRITELAB_WEIGHTS_SCREEN_DIR) return;
        await delay(150);
        await js(
          "document.activeElement.blur();window.scrollTo(0,0);new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))",
        );
        const m = await call("Page.getLayoutMetrics"),
          im = await call("Page.captureScreenshot", {
            format: "png",
            captureBeyondViewport: true,
            clip: {
              x: 0,
              y: 0,
              width: m.cssContentSize.width,
              height: m.cssContentSize.height,
              scale: 1,
            },
          });
        fs.writeFileSync(
          path.join(process.env.REWRITELAB_WEIGHTS_SCREEN_DIR, name + ".png"),
          Buffer.from(im.data, "base64"),
        );
        fs.writeFileSync(
          path.join(
            process.env.REWRITELAB_WEIGHTS_SCREEN_DIR,
            name + ".layout.json",
          ),
          JSON.stringify(
            await js(
              "Object.fromEntries(['output','detail','grid','groups','limits'].map(id=>[id,document.getElementById(id).getBoundingClientRect().top+scrollY]))",
            ),
          ),
        );
      }
      let selections = 0,
        memberships = 0;
      for (const width of [320, 390, 1280]) {
        await call("Emulation.setDeviceMetricsOverride", {
          width,
          height: 1200,
          deviceScaleFactor: 1,
          mobile: width < 700,
        });
        for (let k = 0; k < controls.length; k++) {
          await set("control", k);
          const r = await js("window.weightReport");
          assert.deepEqual(r, native[k]);
          reports.push(r);
          assert.equal(
            await js("document.documentElement.scrollWidth>innerWidth"),
            false,
          );
          if (width === 390) {
            const x = await js(
              `(()=>{const r=window.weightReport;let n=0,memberships=0;const opts=id=>[...document.getElementById(id).options].map(o=>o.value);for(let l=1;l<=8;l++){const leaf=document.getElementById('leaf');leaf.value=l;leaf.dispatchEvent(new Event('input'));for(let m=1;m<=8;m++)for(let a=1;a<=8;a++){document.querySelector('#grid button[data-add="'+a+'"][data-multiply="'+m+'"]').click();const o=r.outcomes.find(o=>o.costs.add===a&&o.costs.multiply===m&&o.costs.leaf===l);if(JSON.stringify(window.weightSelected)!==JSON.stringify(o))throw Error('selection mismatch');for(const kind of ['reachable','semantic']){const expected=o[kind+'_groups'].flatMap(i=>r.groups[i][kind==='reachable'?'reachable_terms':'terms']).sort();if(JSON.stringify(opts(kind))!==JSON.stringify(expected))throw Error('ties mismatch');const el=document.getElementById(kind);for(const name of expected){el.value=name;if(el.value!==name)throw Error('tie selection');memberships++}}if(document.querySelectorAll('#grid button').length!==64||document.querySelectorAll('#grid button[aria-pressed="true"]').length!==1)throw Error('grid mismatch');n++}}for(const g of r.groups){const group=document.querySelector('#groups article[data-group="'+g.id+'"]');for(const kind of ['terms','reachable_terms']){const el=group.querySelector('select[data-members="'+kind+'"]');if(g[kind].length){if(JSON.stringify([...el.options].map(o=>o.value))!==JSON.stringify(g[kind]))throw Error('group membership mismatch');for(const name of g[kind]){el.value=name;if(el.value!==name)throw Error('group member selection');memberships++}}else if(!el.disabled)throw Error('empty subset')}}return{n,memberships}})()`,
            );
            selections += x.n;
            memberships += x.memberships;
            await set("control", k);
          }
          await shot(`control-${k}-${width}`);
        }
      }
      await set("control", 0);
      await set("add", 2, "input");
      await set("multiply", 2, "input");
      await set("leaf", 1, "input");
      assert.equal(
        (await js("window.weightSelected")).semantic_groups.length,
        2,
      );
      await shot("state-tie");
      await set("multiply", 8, "input");
      assert.equal((await js("window.weightSelected")).gap, 6);
      await shot("state-gap");
      await js(
        "window.downloadBody=null;window.downloadName=null;URL.createObjectURL=b=>{window.downloadBody=b.text();return'blob:test'};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){window.downloadName=this.download};document.getElementById('download').click()",
      );
      assert.equal(
        await js("window.downloadName"),
        "rewritelab-weights-evidence.json",
      );
      const exported = JSON.parse(await js("window.downloadBody"));
      assert.deepEqual(exported.request.costs, {
        add: 2,
        multiply: 8,
        leaf: 1,
      });
      reports.push(exported);
      await set("add", 0, "input");
      assert.equal(await js("window.weightSelected"), null);
      assert.equal(await js("document.getElementById('output').hidden"), true);
      assert.equal(
        await js("document.getElementById('download').disabled"),
        true,
      );
      await set("add", 2, "input");
      assert.ok(await js("window.weightSelected"));
      await set("expression", "x+y", "input");
      assert.equal(await js("window.weightReport"), null);
      assert.equal(await js("window.weightSelected"), null);
      await js("document.getElementById('run').click()");
      assert.ok(await js("document.getElementById('error').textContent"));
      await set("control", 4);
      await set("budget", 3);
      assert.equal(await js("window.weightReport"), null);
      execFileSync(
        process.env.PYTHON || "python",
        [
          "-c",
          "import json,sys;from rewritelab import verify_weights;assert all(verify_weights(r) for r in json.load(sys.stdin))",
        ],
        { input: JSON.stringify(reports), maxBuffer: 128 << 20 },
      );
      console.log(
        JSON.stringify({
          browserWeightReports: reports.length,
          outcomeSelections: selections,
          expressionSelections: memberships,
        }),
      );
    } finally {
      if (ws) ws.close();
      if (browser.exitCode === null) {
        const stopped = new Promise((r) => browser.once("exit", r));
        browser.kill("SIGTERM");
        await stopped;
      }
      await new Promise((r) => server.close(r));
      await fs.promises.rm(profile, {
        recursive: true,
        force: true,
        maxRetries: 20,
        retryDelay: 100,
      });
    }
  },
);
