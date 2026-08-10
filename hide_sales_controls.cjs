const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

const regexAll = /<div className="flex items-center justify-between bg-gray-800 p-4 rounded-2xl border border-white\/10 shadow-lg">[\s\S]*?<\/div>\s*<\/div>\s*\)\}\s*<\/div>/;
const match = content.match(regexAll);

if (match) {
    content = content.replace(regexAll, `{user.role === 'admin' && (\n            ${match[0]}\n            )}`);
} else {
    // try a shorter match
    const regexShort = /<div className="flex items-center justify-between bg-gray-800 p-4 rounded-2xl border border-white\/10 shadow-lg">[\s\S]*?<\/div>\s*\n\s*<\/div>\s*\n\s*\)\}\s*\n\s*<\/div>/;
    console.log("Match not found, try something else");
}

const regexInput = /<input type="checkbox" className="w-5 h-5 accent-blue-500 rounded"[\s\S]*?\}\} \/>/g;
content = content.replace(regexInput, (m, offset) => {
    // Only replace if it's the one inside the map (offset > 15000 approx)
    if (offset > 10000 && !m.includes('selectAll')) {
        return `{user.role === 'admin' && (
        ${m}
        )}`;
    }
    return m;
});

fs.writeFileSync('components/SalesLog.tsx', content);
