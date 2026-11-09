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
  "Chrome complete rewrite closures, every proof and semantic candidate, export and invalidation",
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
          process.env.REWRITELAB_URL ||
          `http://127.0.0.1:${server.address().port}/`,
      });
      for (let i = 0; i < 1000; i++) {
        if (await js("Boolean(window.rewriteReport)")) break;
        await delay(20);
      }
      assert.ok(await js("window.rewriteReport"));
      const controls = JSON.parse(
          fs.readFileSync(path.join(__dirname, "../docs/controls.json")),
        ),
        inputs = controls.map((c) => c.input),
        native = JSON.parse(
          execFileSync(
            process.env.PYTHON || "python",
            [
              "-c",
              "import sys,json;from rewritelab import optimize;print(json.dumps([optimize(r) for r in json.load(sys.stdin)]))",
            ],
            { input: JSON.stringify(inputs), maxBuffer: 64 << 20 },
          ),
        ),
        reports = [];
      let selections = 0,
        semanticSelections = 0;
      const set = (id, value, event = "change") =>
        js(
          `document.getElementById(${JSON.stringify(id)}).value=${JSON.stringify(String(value))};document.getElementById(${JSON.stringify(id)}).dispatchEvent(new Event(${JSON.stringify(event)}))`,
        );
      async function shot(name) {
        if (!process.env.REWRITELAB_SCREEN_DIR) return;
        await delay(1100);
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
          path.join(process.env.REWRITELAB_SCREEN_DIR, `${name}.png`),
          Buffer.from(im.data, "base64"),
        );
        fs.writeFileSync(
          path.join(process.env.REWRITELAB_SCREEN_DIR, `${name}.layout.json`),
          JSON.stringify(
            await js(
              'Object.fromEntries(["output","plot","detail","tree","proof","limits"].map(id=>[id,document.getElementById(id).getBoundingClientRect().top+scrollY]))',
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
          const r = await js("window.rewriteReport");
          assert.deepEqual(r, native[k]);
          reports.push(r);
          assert.equal(
            await js("document.documentElement.scrollWidth>innerWidth"),
            false,
          );
          assert.equal(
            await js('document.getElementById("state").options.length'),
            r.reachable_count,
          );
          assert.equal(
            await js('document.getElementById("semantic").options.length'),
            r.semantic_equivalent_count,
          );
          if (width === 390) {
            const result = await js(
              `(()=>{const r=window.rewriteReport,by=new Map(r.states.map(s=>[s.expression,s]));let selected=0,sem=0;for(const s of r.states){const el=document.getElementById('state');el.value=s.expression;el.dispatchEvent(new Event('change'));if(window.rewriteSelected!==s.expression||document.querySelectorAll('#proof article').length!==s.distance+1||document.querySelector('#proof article:last-child').dataset.expression!==s.expression||document.querySelectorAll('#tree circle').length!==s.expression.replace(/[()]/g,'').length)throw Error('proof DOM mismatch '+s.expression);const expected=[];let row=s;while(row){expected.push(row);row=row.parent===null?null:by.get(row.parent)}expected.reverse();if(JSON.stringify(window.rewriteProof)!==JSON.stringify(expected))throw Error('proof chain mismatch');selected++}for(const s of r.semantic_terms){const el=document.getElementById('semantic');el.value=s.expression;el.dispatchEvent(new Event('change'));if(window.rewriteSelected!==s.expression||Boolean(window.rewriteProof)!==s.reachable||document.querySelectorAll('#tree circle').length!==s.expression.replace(/[()]/g,'').length)throw Error('semantic DOM mismatch '+s.expression);sem++}return{selected,sem}})()`,
            );
            selections += result.selected;
            semanticSelections += result.sem;
          }
          await js('document.getElementById("pick-reachable").click()');
          assert.equal(
            await js("window.rewriteSelected"),
            r.best_reachable.expression,
          );
          await shot(`control-${k}-${width}`);
        }
      }
      await call("Emulation.setDeviceMetricsOverride", {
        width: 390,
        height: 1200,
        deviceScaleFactor: 1,
        mobile: true,
      });
      await set("control", 0);
      await js('document.getElementById("pick-semantic").click()');
      assert.equal(await js("window.rewriteProof"), null);
      assert.ok(
        (
          await js('document.getElementById("proof-title").textContent')
        ).includes("No bounded"),
      );
      await shot("state-blocked");
      await set("budget", "7");
      let r = await js("window.rewriteReport");
      assert.deepEqual(r, native[1]);
      reports.push(r);
      assert.equal((await js("window.rewriteProof")).length, 4);
      await shot("state-detour");
      await set("control", 6);
      await js('document.getElementById("pick-semantic").click()');
      assert.equal(await js("window.rewriteProof"), null);
      await shot("state-weighted-blocked");
      await set("control", 7);
      await set("budget", 3);
      r = await js("window.rewriteReport");
      reports.push(r);
      assert.equal(r.universe_size, 36);
      assert.equal(r.best_reachable.expression, "x");
      await shot("state-three-nodes");
      await js(
        `window.downloadBody=null;window.downloadName=null;URL.createObjectURL=b=>{window.downloadBody=b.text();return'blob:test'};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){window.downloadName=this.download};document.getElementById('download').click()`,
      );
      assert.equal(await js("window.downloadName"), "rewritelab-evidence.json");
      assert.deepEqual(JSON.parse(await js("window.downloadBody")), r);
      await set("expression", "x+y", "input");
      assert.equal(await js("window.rewriteReport"), null);
      assert.equal(await js("window.rewriteProof"), null);
      assert.equal(await js('document.getElementById("output").hidden'), true);
      assert.equal(
        await js('document.getElementById("state").options.length'),
        0,
      );
      assert.equal(
        await js('document.getElementById("download").disabled'),
        true,
      );
      await js('document.getElementById("run").click()');
      assert.ok(await js('document.getElementById("error").textContent'));
      for (const bad of ["-1", "0", "9", "1.5", ""]) {
        await set("control", 0);
        await set("add", bad, "input");
        await js('document.getElementById("run").click()');
        assert.equal(await js("window.rewriteReport"), null);
        assert.ok(await js('document.getElementById("error").textContent'));
      }
      await set("control", 4);
      await set("budget", 3);
      assert.equal(await js("window.rewriteReport"), null);
      assert.ok(await js('document.getElementById("error").textContent'));
      execFileSync(
        process.env.PYTHON || "python",
        [
          "-c",
          "import sys,json;from rewritelab import verify;assert all(verify(r) for r in json.load(sys.stdin))",
        ],
        { input: JSON.stringify(reports), maxBuffer: 64 << 20 },
      );
      console.log(
        JSON.stringify({
          browserReports: reports.length,
          proofSelections: selections,
          semanticSelections,
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
