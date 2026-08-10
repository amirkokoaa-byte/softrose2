const fs = require('fs');
let file = 'components/Settings.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    /const getRoleLabel = \(role: string\) => \{\s*switch\(role\) \{\s*case 'admin': return 'مسؤول';\s*case 'manager': return 'مدير';\s*case 'coordinator': return 'منسق';\s*case 'supervisor': return 'مشرف';\s*default: return 'موظف';\s*\}\s*\};/g,
    `const getRoleLabel = (role: string) => {
        switch(role) {
            case 'admin': return 'مسؤول';
            case 'manager': return 'مدير';
            case 'coordinator': return 'منسق';
            case 'supervisor': return 'مشرف';
            case 'usher': return 'أشر';
            default: return 'موظف';
        }
    };`
);

const newOptions = `<option value="user">موظف (User)</option>
                            <option value="admin">مسؤول (Admin)</option>
                            <option value="manager">مدير (Manager)</option>
                            <option value="coordinator">منسق (Coordinator)</option>
                            <option value="supervisor">مشرف (Supervisor)</option>
                            <option value="usher">أشر (Usher)</option>`;

content = content.replace(/<option value="user">موظف \(User\)<\/option>\s*<option value="admin">مسؤول \(Admin\)<\/option>\s*<option value="manager">مدير \(Manager\)<\/option>\s*<option value="coordinator">منسق \(Coordinator\)<\/option>\s*<option value="supervisor">مشرف \(Supervisor\)<\/option>/g, newOptions);

fs.writeFileSync(file, content);
console.log("Patched roles");
