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
  "Chrome full budget filtration candidates, obstructions, proofs and exports",
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
          process.env.REWRITELAB_BARRIERS_URL ||
          `http://127.0.0.1:${server.address().port}/barriers.html`,
      });
      for (let i = 0; i < 1000; i++) {
        if (await js("Boolean(window.barrierReport)")) break;
        await delay(20);
      }
      assert.ok(await js("window.barrierReport"));
      const controls = JSON.parse(
          fs.readFileSync(
            path.join(__dirname, "../docs/barriers-controls.json"),
          ),
        ),
        inputs = controls.map((c) => c.input),
        native = JSON.parse(
          execFileSync(
            process.env.PYTHON || "python",
            [
              "-c",
              "import json,sys;from rewritelab import atlas;print(json.dumps([atlas(r) for r in json.load(sys.stdin)]))",
            ],
            { input: JSON.stringify(inputs), maxBuffer: 128 << 20 },
          ),
        ),
        reports = [];
      const set = (id, value, event = "change") =>
        js(
          `document.getElementById(${JSON.stringify(id)}).value=${JSON.stringify(String(value))};document.getElementById(${JSON.stringify(id)}).dispatchEvent(new Event(${JSON.stringify(event)}))`,
        );
      let selections = 0,
        statuses = new Set();
      async function shot(name) {
        if (!process.env.REWRITELAB_BARRIERS_SCREEN_DIR) return;
        await delay(200);
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
          path.join(process.env.REWRITELAB_BARRIERS_SCREEN_DIR, name + ".png"),
          Buffer.from(im.data, "base64"),
        );
        fs.writeFileSync(
          path.join(
            process.env.REWRITELAB_BARRIERS_SCREEN_DIR,
            name + ".layout.json",
          ),
          JSON.stringify(
            await js(
              "Object.fromEntries(['output','frontier','detail','levels','proof','limits'].map(id=>[id,document.getElementById(id).getBoundingClientRect().top+scrollY]))",
            ),
          ),
        );
      }
      for (const width of [320, 390, 1280]) {
        await call("Emulation.setDeviceMetricsOverride", {
          width,
          height: 1200,
          deviceScaleFactor: 1,
          mobile: width < 700,
        });
        for (let k = 0; k < controls.length; k++) {
          await set("control", k);
          const r = await js("window.barrierReport");
          assert.deepEqual(r, native[k]);
          reports.push(r);
          assert.equal(
            await js("document.documentElement.scrollWidth>innerWidth"),
            false,
          );
          assert.equal(
            await js("document.getElementById('candidate').options.length"),
            r.candidates.length,
          );
          if (width === 390) {
            const result = await js(
              `(()=>{const r=window.barrierReport;let n=0;const statuses=new Set();for(const c of r.candidates){const el=document.getElementById('candidate');el.value=c.expression;el.dispatchEvent(new Event('change'));if(window.barrierSelected!==c.expression)throw Error('wrong selection');const dom=[...document.querySelectorAll('#levels article')];if(dom.length!==r.levels.length)throw Error('missing levels');r.levels.forEach((l,i)=>{const s=!l.report?'source-too-large':c.nodes>l.budget?'target-too-large':!l.report.states.some(s=>s.expression===c.expression)?'blocked':l.budget===c.first_reachable_budget?'first-reachable':'already-reachable';if(dom[i].dataset.status!==s)throw Error('wrong level status');statuses.add(s)});if(c.first_reachable_budget===null){if(window.barrierProof!==null||document.querySelectorAll('#proof article').length!==0)throw Error('false proof')}else{const l=r.levels.find(l=>l.budget===c.first_reachable_budget),by=new Map(l.report.states.map(s=>[s.expression,s])),chain=[];let row=by.get(c.expression);while(row){chain.push(row);row=row.parent===null?null:by.get(row.parent)}chain.reverse();if(JSON.stringify(chain)!==JSON.stringify(window.barrierProof)||document.querySelectorAll('#proof article').length!==c.steps+1)throw Error('wrong shortest witness')}n++}return{n,statuses:[...statuses]}})()`,
            );
            selections += result.n;
            result.statuses.forEach((s) => statuses.add(s));
            await set("control", k);
          }
          await shot(`control-${k}-${width}`);
        }
      }
      for (const [control, name, candidate] of [
        [0, "bridge", "(x+x)"],
        [6, "blocked", "(((1+1)+1)+1)"],
        [7, "leaf", "x"],
        [7, "target-too-large", "((x+0)+0)"],
      ]) {
        await set("control", control);
        await set("candidate", candidate);
        assert.equal(await js("window.barrierSelected"), candidate);
        await shot("state-" + name);
      }
      await js(
        "window.downloadBody=null;window.downloadName=null;URL.createObjectURL=b=>{window.downloadBody=b.text();return'blob:test'};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){window.downloadName=this.download};document.getElementById('download').click()",
      );
      assert.equal(
        await js("window.downloadName"),
        "rewritelab-barriers-evidence.json",
      );
      assert.deepEqual(
        JSON.parse(await js("window.downloadBody")),
        await js("window.barrierReport"),
      );
      await set("control", 0);
      await set("budget", 5);
      let r = await js("window.barrierReport");
      reports.push(r);
      assert.equal(r.levels.length, 2);
      await set("candidate", "(x+x)");
      assert.equal(await js("window.barrierProof"), null);
      await shot("state-cap-five");
      await set("budget", 7);
      assert.ok(await js("window.barrierProof"));
      for (const [id, value] of [
        ["expression", "x+y"],
        ["add", 0],
        ["multiply", 9],
        ["leaf", 1.5],
      ]) {
        await set("control", 0);
        await set(id, value, "input");
        assert.equal(await js("window.barrierReport"), null);
        assert.equal(await js("window.barrierProof"), null);
        assert.equal(
          await js("document.getElementById('candidate').options.length"),
          0,
        );
        assert.equal(
          await js("document.getElementById('download').disabled"),
          true,
        );
        await js("document.getElementById('run').click()");
        assert.equal(await js("window.barrierReport"), null);
        assert.ok(await js("document.getElementById('error').textContent"));
      }
      await set("control", 4);
      await set("budget", 3);
      assert.equal(await js("window.barrierReport"), null);
      for (const status of [
        "source-too-large",
        "target-too-large",
        "blocked",
        "first-reachable",
        "already-reachable",
      ])
        assert.ok(statuses.has(status), status);
      execFileSync(
        process.env.PYTHON || "python",
        [
          "-c",
          "import json,sys;from rewritelab import verify_atlas;assert all(verify_atlas(r) for r in json.load(sys.stdin))",
        ],
        { input: JSON.stringify(reports), maxBuffer: 128 << 20 },
      );
      console.log(
        JSON.stringify({
          browserAtlasReports: reports.length,
          candidateSelections: selections,
          statuses: [...statuses],
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
