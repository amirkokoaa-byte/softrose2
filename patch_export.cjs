const fs = require('fs');
let content = fs.readFileSync('components/LeaveBalance.tsx', 'utf8');

const regex = /\} else if \(type === 'unpaid' \|\| type === 'penalty'\) \{\s*attIn = "غياب";\s*attOut = "بإذن";\s*notes = "تخصم من الراتب";/g;
const replacement = `} else if (type === 'penalty') {
                        attIn = "غياب";
                        attOut = "بإذن";
                        notes = \`جزاء خصم \${leaveRecord.days} يوم\`;
                    } else if (type === 'unpaid') {
                        attIn = "غياب";
                        attOut = "بإذن";
                        notes = "تخصم من الراتب";
                    } else if (type === 'summer') {
                        attIn = "إجازة";
                        attOut = "سنوي";
                        notes = "إجازة مصيف";`;

content = content.replace(regex, replacement);

fs.writeFileSync('components/LeaveBalance.tsx', content);
