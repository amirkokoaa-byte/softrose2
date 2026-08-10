const fs = require('fs');
let content = fs.readFileSync('components/Settings.tsx', 'utf8');

content = content.replace(
    /case 'supervisor': return 'مشرف';/g,
    "case 'supervisor': return 'مشرف';\n            case 'usher': return 'أشر';"
);

content = content.replace(
    /<option value="supervisor">مشرف \(Supervisor\)<\/option>/g,
    '<option value="supervisor">مشرف (Supervisor)</option>\n                            <option value="usher">أشر (Usher)</option>'
);

fs.writeFileSync('components/Settings.tsx', content);
