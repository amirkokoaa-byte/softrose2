const fs = require('fs');

// Patch Settings.tsx
let file = 'components/Settings.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/if \(user\.role !== 'admin'\) return;/g, "if (user.role !== 'admin' && user.role !== 'manager') return;");
content = content.replace(/if \(user\.role !== 'admin'\) \{/g, "if (user.role !== 'admin' && user.role !== 'manager') {");

fs.writeFileSync(file, content);

// Patch Sidebar.tsx
file = 'components/Sidebar.tsx';
content = fs.readFileSync(file, 'utf8');

content = content.replace(/if \(user\.role === 'admin'\) return true;/g, "if (user.role === 'admin' || user.role === 'manager') return true;");
content = content.replace(/if \(item\.adminOnly\) return false;/g, "if (item.adminOnly && user.role !== 'admin' && user.role !== 'manager') return false;");

fs.writeFileSync(file, content);
console.log("Patched manager permissions");
