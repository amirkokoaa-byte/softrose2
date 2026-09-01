const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

content = content.replace(/<\/div>\s*<\/div>\s*<button onClick=\{\(\) => setShowProductSalesDataModal\(true\)/g, '</div>\n<button onClick={() => setShowProductSalesDataModal(true)');

fs.writeFileSync('components/SalesLog.tsx', content);
