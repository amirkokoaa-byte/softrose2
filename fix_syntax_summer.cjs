const fs = require('fs');
let content = fs.readFileSync('components/LeaveBalance.tsx', 'utf8');

content = content.replace(
    /\n                \}\}\n            <\/div>/,
    '\n                })}\n            </div>'
);

fs.writeFileSync('components/LeaveBalance.tsx', content);
