const esbuild = require('esbuild');
const path = require('path');

const isWatch = process.argv.includes('--watch');

const buildWebview = async () => {
  const ctx = await esbuild.context({
    entryPoints: ['./src/webview/main.tsx'],
    bundle: true,
    outfile: './out/webview.js',
    platform: 'browser',
    format: 'iife',
    target: 'es2020',
    loader: {
      '.tsx': 'tsx',
      '.ts': 'ts',
    },
    sourcemap: true,
    minify: !isWatch,
    logLevel: 'info',
  });

  if (isWatch) {
    await ctx.watch();
    console.log('Watching for webview changes...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
};

buildWebview().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
