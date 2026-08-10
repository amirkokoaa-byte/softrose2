const fs = require('fs');
let content = fs.readFileSync('components/LeaveBalance.tsx', 'utf8');

content = content.replace(
    /\n                    \);\n                \}\}/,
    '\n                    );\n                })}'
);

fs.writeFileSync('components/LeaveBalance.tsx', content);
