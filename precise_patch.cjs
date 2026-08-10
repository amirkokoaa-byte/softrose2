const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

const target1 = `<div className="flex items-center justify-between bg-gray-800 p-4 rounded-2xl border border-white/10 shadow-lg">`;
const replacement1 = `{user.role === 'admin' && (\n            <div className="flex items-center justify-between bg-gray-800 p-4 rounded-2xl border border-white/10 shadow-lg">`;

const target2 = `                    </div>
                )}
            </div>

            <div className="space-y-4">`;
const replacement2 = `                    </div>
                )}
            </div>\n            )}\n\n            <div className="space-y-4">`;

content = content.replace(target1, replacement1);
content = content.replace(target2, replacement2);

fs.writeFileSync('components/SalesLog.tsx', content);
