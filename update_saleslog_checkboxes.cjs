const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

// Replace the admin check for select-all checkbox container
content = content.replace(
    /\{user\.role === 'admin' && \(\s*<div className="flex items-center justify-between bg-gray-800 p-4 rounded-2xl border border-white\/10 shadow-lg">/,
    '<div className="flex items-center justify-between bg-gray-800 p-4 rounded-2xl border border-white/10 shadow-lg">'
);

// We need to remove the matching `)}` that was closing the user.role === 'admin' block
content = content.replace(
    /\s*\}\)\}\s*<div className="space-y-4">/,
    '\n            <div className="space-y-4">'
);

// Remove the admin check for individual checkboxes
content = content.replace(
    /\{user\.role === 'admin' && \(\s*<input type="checkbox" className="w-5 h-5 accent-blue-500 rounded"/g,
    '<input type="checkbox" className="w-5 h-5 accent-blue-500 rounded"'
);
content = content.replace(
    /\s*\}\)\}\s*<div className="font-bold text-xl text-blue-400">\{sale\.market\}<\/div>/g,
    '\n        <div className="font-bold text-xl text-blue-400">{sale.market}</div>'
);

fs.writeFileSync('components/SalesLog.tsx', content);
