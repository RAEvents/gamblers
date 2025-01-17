import { mkdirSync, symlinkSync, existsSync } from "fs";
import esbuild from "esbuild";
import { minifyTemplates, writeFiles } from "esbuild-minify-templates";

async function dev() {
    const dir = "dev";
    mkdirSync(dir, { recursive: true });
    process.chdir(dir);
    if (!existsSync("index.html")) {
        symlinkSync("../dist/index.html", "index.html", "file");
    }
    process.chdir("..");

    let ctx = await esbuild.context({
        entryPoints: ["src/app.js"],
        outdir: dir,
        bundle: true,
        sourcemap: true,
        format: "esm",
    });

    await ctx.watch();

    let { host, port } = await ctx.serve({
        servedir: dir,
        onRequest: r => console.log(`${r.method} ${r.path} ${r.status}`),
    });
    console.log(`Serving at ${host}:${port}`);
}

async function prod() {
    await esbuild.build({
        plugins: [minifyTemplates({ taggedOnly: true }), writeFiles()],
        entryPoints: ["src/app.js"],
        outdir: "dist",
        bundle: true,
        minify: true,
        sourcemap: true,
        write: false,
        format: "esm",
    });
}

await { "dev": dev, "prod": prod }[process.argv[2]]();
