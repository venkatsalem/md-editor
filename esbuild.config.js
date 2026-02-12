const esbuild = require('esbuild');
const path = require('path');

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [path.join(__dirname, 'renderer', 'renderer.js')],
  bundle: true,
  outfile: path.join(__dirname, 'renderer', 'bundle.js'),
  format: 'iife',
  platform: 'browser',
  target: ['chrome120'],
  sourcemap: true,
  minify: false,
  logLevel: 'info',
};

if (isWatch) {
  esbuild.context(buildOptions).then(ctx => {
    ctx.watch();
    console.log('Watching for changes...');
  });
} else {
  esbuild.build(buildOptions).then(() => {
    console.log('Renderer bundle built successfully.');
  }).catch((err) => {
    console.error('Build failed:', err);
    process.exit(1);
  });
}
