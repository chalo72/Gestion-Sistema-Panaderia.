const fs = require('fs');
const { SourceMapConsumer } = require('source-map');

async function run() {
  const raw = fs.readFileSync('dist/assets/Ventas-DpyRBGt_.js.map', 'utf8');
  await SourceMapConsumer.with(raw, null, consumer => {
    const hits = new Set();
    consumer.eachMapping(m => {
      if (m.name === 'G') {
        const key = `${m.source}:${m.originalLine}:${m.originalColumn} -> ${m.name}`;
        if (!hits.has(key)) {
          console.log(key);
          hits.add(key);
        }
      }
    });
  });
}
run();
