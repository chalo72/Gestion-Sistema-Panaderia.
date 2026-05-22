const fs = require('fs');
const ts = require('typescript');

const file = fs.readFileSync('src/pages/PrePedidos.tsx', 'utf8');
const result = ts.transpileModule(file, { reportDiagnostics: true, compilerOptions: { jsx: 'react-jsx' } });
if (result.diagnostics && result.diagnostics.length > 0) {
    console.log(result.diagnostics.map(d => typeof d.messageText === 'string' ? d.messageText : d.messageText.messageText).join('\n'));
} else {
    console.log('No syntax errors');
}
