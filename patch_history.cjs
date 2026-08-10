const fs = require('fs');
let content = fs.readFileSync('components/LeaveBalance.tsx', 'utf8');

const regex = /<div className="font-bold text-sm text-white">\{typeLabels\[rec\.type\]\}<\/div>/g;
content = content.replace(regex, '<div className="font-bold text-sm text-white">{rec.customLabel ? `${typeLabels[rec.type]} - ${rec.customLabel}` : typeLabels[rec.type]}</div>');

fs.writeFileSync('components/LeaveBalance.tsx', content);
