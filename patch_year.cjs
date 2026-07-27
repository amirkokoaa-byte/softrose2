const fs = require('fs');
let code = fs.readFileSync('components/Login.tsx', 'utf8');

code = code.replace(
    'Soft Rose Trading © 2024',
    'Soft Rose Trading © {new Date().getFullYear()}'
);

fs.writeFileSync('components/Login.tsx', code);
