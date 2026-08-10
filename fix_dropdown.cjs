const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

const oldSelect = `<select 
                                    className="w-full p-2.5 rounded-xl bg-gray-800 text-white border border-white/10 text-xs font-bold"
                                    value={targetPrintEmployee} 
                                    onChange={e => setTargetPrintEmployee(e.target.value)}
                                >
                                    <option value="">الكل</option>
                                    {usersList.map(u => <option key={u.key} value={u.key}>{u.name}</option>)}
                                </select>`;

const newSelect = `<select 
                                    className="w-full p-2.5 rounded-xl bg-gray-800 text-white border border-white/10 text-xs font-bold"
                                    value={targetPrintEmployee} 
                                    onChange={e => setTargetPrintEmployee(e.target.value)}
                                >
                                    <option value="">الكل</option>
                                    {usersList.filter(u => {
                                        if (selectedTargetMonth === 'current') {
                                            const now = new Date();
                                            const achieved = computeAchieved(u.name, now.getFullYear(), now.getMonth(), u.key);
                                            return achieved > 0;
                                        } else {
                                            const monthHistories = targetHistory[selectedTargetMonth] || [];
                                            const h = monthHistories.find(x => x.userId === u.key || x.employeeName === u.name);
                                            return h && h.achievedAmount > 0;
                                        }
                                    }).map(u => <option key={u.key} value={u.key}>{u.name}</option>)}
                                </select>`;

if (content.includes(oldSelect)) {
    content = content.replace(oldSelect, newSelect);
    fs.writeFileSync('components/SalesLog.tsx', content);
    console.log("Updated dropdown.");
} else {
    console.log("Could not find the dropdown to replace.");
}
